import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { IconColumns3, IconGripVertical, IconTrash } from '@tabler/icons-react';
import { createPortal } from 'react-dom';
import {
  Background,
  BaseEdge,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, EdgeProps, Node } from '@xyflow/react';
import {
  useCreateExplorerMutation,
  useCompileExplorerAuthoringMutation,
  useGetExplorerAuthoringCatalogQuery,
  useGetExplorerConfigsQuery,
  useGetExplorerQuery,
  useDeleteExplorerMutation,
  usePreviewExplorerDraftMutation,
  usePublishExplorerMutation,
  useSaveExplorerDraftMutation,
} from '@gen3/core';
import type {
  ExplorerConfigV2,
  ExplorerDiagnostic,
  ExplorerPreview,
  ExplorerState,
  RecipeTraversalV2,
} from '@gen3/core';
import { configForOutput } from '@gen3/core';
import {
  builderTables,
  applyCompiledColumnCapabilities,
  canonicalizeExplorerConfig,
  candidateColumnNames,
  candidateMatchesConfiguredSelection,
  createBuilderSession,
  digestExplorerConfig,
  digestExplorerPreview,
  explorerBuilderReducer,
  filterLinkedGraph,
  initialStateFromConfig,
  previewCacheKey,
  publishedConfigFromServer,
  reachableRelationshipsForResource,
  presentationDiagnostics,
  slugifyExplorerId,
  tableColumns,
  traversalAliasForRelationship,
  traversalIncludesRelationship,
  traversalRelationshipName,
  traversalTargetResource,
  type BuilderSessionState,
  type CatalogCandidate,
  type GraphRelationship,
  type GraphResource,
  type ResourceType,
} from './builderDomain';
import { layoutDatasetGraph, type GraphLayoutResult } from './graphLayout';
import { recordBrowserRuntimeError } from '../../lib/conformance/browserRuntime';
import { renderCell } from '../../utils/renderCell';

const resourceLabels: Readonly<Record<string, string>> = {
  Patient: 'People',
  Specimen: 'Biospecimens',
  File: 'Files',
  DocumentReference: 'Documents',
  ResearchSubject: 'Research subjects',
  MedicationAdministration: 'Medications',
  GroupMember: 'Group members',
  Observation: 'Measurements and findings',
  Condition: 'Diagnoses and conditions',
  DiagnosticReport: 'Diagnostic reports',
  Procedure: 'Procedures',
  Medication: 'Medications',
  BodyStructure: 'Body sites',
  Group: 'Groups and cohorts',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isResourceType = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/**
 * Field and presentation edits do not change the graph behind the authoring
 * catalog. Keep those edits out of the catalog request identity so checking a
 * row control cannot refresh the picker and change the user's place in it.
 */
const traversalForAuthoringCatalog = (
  traversal: RecipeTraversalV2,
): RecipeTraversalV2 => {
  const { fields: _fields, children, ...withoutFields } = traversal;
  return {
    ...withoutFields,
    ...(children
      ? { children: children.map(traversalForAuthoringCatalog) }
      : {}),
  };
};

const catalogConfigFor = (
  config: ExplorerConfigV2,
  output: string,
): ExplorerConfigV2 => {
  const scoped = configForOutput(config, output);
  return {
    ...scoped,
    // These are presentation-only and are not used to discover graph fields.
    sharedFilters: undefined,
    fileActions: undefined,
    recipe: {
      ...scoped.recipe,
      outputs: scoped.recipe.outputs?.map((candidate) => {
        const { fields: _fields, traversals, ...withoutFields } = candidate;
        return {
          ...withoutFields,
          ...(traversals
            ? {
                traversals: traversals.map(traversalForAuthoringCatalog),
              }
            : {}),
        };
      }),
    },
    // Keep the required view envelope, but omit its authored columns and
    // presentation settings from the discovery request identity.
    views: scoped.views.map((view) => ({
      id: view.id,
      title: '',
      output: view.output,
      table: { columns: [] },
    })),
  };
};
const titleForResource = (value: unknown): string =>
  isResourceType(value)
    ? value
        .trim()
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_.]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    : '';
const optionalText = (value: unknown): string | undefined =>
  isResourceType(value) ? value.trim() : undefined;
const textArray = (value: unknown): ReadonlyArray<string> | undefined =>
  Array.isArray(value)
    ? value.filter(isResourceType).map((item) => item.trim())
    : undefined;
const candidateFamily = (value: unknown): CatalogCandidate['family'] =>
  value === 'field' ||
  value === 'catalog' ||
  value === 'dynamic' ||
  value === 'extension' ||
  value === 'pivot'
    ? value
    : undefined;

const isStructuralCatalogCandidate = (logicalType: string): boolean =>
  /^(array|object|map|list|struct|record|json)(?:<|\[|$)/i.test(
    logicalType.trim(),
  );

const normalizeCatalogCandidate = (
  value: unknown,
  resourceType: string,
): CatalogCandidate | undefined => {
  if (
    !isRecord(value) ||
    !isResourceType(value.id) ||
    !isResourceType(value.path) ||
    !isResourceType(value.label) ||
    !isResourceType(value.logicalType)
  )
    return undefined;
  const family = candidateFamily(value.family);
  const logicalType = value.logicalType.trim();
  // Project-map/introspection data can contain intermediate FHIR containers.
  // They are topology facts, not value-bearing columns. Keep the picker
  // consistent even if a malformed/stale catalog response includes one.
  if (isStructuralCatalogCandidate(logicalType)) return undefined;
  return {
    ...(value as unknown as CatalogCandidate),
    id: value.id.trim(),
    nodeId: optionalText(value.nodeId),
    resourceType,
    path: value.path.trim(),
    label: value.label.trim(),
    logicalType,
    family,
    examples: textArray(value.examples),
    nodePath: textArray(value.nodePath),
    populationCount:
      typeof value.populationCount === 'number' &&
      Number.isFinite(value.populationCount)
        ? value.populationCount
        : undefined,
    population:
      typeof value.population === 'number' && Number.isFinite(value.population)
        ? value.population
        : undefined,
    selectionKey: optionalText(value.selectionKey),
    valueSelector: optionalText(value.valueSelector),
    familyName: optionalText(value.familyName),
    familyKind: optionalText(value.familyKind),
    output: optionalText(value.output),
    diagnostic: optionalText(value.diagnostic),
    extensionMapping: optionalText(value.extensionMapping),
  };
};

const catalogNodeKeyForCandidate = (
  candidate: CatalogCandidate,
  fallbackOutput: string,
): string => {
  const output = candidate.output?.trim() || fallbackOutput;
  const nodePath = candidate.nodePath ?? [];
  const nodeSuffix =
    nodePath.length > 0
      ? nodePath[nodePath.length - 1]
      : `root:${candidate.resourceType}`;
  return `${output}|${nodeSuffix}`;
};

/**
 * The Builder uses readable keys to group fields by table node. Loom's
 * compiler uses opaque catalog node IDs instead. Keep that translation at the
 * request boundary so UI state remains stable and the server receives the
 * identifiers from the same catalog snapshot it returned.
 */
const selectedCandidateIdsForCompile = (
  state: BuilderSessionState,
  output: string,
): Readonly<Record<string, ReadonlyArray<string>>> => {
  const candidates = state.catalog.resources.flatMap(
    (resource) => resource.fields,
  );
  const candidatesByUiNode = new Map<string, ReadonlyArray<CatalogCandidate>>();
  for (const candidate of candidates) {
    const key = catalogNodeKeyForCandidate(candidate, output);
    candidatesByUiNode.set(key, [
      ...(candidatesByUiNode.get(key) ?? []),
      candidate,
    ]);
  }

  const selectedByWireNode: Record<string, string[]> = {};
  for (const [uiNodeKey, selectedIds] of Object.entries(
    state.selectedCandidateIdsByNode,
  )) {
    if (!uiNodeKey.startsWith(`${output}|`) || selectedIds.length === 0)
      continue;
    const nodeCandidates = candidatesByUiNode.get(uiNodeKey) ?? [];
    const candidatesById = new Map(
      nodeCandidates.map((candidate) => [candidate.id, candidate]),
    );
    const selectedCandidates = selectedIds.map((candidateId) => {
      const candidate = candidatesById.get(candidateId);
      if (candidate) return candidate;
      throw {
        data: {
          code: 'CATALOG_SELECTION_NODE_MISMATCH',
          message: `Loom catalog selection ${candidateId} does not belong to ${uiNodeKey}. Refresh field discovery before previewing.`,
        },
      };
    });
    const uiNodeSuffix = uiNodeKey.slice(output.length + 1);
    // The backend deliberately treats root as a special wire key and resolves
    // it against the output's root resource in the immutable snapshot.
    const wireNodeId = uiNodeSuffix.startsWith('root:')
      ? 'root'
      : selectedCandidates.find((candidate) => candidate.nodeId)?.nodeId;
    if (!wireNodeId) {
      throw {
        data: {
          code: 'CATALOG_NODE_UNRESOLVED',
          message: `Loom's field catalog did not provide a wire node ID for ${uiNodeKey}. Refresh field discovery before previewing.`,
        },
      };
    }
    selectedByWireNode[wireNodeId] = [
      ...new Set([
        ...(selectedByWireNode[wireNodeId] ?? []),
        ...selectedCandidates.map((candidate) => candidate.id),
      ]),
    ];
  }
  return selectedByWireNode;
};

const normalizeGraphResource = (value: unknown): GraphResource | undefined => {
  if (!isRecord(value) || !isResourceType(value.resourceType)) return undefined;
  const resourceType = value.resourceType.trim();
  const fields = (Array.isArray(value.fields) ? value.fields : [])
    .map((candidate) => normalizeCatalogCandidate(candidate, resourceType))
    .filter((candidate): candidate is CatalogCandidate => Boolean(candidate));
  return {
    resourceType,
    label: isResourceType(value.label) ? value.label.trim() : resourceType,
    count:
      typeof value.count === 'number' && Number.isFinite(value.count)
        ? value.count
        : undefined,
    fields,
  };
};

const normalizeGraphRelationship = (
  value: unknown,
): GraphRelationship | undefined => {
  if (
    !isRecord(value) ||
    !isResourceType(value.id) ||
    !isResourceType(value.source) ||
    !isResourceType(value.target) ||
    !isResourceType(value.label)
  )
    return undefined;
  return {
    id: value.id.trim(),
    source: value.source.trim(),
    target: value.target.trim(),
    label: value.label.trim(),
    linkCount:
      typeof value.linkCount === 'number' && Number.isFinite(value.linkCount)
        ? value.linkCount
        : undefined,
    cardinality: isResourceType(value.cardinality)
      ? value.cardinality.trim()
      : undefined,
    direction:
      value.direction === 'inbound' || value.direction === 'outbound'
        ? value.direction
        : undefined,
  };
};

const configFromServer = (
  candidate: ExplorerState | Record<string, unknown>,
): ExplorerConfigV2 | undefined => {
  const record = candidate as Record<string, unknown>;
  // Drafts drive editing when present. Published-only responses are still
  // valid render inputs and must hydrate from activeConfig instead.
  const config = record.draftConfig ?? record.activeConfig;
  return isRecord(config) ? (config as unknown as ExplorerConfigV2) : undefined;
};

const activeConfigFromServer = (
  candidate: ExplorerState | Record<string, unknown>,
): ExplorerConfigV2 | undefined => {
  const record = candidate as Record<string, unknown>;
  const config = record.activeConfig;
  return isRecord(config) ? (config as unknown as ExplorerConfigV2) : undefined;
};

const configForBuilder = (
  candidate: ExplorerState | Record<string, unknown>,
  preferActive: boolean,
): ExplorerConfigV2 | undefined =>
  preferActive
    ? activeConfigFromServer(candidate)
    : configFromServer(candidate);

const requireServerConfig = (
  candidate: ExplorerState | Record<string, unknown>,
): ExplorerConfigV2 => {
  const config = configFromServer(candidate);
  if (!config)
    throw {
      data: {
        code: 'INVALID_EXPLORER_RESPONSE',
        message:
          'The authenticated Explorer response did not include draftConfig or activeConfig.',
      },
    };
  return config;
};

const requirePublishedConfig = (
  candidate: ExplorerState | Record<string, unknown>,
): ExplorerConfigV2 => {
  const config = publishedConfigFromServer(
    candidate as {
      readonly activeConfig?: ExplorerConfigV2;
      readonly draftConfig?: ExplorerConfigV2;
    },
  );
  if (config) return config;
  throw {
    data: {
      code: 'INVALID_PUBLICATION_RESPONSE',
      message: 'The publication response did not include activeConfig.',
    },
  };
};

const resourceTypesFromConfig = (
  config: ExplorerConfigV2 | undefined,
): ReadonlyArray<string> => {
  if (!config) return [];
  const types: string[] = [];
  const visit = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
    nodes.forEach((node) => {
      const resourceType = traversalTargetResource(node);
      if (isResourceType(resourceType)) types.push(resourceType.trim());
      visit(node.children ?? []);
    });
  for (const output of config.recipe.outputs ?? []) {
    if (isResourceType(output.rootResourceType))
      types.push(output.rootResourceType.trim());
    visit(output.traversals ?? []);
  }
  return [...new Set(types)];
};

const resourcesFor = (
  _state: BuilderSessionState,
  _resourceSuggestions: ReadonlyArray<string> = [],
  projectResources: ReadonlyArray<GraphResource> = [],
): ReadonlyArray<GraphResource> => {
  const byType = new Map<string, GraphResource>();
  for (const resource of projectResources) {
    // A resource with no records cannot contribute rows or values to the
    // authored traversal. Keep unknown counts visible, but remove explicit
    // zero-population and field-less nodes from the authoring graph.
    if (
      isResourceType(resource.resourceType) &&
      resource.count !== 0 &&
      resource.fields.length > 0
    )
      byType.set(resource.resourceType, resource);
  }
  return [...byType.values()];
};

const candidateIdentity = (candidate: CatalogCandidate): string =>
  JSON.stringify([
    candidate.resourceType,
    candidate.id,
    candidate.nodePath ?? [],
  ]);

const relationshipsFor = (
  _state: BuilderSessionState,
  projectRelationships: ReadonlyArray<GraphRelationship> = [],
): ReadonlyArray<GraphRelationship> =>
  projectRelationships
    .map((relationship) => normalizeGraphRelationship(relationship))
    .filter((relationship): relationship is GraphRelationship =>
      Boolean(relationship),
    )
    .filter(
      (relationship, index, values) =>
        values.findIndex((candidate) => candidate.id === relationship.id) ===
        index,
    );

const candidatesFor = (
  state: BuilderSessionState,
  resource?: ResourceType,
  _projectResources: ReadonlyArray<GraphResource> = [],
): ReadonlyArray<CatalogCandidate> => {
  const fields =
    state.catalog.resources
      .map((item) => normalizeGraphResource(item))
      .find((item) => item?.resourceType === resource)?.fields ?? [];
  if (!resource) return fields;
  const nodeKey = graphNodeKey(state, resource).split('|').slice(1).join('|');
  const nodePath = nodeKey.startsWith('root:') ? [] : [nodeKey];
  return fields.filter(
    (candidate) =>
      !candidate.nodePath ||
      candidate.nodePath.length === 0 ||
      candidate.nodePath.join('/') === nodePath.join('/') ||
      candidate.nodePath[candidate.nodePath.length - 1] === nodeKey,
  );
};

const selectedCandidateIdsFor = (
  state: BuilderSessionState,
  resource: ResourceType | undefined,
): ReadonlySet<string> => {
  const output = state.config?.recipe.outputs?.find(
    (item) => item.name === state.selectedOutput,
  );
  let localNodeKey =
    state.selectedResource === resource && state.selectedNodeKey?.includes('|')
      ? state.selectedNodeKey.split('|').slice(1).join('|')
      : `root:${resource ?? ''}`;
  const visit = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
    nodes.forEach((node) => {
      if (
        traversalTargetResource(node) === resource &&
        localNodeKey === `root:${resource ?? ''}`
      )
        localNodeKey = node.alias;
      visit(node.children ?? []);
    });
  if (output?.rootResourceType !== resource) visit(output?.traversals ?? []);
  const nodeKey = `${state.selectedOutput ?? ''}|${localNodeKey}`;
  const snapshotSelections = state.selectedCandidateIdsByNode[nodeKey];
  const configuredSelections = candidatesFor(state, resource)
    .filter((candidate) =>
      state.config
        ? candidateMatchesConfiguredSelection(
            state.config,
            state.selectedOutput ?? '',
            nodeKey,
            candidate,
          )
        : false,
    )
    .map((candidate) => candidate.id);
  if (snapshotSelections)
    return new Set([...snapshotSelections, ...configuredSelections]);
  return new Set(configuredSelections);
};

const diagnostic = (
  code: string,
  message: string,
  severity: ExplorerDiagnostic['severity'] = 'error',
): ExplorerDiagnostic => ({ code, message, severity });

const lifecycleError = (
  error: unknown,
): {
  diagnostics: ReadonlyArray<ExplorerDiagnostic>;
  conflict?: BuilderSessionState['conflict'];
} => {
  type ErrorPayload = {
    code?: string;
    message?: string;
    currentVersion?: number;
    currentDigest?: string;
    updatedAt?: string;
    diagnostics?: ReadonlyArray<ExplorerDiagnostic>;
    endpoint?: string;
    retryable?: boolean;
    requestId?: string;
    fieldPath?: string | null;
    details?: Readonly<Record<string, unknown>>;
    status?: number | string;
    httpStatus?: number;
  };
  const value = error as {
    data?: ErrorPayload & { error?: ErrorPayload };
    error?: string | ErrorPayload;
  } & ErrorPayload;
  const nested =
    value?.data && typeof value.data.error === 'object'
      ? value.data.error
      : typeof value.error === 'object'
        ? value.error
        : undefined;
  const body: ErrorPayload = {
    ...(value?.data ?? {}),
    ...(value ?? {}),
    ...(nested ?? {}),
  };
  const directErrorMessage =
    error instanceof Error && error.message.trim() ? error.message : undefined;
  const rawMessage =
    body.message ??
    (typeof value.error === 'string' ? value.error : undefined) ??
    directErrorMessage ??
    'The Explorer request failed.';
  const httpStatus =
    typeof body.httpStatus === 'number'
      ? body.httpStatus
      : typeof body.status === 'number'
        ? body.status
        : undefined;
  const authenticationRequired = httpStatus === 401;
  const message = authenticationRequired
    ? 'Your Loom session has expired. Sign in again to continue.'
    : body.code === 'INVALID_REQUEST'
      ? 'Loom could not validate this table request. Refresh field discovery and try again.'
      : body.code === 'NOT_FOUND' && /route/i.test(rawMessage)
        ? 'The Builder service is unavailable for this operation. Try again later.'
        : rawMessage;
  const code = authenticationRequired
    ? 'AUTHENTICATION_REQUIRED'
    : (body.code ?? 'EXPLORER_REQUEST_FAILED');
  const diagnostics = body.diagnostics?.length
    ? body.diagnostics.map((item) => ({
        ...item,
        code: authenticationRequired ? code : item.code,
        message: authenticationRequired
          ? message
          : item.code === 'INVALID_REQUEST'
            ? 'Loom could not validate this table request. Refresh field discovery and try again.'
            : item.code === 'NOT_FOUND' && /route/i.test(item.message)
              ? 'The Builder service is unavailable for this operation. Try again later.'
              : item.message,
        endpoint: item.endpoint ?? body.endpoint,
        fieldPath: item.fieldPath ?? body.fieldPath,
        details: item.details ?? body.details,
      }))
    : [
        {
          ...diagnostic(code, message),
          endpoint: body.endpoint,
          retryable: body.retryable,
          requestId: body.requestId,
          fieldPath: body.fieldPath,
          details: body.details,
        },
      ];
  return {
    diagnostics,
    conflict:
      body.code === 'DRAFT_CONFLICT'
        ? {
            currentVersion: body.currentVersion,
            currentDigest: body.currentDigest,
            updatedAt: body.updatedAt,
          }
        : undefined,
  };
};

const graphNodeKey = (state: BuilderSessionState, resource: ResourceType) => {
  if (
    state.selectedResource === resource &&
    state.selectedNodeKey?.startsWith(`${state.selectedOutput ?? ''}|`)
  )
    return state.selectedNodeKey;
  const output = state.config?.recipe.outputs?.find(
    (item) => item.name === state.selectedOutput,
  );
  const prefix = `${state.selectedOutput ?? ''}|`;
  if (output?.rootResourceType === resource) return `${prefix}root:${resource}`;
  let key: string | undefined;
  const visit = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
    nodes.forEach((node) => {
      if (!key && traversalTargetResource(node) === resource) key = node.alias;
      if (!key) visit(node.children ?? []);
    });
  visit(output?.traversals ?? []);
  return `${prefix}${key ?? `root:${resource}`}`;
};

const traversalAliases = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
): ReadonlySet<string> => {
  const aliases = new Set<string>();
  const visit = (items: ReadonlyArray<RecipeTraversalV2>) =>
    items.forEach((item) => {
      aliases.add(item.alias);
      visit(item.children ?? []);
    });
  visit(nodes);
  return aliases;
};

const RoutedEdge = ({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  markerEnd,
  style,
  interactionWidth,
}: EdgeProps) => (
  <>
    <BaseEdge
      id={id}
      interactionWidth={interactionWidth}
      markerEnd={markerEnd}
      path={
        (data as { readonly path?: string } | undefined)?.path ??
        `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`
      }
      style={style}
    />
  </>
);

const edgeTypes = { routed: RoutedEdge };

interface BuilderRenderBoundaryState {
  readonly error?: Error;
}

/** Keep a graph rendering defect from blanking the entire Builder route. */
class BuilderRenderBoundary extends React.Component<
  React.PropsWithChildren,
  BuilderRenderBoundaryState
> {
  state: BuilderRenderBoundaryState = {};

  static getDerivedStateFromError(error: Error): BuilderRenderBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    recordBrowserRuntimeError({
      kind: 'error',
      message: error.message,
      stack: error.stack,
      source: 'ExplorerBuilder',
      timestamp: new Date().toISOString(),
    });
    console.error('[ExplorerBuilder] render failed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <section
        role="alert"
        className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"
      >
        <strong>The graph could not be rendered.</strong>
        <p className="mt-1">
          The Builder kept your configuration intact. Reload this graph after
          discovery finishes.
        </p>
        <button
          type="button"
          className="mt-3 rounded border border-red-400 bg-white px-3 py-1.5 font-semibold"
          onClick={() => this.setState({ error: undefined })}
        >
          Retry graph
        </button>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer font-medium">
            Technical details
          </summary>
          <pre className="mt-1 whitespace-pre-wrap break-words">
            {this.state.error.message}
          </pre>
        </details>
      </section>
    );
  }
}

const GraphViewportFitter = ({
  hostRef,
  graphIdentity,
}: {
  readonly hostRef: React.RefObject<HTMLDivElement | null>;
  readonly graphIdentity: string;
}) => {
  const graph = useReactFlow();
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let frame = 0;
    const fit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // React Flow measures nodes after its first paint. Waiting one more
        // frame prevents a refresh from fitting the empty canvas and leaving
        // the real graph offset or clipped when the layout arrives.
        frame = requestAnimationFrame(() =>
          graph.fitView({
            // Keep the whole linked graph comfortably inside the bounded
            // viewport. A little more breathing room makes dense projects
            // readable without forcing the user to pan before they can see
            // the available next relationships.
            padding: 0.18,
            minZoom: 0.18,
            maxZoom: 1,
            duration: 160,
          }),
        );
      });
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    fit();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [graph, graphIdentity, hostRef]);
  return null;
};

const TraversalGraph = ({
  state,
  resources,
  relationships,
  dispatch,
  disabled,
  readOnly,
  status,
}: {
  readonly state: BuilderSessionState;
  readonly resources: ReadonlyArray<GraphResource>;
  readonly relationships: ReadonlyArray<GraphRelationship>;
  readonly dispatch: React.Dispatch<
    Parameters<typeof explorerBuilderReducer>[1]
  >;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly status: 'loading' | 'ready' | 'error';
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const output = state.config?.recipe.outputs?.find(
    (item) => item.name === state.selectedOutput,
  );
  const root = output?.rootResourceType;
  const included = new Set<string>();
  const visit = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
    nodes.forEach((node) => {
      included.add(traversalTargetResource(node));
      visit(node.children ?? []);
    });
  visit(output?.traversals ?? []);
  // Only validated catalog records are allowed to become ReactFlow nodes. A
  // malformed discovery record must not take down the entire Builder render.
  const linkedGraph = filterLinkedGraph(resources, relationships);
  const graphTypes = linkedGraph.resources
    .map((resource) => resource.resourceType)
    .filter(isResourceType);
  // A traversal is defined by relationships. Standalone resources cannot
  // contribute a column to a dataframe traversal, so keep the project graph
  // focused on resource types that participate in at least one edge.
  const visibleTypes = graphTypes;
  const visibleTypeSet = new Set(visibleTypes);
  const visibleRelationships = linkedGraph.relationships.filter(
    (relationship) =>
      visibleTypeSet.has(relationship.source) &&
      visibleTypeSet.has(relationship.target),
  );
  const layoutIdentity = `${visibleTypes.slice().sort().join(',')}|${visibleRelationships
    .map((relationship) => relationship.id)
    .sort()
    .join(',')}`;
  const [layoutState, setLayoutState] = useState<{
    readonly identity: string;
    readonly value: GraphLayoutResult;
  }>();
  const [layoutError, setLayoutError] = useState<string>();
  // Effects run after render. Keying the result by the topology that produced
  // it prevents one render from pairing a new node list with an old layout.
  const layout =
    layoutState?.identity === layoutIdentity ? layoutState.value : undefined;
  useEffect(() => {
    let active = true;
    setLayoutState(undefined);
    setLayoutError(undefined);
    void layoutDatasetGraph(
      visibleTypes.map((resourceType) => ({
        id: resourceType,
        width: 164,
        height: 60,
      })),
      visibleRelationships.map((relationship) => ({
        id: relationship.id,
        source: relationship.source,
        target: relationship.target,
      })),
    )
      .then((next) => {
        if (!active) return;
        const missing = visibleTypes.find(
          (resourceType) => !next.positions.has(resourceType),
        );
        if (missing) {
          setLayoutError(
            `The graph layout did not return a position for ${missing}.`,
          );
          return;
        }
        setLayoutState({ identity: layoutIdentity, value: next });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLayoutError(
          error instanceof Error
            ? error.message
            : 'The graph layout could not be computed.',
        );
      });
    return () => {
      active = false;
    };
    // The identity is canonicalized above; the graph inputs are intentionally
    // read from this render so a layout is recomputed only when topology changes.
    // eslint-disable-next-line reactHooks/exhaustive-deps
  }, [layoutIdentity]);
  const graphNodes: Node[] = layout
    ? visibleTypes.map((resourceType) => {
        const resource = resources.find(
          (candidate) => candidate.resourceType === resourceType,
        );
        const selected = state.selectedResource === resourceType;
        const inTable = root === resourceType || included.has(resourceType);
        const reachable =
          Boolean(root) &&
          relationships.some(
            (relationship) =>
              (relationship.source === resourceType &&
                (relationship.source === root ||
                  included.has(relationship.source)) &&
                !included.has(relationship.target)) ||
              (relationship.target === resourceType &&
                (relationship.target === root ||
                  included.has(relationship.target)) &&
                !included.has(relationship.source)),
          );
        const label =
          resourceLabels[resourceType] ?? resource?.label ?? resourceType;
        const details = [
          root === resourceType
            ? 'ROW START'
            : inTable
              ? 'IN TABLE'
              : reachable
                ? 'NEXT RELATIONSHIP'
                : root
                  ? ''
                  : 'CHOOSE ROW START',
          resource?.count === undefined
            ? ''
            : `${resource.count.toLocaleString()} records`,
          resource?.fields.length
            ? `${resource.fields.length} graph fields`
            : '',
          label !== titleForResource(resourceType)
            ? titleForResource(resourceType)
            : '',
        ]
          .filter(Boolean)
          .join('\n');
        return {
          id: resourceType,
          position: layout.positions.get(resourceType)!,
          data: { label: `${label}${details ? `\n${details}` : ''}` },
          style: {
            width: 164,
            minHeight: 60,
            padding: 8,
            borderRadius: 12,
            border: selected
              ? '3px solid #7c3aed'
              : inTable
                ? '3px solid #2f5aac'
                : reachable
                  ? '3px solid #16a34a'
                  : '1px solid #94a3b8',
            background: selected
              ? '#f3e8ff'
              : inTable
                ? '#dbeafe'
                : reachable
                  ? '#f0fdf4'
                  : '#fff',
            boxShadow:
              selected || inTable || reachable
                ? '0 8px 24px rgba(30,64,175,.18)'
                : '0 3px 10px rgba(15,23,42,.08)',
            whiteSpace: 'pre-line' as const,
            cursor: disabled ? 'default' : 'pointer',
            fontWeight: selected || inTable || reachable ? 600 : 500,
            fontSize: 11,
            lineHeight: 1.25,
          },
        };
      })
    : [];
  const relationshipIncluded = (relationship: GraphRelationship): boolean =>
    traversalIncludesRelationship(output?.traversals ?? [], relationship, root);
  const graphEdges: Edge[] = layout
    ? visibleRelationships.map((relationship) => {
        const selected = relationshipIncluded(relationship);
        const reachable =
          Boolean(root) &&
          (((relationship.source === root ||
            included.has(relationship.source)) &&
            !included.has(relationship.target)) ||
            ((relationship.target === root ||
              included.has(relationship.target)) &&
              !included.has(relationship.source)));
        const visible = !root || selected || reachable;
        return {
          id: relationship.id,
          source: relationship.source,
          target: relationship.target,
          type: 'routed',
          data: { path: layout?.routes.get(relationship.id) },
          label: relationship.label,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: selected || reachable ? '#2563eb' : '#64748b',
          },
          interactionWidth: 30,
          style: {
            stroke: selected ? '#2563eb' : reachable ? '#16a34a' : '#64748b',
            strokeWidth: selected ? 5 : reachable ? 4 : 2,
            opacity: visible ? 1 : 0.48,
          },
        };
      })
    : [];
  const graphIdentity = `${graphNodes
    .map((node) => node.id)
    .sort()
    .join(',')}|${graphEdges
    .map((edge) => edge.id)
    .sort()
    .join(',')}|layout:${layout ? 'ready' : 'pending'}`;
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
      <div
        className="relative h-[30rem] min-h-0 flex-none overflow-hidden"
        aria-label="Populated FHIR relationship graph"
      >
        <div ref={hostRef} className="relative h-full w-full">
          <ReactFlowProvider>
            <GraphViewportFitter
              hostRef={hostRef}
              graphIdentity={graphIdentity}
            />
            <ReactFlow
              nodes={graphNodes}
              edges={graphEdges}
              edgeTypes={edgeTypes}
              minZoom={0.18}
              maxZoom={2.5}
              nodesDraggable={false}
              nodesConnectable={false}
              zoomOnScroll
              zoomOnPinch
              panOnDrag
              preventScrolling
              onNodeClick={(_, node) => {
                if (!state.selectedOutput) return;
                if (!root) {
                  dispatch(
                    disabled
                      ? { type: 'selectResource', resource: node.id }
                      : {
                          type: 'setRoot',
                          output: state.selectedOutput,
                          resourceType: node.id,
                        },
                  );
                  return;
                }
                // Clicking a reachable node should start the same traversal
                // workflow as clicking its edge. If several relationships can
                // reach the node, select the first stable option and let the
                // field viewer make the relationship choice explicit.
                const reachableRelationships =
                  reachableRelationshipsForResource(
                    visibleRelationships,
                    node.id,
                    root,
                    output?.traversals ?? [],
                  );
                dispatch({
                  type: 'selectResource',
                  resource: node.id,
                  nodeKey: reachableRelationships[0]
                    ? `${state.selectedOutput}|${reachableRelationships[0].id}`
                    : undefined,
                });
              }}
              onEdgeClick={(_, edge) => {
                if (!state.selectedOutput) return;
                const relationship = relationships.find(
                  (candidate) => candidate.id === edge.id,
                );
                if (!root && relationship) {
                  dispatch(
                    disabled
                      ? {
                          type: 'selectResource',
                          resource: relationship.source,
                          nodeKey: `${state.selectedOutput}|${relationship.id}`,
                        }
                      : {
                          type: 'setRoot',
                          output: state.selectedOutput,
                          resourceType: relationship.source,
                        },
                  );
                  return;
                }
                const sourceIncluded = Boolean(
                  relationship &&
                  root &&
                  (relationship.source === root ||
                    included.has(relationship.source)),
                );
                const targetIncluded = Boolean(
                  relationship &&
                  root &&
                  (relationship.target === root ||
                    included.has(relationship.target)),
                );
                const nextResource =
                  relationship && sourceIncluded && !targetIncluded
                    ? relationship.target
                    : relationship && targetIncluded && !sourceIncluded
                      ? relationship.source
                      : (edge.target as string);
                dispatch({
                  type: 'selectResource',
                  resource: nextResource,
                  nodeKey: `${state.selectedOutput}|${
                    relationship && relationshipIncluded(relationship)
                      ? traversalAliasForRelationship(
                          output?.traversals ?? [],
                          relationship,
                        )
                      : edge.id
                  }`,
                });
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#cbd5e1" gap={28} size={1} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </ReactFlowProvider>
          {graphNodes.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center p-8 text-center text-sm text-slate-600"
              role={layoutError ? 'alert' : undefined}
            >
              {layoutError
                ? `Graph layout failed: ${layoutError}`
                : !layout
                  ? 'Laying out the linked project graph…'
                  : status === 'loading'
                    ? 'Loading the linked project graph…'
                    : status === 'error'
                      ? 'The linked project graph could not be loaded. See the diagnostic above before retrying discovery.'
                      : 'No linked populated resources are available for traversal.'}
            </div>
          )}
        </div>
      </div>
      {!root && graphNodes.length > 0 && (
        <nav
          aria-label="Row resource choices"
          className="shrink-0 border-t border-slate-200 bg-white/95 p-2"
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            Choose the resource represented by one row
          </div>
          <p className="mb-1 text-[11px] text-slate-500">
            {disabled
              ? readOnly
                ? 'The repository default is read-only. Create a custom Explorer to edit its row resource.'
                : 'The Builder is temporarily unavailable while discovery is incomplete.'
              : 'Choose a node here or click one in the graph.'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {visibleTypes.map((resourceType) => (
              <button
                key={resourceType}
                type="button"
                disabled={disabled}
                className="rounded border border-blue-300 bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  if (!state.selectedOutput || disabled) return;
                  dispatch({
                    type: 'setRoot',
                    output: state.selectedOutput,
                    resourceType,
                  });
                }}
              >
                {resourceLabels[resourceType] ?? resourceType}
              </button>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
};

const GuidedGraphWorkspace = ({
  state,
  dispatch,
  disabled,
  readOnly,
  resourceSuggestions,
  projectGraph,
  projectGraphStatus,
  projectGraphError,
}: {
  readonly state: BuilderSessionState;
  readonly dispatch: React.Dispatch<
    Parameters<typeof explorerBuilderReducer>[1]
  >;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly resourceSuggestions: ReadonlyArray<string>;
  readonly projectGraph: {
    readonly resources: ReadonlyArray<GraphResource>;
    readonly relationships: ReadonlyArray<GraphRelationship>;
  };
  readonly projectGraphStatus: 'loading' | 'ready' | 'error';
  readonly projectGraphError?: string;
}) => {
  const [search, setSearch] = useState('');
  const [pendingSelections, setPendingSelections] = useState<
    Readonly<Record<string, ReadonlyArray<string>>>
  >({});
  const table = state.config?.recipe.outputs?.find(
    (output) => output.name === state.selectedOutput,
  );
  const builderTable = builderTables(state.config).find(
    (candidate) => candidate.output === state.selectedOutput,
  );
  const configuredColumnForCandidate = (candidate: CatalogCandidate) =>
    builderTable?.columns.find((column) =>
      candidateColumnNames(candidate).has(column.column),
    );
  const discoveredResources =
    projectGraphStatus === 'ready'
      ? resourcesFor(state, resourceSuggestions, projectGraph.resources)
      : [];
  const discoveredRelationships =
    projectGraphStatus === 'ready'
      ? relationshipsFor(state, projectGraph.relationships)
      : [];
  const linkedGraph = filterLinkedGraph(
    discoveredResources,
    discoveredRelationships,
  );
  const resources = linkedGraph.resources;
  const relationships = linkedGraph.relationships;
  const resource = state.selectedResource ?? table?.rootResourceType;
  const nodeKey = resource
    ? graphNodeKey(state, resource)
    : `${state.selectedOutput ?? ''}|root:`;
  const nodeCandidates = candidatesFor(state, resource, projectGraph.resources);
  const query = search.trim().toLocaleLowerCase();
  const candidates = nodeCandidates
    .filter((candidate) =>
      `${candidate.label} ${candidate.path} ${candidate.logicalType} ${candidate.familyName ?? ''} ${(candidate.examples ?? []).join(' ')}`
        .toLocaleLowerCase()
        .includes(query),
    )
    .filter(
      (candidate, index, values) =>
        values.findIndex(
          (value) => candidateIdentity(value) === candidateIdentity(candidate),
        ) === index,
    );
  const outputTraversalAliases = traversalAliases(table?.traversals ?? []);
  const includedResourceTypes = new Set<string>();
  const collectIncludedResources = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
    nodes.forEach((node) => {
      includedResourceTypes.add(traversalTargetResource(node));
      collectIncludedResources(node.children ?? []);
    });
  collectIncludedResources(table?.traversals ?? []);
  const root = table?.rootResourceType;
  const included = Boolean(
    resource &&
    (resource === root ||
      outputTraversalAliases.has(nodeKey.split('|').slice(1).join('|'))),
  );
  const inspectedRelationship = nodeKey.includes('|')
    ? relationships.find(
        (candidate) => candidate.id === nodeKey.split('|').slice(1).join('|'),
      )
    : undefined;
  const reachableRelationshipChoices = resource
    ? reachableRelationshipsForResource(
        relationships,
        resource,
        root,
        table?.traversals ?? [],
      )
    : [];
  const relationshipIsReachable = Boolean(
    inspectedRelationship &&
    reachableRelationshipChoices.some(
      (relationship) => relationship.id === inspectedRelationship.id,
    ),
  );
  const orientedRelationship =
    inspectedRelationship && root
      ? inspectedRelationship.source === root ||
        includedResourceTypes.has(inspectedRelationship.source)
        ? inspectedRelationship
        : inspectedRelationship.target === root ||
            includedResourceTypes.has(inspectedRelationship.target)
          ? {
              ...inspectedRelationship,
              id: `${inspectedRelationship.target}/${inspectedRelationship.label}/${inspectedRelationship.source}`,
              source: inspectedRelationship.target,
              target: inspectedRelationship.source,
              direction: 'inbound' as const,
            }
          : undefined
      : undefined;
  // Use the compiler-facing direction for a prospective branch. This keeps
  // fields selected from an inbound edge attached to the same traversal alias
  // that will be authored when the branch is added.
  const selectionNodeKey =
    !included && orientedRelationship && state.selectedOutput
      ? `${state.selectedOutput}|${traversalAliasForRelationship(
          table?.traversals ?? [],
          orientedRelationship,
        )}`
      : nodeKey;
  const selectedIds = included
    ? selectedCandidateIdsFor(state, resource)
    : new Set(pendingSelections[selectionNodeKey] ?? []);
  const selectedCount = nodeCandidates.filter((candidate) =>
    selectedIds.has(candidate.id),
  ).length;
  const canEditColumns = Boolean(state.selectedOutput && resource);
  const applyCandidate = (candidate: CatalogCandidate, selected: boolean) => {
    if (!canEditColumns || disabled) return;
    if (!included) {
      setPendingSelections((current) => {
        const values = new Set(current[selectionNodeKey] ?? []);
        if (selected) values.add(candidate.id);
        else values.delete(candidate.id);
        return { ...current, [selectionNodeKey]: [...values] };
      });
      return;
    }
    dispatch({
      type: 'setCandidate',
      output: state.selectedOutput ?? '',
      nodeKey,
      candidate,
      selected,
    });
  };
  const setSelection = (next: ReadonlyArray<CatalogCandidate>) => {
    if (!canEditColumns || disabled) return;
    const nextIds = [...new Set(next.map((candidate) => candidate.id))];
    if (!included) {
      setPendingSelections((current) => ({
        ...current,
        [selectionNodeKey]: nextIds,
      }));
      return;
    }
    const current = selectedCandidateIdsFor(state, resource);
    const nextSet = new Set(nextIds);
    nodeCandidates.forEach((candidate) => {
      const before = current.has(candidate.id);
      const after = nextSet.has(candidate.id);
      if (before !== after)
        dispatch({
          type: 'setCandidate',
          output: state.selectedOutput ?? '',
          nodeKey,
          candidate,
          selected: after,
        });
    });
  };
  const addInspectedResource = () => {
    if (!orientedRelationship || disabled || !state.selectedOutput) return;
    dispatch({
      type: 'addTraversal',
      output: state.selectedOutput,
      relationship: orientedRelationship,
    });
    const nextNodeKey = `${state.selectedOutput}|${traversalAliasForRelationship(
      table?.traversals ?? [],
      orientedRelationship,
    )}`;
    const selectedForNewNode = pendingSelections[selectionNodeKey] ?? [];
    nodeCandidates
      .filter((candidate) => selectedForNewNode.includes(candidate.id))
      .forEach((candidate) =>
        dispatch({
          type: 'setCandidate',
          output: state.selectedOutput ?? '',
          nodeKey: nextNodeKey,
          candidate,
          selected: true,
        }),
      );
    setPendingSelections((current) => {
      const next = { ...current };
      delete next[selectionNodeKey];
      return next;
    });
  };
  const removeTraversal = (alias: string, label: string) => {
    if (disabled || !state.selectedOutput) return;
    if (window.confirm(`Remove ${label} and its descendants from this table?`))
      dispatch({
        type: 'removeTraversal',
        output: state.selectedOutput,
        nodeKey: alias,
      });
  };
  const renderTraversal = (
    nodes: ReadonlyArray<RecipeTraversalV2>,
    depth = 0,
  ): React.ReactNode =>
    nodes.map((traversal) => (
      <React.Fragment key={traversal.alias}>
        <span
          className="inline-flex items-center gap-1"
          style={{ marginLeft: depth * 12 }}
        >
          <span className="text-slate-400" aria-hidden="true">
            →
          </span>
          <button
            type="button"
            title={traversalRelationshipName(traversal) || undefined}
            className="rounded-md border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-950 hover:bg-blue-50"
            onClick={() =>
              dispatch({
                type: 'selectResource',
                resource: traversalTargetResource(traversal),
                nodeKey: `${state.selectedOutput ?? ''}|${traversal.alias}`,
              })
            }
          >
            {resourceLabels[traversalTargetResource(traversal)] ??
              traversalTargetResource(traversal)}
          </button>
          <button
            type="button"
            disabled={disabled}
            aria-label={`Remove ${resourceLabels[traversalTargetResource(traversal)] ?? traversalTargetResource(traversal)} and descendants`}
            className="rounded border border-blue-200 px-1.5 py-0.5 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            onClick={() =>
              removeTraversal(
                traversal.alias,
                resourceLabels[traversalTargetResource(traversal)] ??
                  traversalTargetResource(traversal),
              )
            }
          >
            ×
          </button>
        </span>
        {renderTraversal(traversal.children ?? [], depth + 1)}
      </React.Fragment>
    ));
  return (
    <section
      aria-label="Guided Explorer Builder"
      className="flex min-h-[30rem] flex-col gap-2.5 overflow-hidden xl:h-[calc(100vh-14rem)] xl:max-h-[42rem] xl:min-h-0"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)]">
        <section
          className="flex min-h-[23rem] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5 xl:min-h-0"
          aria-labelledby="fhir-map-heading"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 id="fhir-map-heading" className="font-semibold">
                Project graph
              </h3>
            </div>
            {projectGraphStatus === 'ready' ? (
              <span className="text-xs text-emerald-700">
                Linked project graph · {resources.length} resources ·{' '}
                {relationships.length} relationships
              </span>
            ) : projectGraphStatus === 'loading' ? (
              <span className="text-xs text-amber-700">
                Loading complete project graph…
              </span>
            ) : (
              <span role="alert" className="text-xs text-red-700">
                {projectGraphError ?? 'Project graph discovery failed.'}
              </span>
            )}
          </div>
          <nav
            aria-label="Included traversal"
            className="mt-3 flex min-h-11 shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs"
          >
            <span className="mr-1 font-semibold uppercase tracking-wide text-blue-800">
              Traversal
            </span>
            {root ? (
              <button
                type="button"
                className="rounded-md border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-950 hover:bg-blue-100"
                onClick={() =>
                  dispatch({
                    type: 'selectResource',
                    resource: root,
                    nodeKey: `${state.selectedOutput ?? ''}|root:${root}`,
                  })
                }
              >
                <span className="mr-1 text-blue-500">1</span>
                {resourceLabels[root] ?? root}
                <span className="ml-1 font-normal text-slate-500">
                  row start
                </span>
              </button>
            ) : (
              <span className="text-blue-900">
                Select a resource node to define the row start.
              </span>
            )}
            {renderTraversal(table?.traversals ?? [])}
          </nav>
          <div className="mt-3 min-h-0 flex-1">
            <TraversalGraph
              state={state}
              resources={resources}
              relationships={relationships}
              dispatch={dispatch}
              disabled={disabled}
              readOnly={readOnly}
              status={projectGraphStatus}
            />
          </div>
        </section>
        <aside
          className="flex min-h-[23rem] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-2.5 sm:p-3 xl:min-h-0"
          aria-labelledby="fields-heading"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 id="fields-heading" className="text-lg font-semibold">
                Choose{' '}
                {resourceLabels[resource ?? ''] ?? resource ?? 'resource'}{' '}
                columns
              </h3>
            </div>
          </div>
          {orientedRelationship && relationshipIsReachable && (
            <div className="mt-3 rounded border border-green-300 bg-green-50 p-3 text-xs text-green-950">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <strong className="block text-sm">
                    Add the next traversal step
                  </strong>
                  <span>
                    {resourceLabels[orientedRelationship.source] ??
                      orientedRelationship.source}{' '}
                    → {orientedRelationship.label} →{' '}
                    {resourceLabels[orientedRelationship.target] ??
                      orientedRelationship.target}
                    {orientedRelationship.linkCount === undefined
                      ? ''
                      : ` · ${orientedRelationship.linkCount.toLocaleString()} observed links`}
                    {orientedRelationship.cardinality
                      ? ` · expected ${orientedRelationship.cardinality}`
                      : ''}
                  </span>
                  {reachableRelationshipChoices.length > 1 && (
                    <label className="mt-2 block font-medium">
                      Relationship
                      <select
                        aria-label={`Relationship used to add ${resourceLabels[resource ?? ''] ?? resource}`}
                        className="mt-1 block w-full rounded border border-green-400 bg-white px-2 py-1.5 text-xs text-slate-900"
                        value={inspectedRelationship?.id ?? ''}
                        onChange={(event) =>
                          dispatch({
                            type: 'selectResource',
                            resource,
                            nodeKey: `${state.selectedOutput ?? ''}|${event.currentTarget.value}`,
                          })
                        }
                      >
                        {reachableRelationshipChoices.map((relationship) => (
                          <option key={relationship.id} value={relationship.id}>
                            {relationship.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  title={
                    disabled
                      ? 'The Builder is temporarily unavailable while discovery is incomplete.'
                      : 'Add this reachable relationship and its selected columns to the traversal.'
                  }
                  className="rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                  onClick={addInspectedResource}
                >
                  Add{' '}
                  {resourceLabels[orientedRelationship.target] ??
                    orientedRelationship.target}{' '}
                  to traversal
                  {selectedCount > 0 && (
                    <>
                      {' '}
                      · {selectedCount} column{selectedCount === 1 ? '' : 's'}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
          {!resource && (
            <div className="flex flex-1 items-center justify-center text-center text-sm text-slate-500">
              Select a node or relationship in the graph to inspect its columns.
            </div>
          )}
          {resource && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="guided-field-search">
                  Search columns
                </label>
                <input
                  id="guided-field-search"
                  value={search}
                  onChange={(event) => setSearch(event.currentTarget.value)}
                  placeholder="Search columns, codes, systems, or examples"
                  className="min-w-0 flex-1 rounded border border-slate-300 px-2.5 py-2 text-sm"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {disabled ? (
                  <p className="basis-full text-xs text-amber-800">
                    {readOnly
                      ? 'The repository default is read-only. Create a custom Explorer to edit its columns.'
                      : 'The field catalog is not editable until the Builder has finished loading this resource.'}
                  </p>
                ) : !canEditColumns ? (
                  <p className="basis-full text-xs text-slate-600">
                    Select a resource in the graph before changing its columns.
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={disabled || !canEditColumns}
                  title={
                    disabled
                      ? 'The field catalog is not ready for editing yet.'
                      : !canEditColumns
                        ? 'Select a resource in the graph first.'
                        : 'Select every discovered column for this resource.'
                  }
                  className="rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-800 disabled:opacity-50"
                  onClick={() => setSelection(nodeCandidates)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  disabled={disabled || !canEditColumns}
                  className="rounded border border-slate-300 px-2 py-1.5 text-xs disabled:opacity-50"
                  title="Clear the selected columns for this resource."
                  onClick={() => setSelection([])}
                >
                  Clear selection
                </button>
              </div>
              <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded border border-slate-200">
                <div className="divide-y divide-slate-100">
                  {candidates.map((candidate, index) => {
                    const previous = candidates[index - 1];
                    const family =
                      candidate.familyName ?? candidate.family ?? 'Fields';
                    const previousFamily =
                      previous?.familyName ?? previous?.family ?? 'Fields';
                    const configuredColumn =
                      configuredColumnForCandidate(candidate);
                    const filter = configuredColumn
                      ? builderTable?.filters.find(
                          (item) => item.column === configuredColumn.column,
                        )
                      : undefined;
                    const chart = configuredColumn
                      ? builderTable?.charts.find(
                          (item) => item.column === configuredColumn.column,
                        )
                      : undefined;
                    const canFilter = Boolean(
                      configuredColumn &&
                      configuredColumn.filterable !== false &&
                      candidate.filterable !== false,
                    );
                    const canChart = Boolean(
                      configuredColumn &&
                      (configuredColumn.chartable ??
                        candidate.chartable === true),
                    );
                    return (
                      <React.Fragment key={candidateIdentity(candidate)}>
                        {family !== previousFamily && (
                          <p className="bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {family}
                          </p>
                        )}
                        <div
                          className={`flex items-start gap-3 px-3 py-2.5 ${selectedIds.has(candidate.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                        >
                          <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={selectedIds.has(candidate.id)}
                              disabled={disabled || !canEditColumns}
                              onChange={(event) =>
                                applyCandidate(
                                  candidate,
                                  event.currentTarget.checked,
                                )
                              }
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className="block truncate text-sm font-medium text-slate-800"
                                title={candidate.label}
                              >
                                {candidate.label}
                              </span>
                              <span className="block text-xs text-slate-500">
                                {candidate.logicalType} ·{' '}
                                {candidate.repeated
                                  ? 'repeated'
                                  : 'single value'}
                                {candidate.populationCount === undefined
                                  ? ''
                                  : ` · ${candidate.populationCount.toLocaleString()} populated`}
                              </span>
                              {candidate.examples?.length ? (
                                <span
                                  className="block truncate text-[11px] text-slate-400"
                                  title={candidate.examples.join(', ')}
                                >
                                  Examples:{' '}
                                  {candidate.examples.slice(0, 2).join(', ')}
                                </span>
                              ) : null}
                            </span>
                            <span className="text-[10px] uppercase text-slate-400">
                              {candidate.family ?? 'field'}
                            </span>
                          </label>
                          {configuredColumn && (
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 pt-0.5">
                              <label className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={Boolean(filter)}
                                  disabled={disabled || !canFilter}
                                  onChange={(event) =>
                                    dispatch({
                                      type: 'setFilter',
                                      output: state.selectedOutput ?? '',
                                      column: configuredColumn.column,
                                      enabled: event.currentTarget.checked,
                                      label:
                                        filter?.label ?? configuredColumn.label,
                                    })
                                  }
                                />
                                Filter
                              </label>
                              {filter && (
                                <input
                                  aria-label={`${configuredColumn.label ?? configuredColumn.column} filter label`}
                                  className="w-28 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px]"
                                  value={
                                    filter.label ?? configuredColumn.label ?? ''
                                  }
                                  disabled={disabled}
                                  onChange={(event) =>
                                    dispatch({
                                      type: 'setFilter',
                                      output: state.selectedOutput ?? '',
                                      column: configuredColumn.column,
                                      enabled: true,
                                      label: event.currentTarget.value,
                                    })
                                  }
                                />
                              )}
                              <label className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600">
                                <input
                                  type="checkbox"
                                  checked={Boolean(chart)}
                                  disabled={disabled || !canChart}
                                  title={
                                    canChart
                                      ? undefined
                                      : 'Charts are unavailable for this column type.'
                                  }
                                  onChange={(event) =>
                                    dispatch({
                                      type: 'setChart',
                                      output: state.selectedOutput ?? '',
                                      column: configuredColumn.column,
                                      enabled: event.currentTarget.checked,
                                      title:
                                        chart?.title ?? configuredColumn.label,
                                    })
                                  }
                                />
                                Chart
                              </label>
                              {chart && (
                                <input
                                  aria-label={`${configuredColumn.label ?? configuredColumn.column} chart title`}
                                  className="w-28 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px]"
                                  value={
                                    chart.title ?? configuredColumn.label ?? ''
                                  }
                                  disabled={disabled}
                                  onChange={(event) =>
                                    dispatch({
                                      type: 'setChart',
                                      output: state.selectedOutput ?? '',
                                      column: configuredColumn.column,
                                      enabled: true,
                                      title: event.currentTarget.value,
                                    })
                                  }
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  })}
                  {candidates.length === 0 && (
                    <p className="p-4 text-sm text-slate-500">
                      {state.catalog.diagnostics.some(
                        (item) => item.severity === 'error',
                      )
                        ? 'Field discovery is unavailable for this resource. Refresh fields after the Loom route is available; no columns can be selected from graph metadata alone.'
                        : 'No value-bearing columns were returned for this resource.'}
                    </p>
                  )}
                </div>
              </div>
              {resource !== root && (
                <button
                  type="button"
                  disabled={disabled}
                  className="mt-2 w-full rounded-md border border-violet-300 bg-white px-3 py-2 text-xs font-semibold text-violet-800 disabled:opacity-50"
                  onClick={() => {
                    if (
                      window.confirm(
                        `Start each row with ${resourceLabels[resource] ?? resource}? Existing traversal and columns will be replaced.`,
                      )
                    )
                      dispatch({
                        type: 'setRoot',
                        output: state.selectedOutput ?? '',
                        resourceType: resource,
                      });
                  }}
                >
                  Set as row start
                </button>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
};

const PreviewTable = ({
  state,
  dispatch,
  disabled,
  readOnly = false,
  limit,
  onLimitChange,
}: {
  readonly state: BuilderSessionState;
  readonly dispatch: React.Dispatch<
    Parameters<typeof explorerBuilderReducer>[1]
  >;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly limit: 10 | 25 | 50 | 100;
  readonly onLimitChange: (limit: 10 | 25 | 50 | 100) => void;
}) => {
  const output = state.selectedOutput ?? '';
  const preview = state.preview[output];
  const allColumns = tableColumns(state);
  const columns = allColumns.filter((column) => column.visible);
  const editingDisabled = disabled || readOnly;
  const visibilityDisabled =
    readOnly ||
    !state.config?.recipe.outputs?.find((item) => item.name === output)
      ?.rootResourceType;
  const catalogBlocked = state.catalog.diagnostics.some(
    (item) => item.severity === 'error',
  );
  const disabledReason = readOnly
    ? 'Choose a row resource and at least one visible column before previewing.'
    : !state.config?.recipe.outputs?.find((item) => item.name === output)
          ?.rootResourceType
      ? 'Choose a row start in the graph first.'
      : columns.length === 0
        ? 'Select at least one visible column first.'
        : undefined;
  type ColumnDropTarget = {
    readonly column: string;
    readonly position: 'before' | 'after';
  };
  const [draggingColumn, setDraggingColumn] = useState<string>();
  const [dropTarget, setDropTarget] = useState<ColumnDropTarget>();

  const dropTargetForEvent = (
    event: React.DragEvent<HTMLTableCellElement>,
    column: string,
  ): ColumnDropTarget => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      column,
      position:
        event.clientX - bounds.left < bounds.width / 2 ? 'before' : 'after',
    };
  };

  return (
    <section
      aria-label="Sample preview"
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="font-semibold text-slate-900">
            Preview and configure
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <details className="relative">
            <summary
              aria-label="Configure visible columns"
              className="flex cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 [&::-webkit-details-marker]:hidden"
            >
              <IconColumns3 size={15} stroke={1.8} aria-hidden="true" />
              <span>Columns</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                {columns.length}/{allColumns.length}
              </span>
              <span aria-hidden="true" className="text-slate-400">
                ▾
              </span>
            </summary>
            <div className="absolute right-0 top-full z-30 mt-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-xl">
              <div className="border-b border-slate-100 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">
                    Visible columns
                  </p>
                  <span className="text-[10px] font-medium text-slate-400">
                    {columns.length} of {allColumns.length}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">
                  Choose which fields appear in the preview and published table.
                </p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={
                      visibilityDisabled || columns.length === allColumns.length
                    }
                    onClick={() =>
                      dispatch({
                        type: 'setColumnsVisible',
                        output,
                        visible: true,
                      })
                    }
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={visibilityDisabled || columns.length === 0}
                    onClick={() =>
                      dispatch({
                        type: 'setColumnsVisible',
                        output,
                        visible: false,
                      })
                    }
                  >
                    Uncheck all
                  </button>
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1.5">
                {allColumns.map((column) => (
                  <label
                    key={column.column}
                    className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={column.visible}
                      disabled={visibilityDisabled}
                      onChange={(event) =>
                        dispatch({
                          type: 'setColumnVisible',
                          output,
                          column: column.column,
                          visible: event.currentTarget.checked,
                        })
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-slate-700">
                        {column.label ?? column.column}
                      </span>
                      <span className="block truncate text-[10px] text-slate-400">
                        {column.column}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </details>
          <label className="inline-flex items-center text-xs text-slate-500">
            Rows
            <select
              aria-label="Preview rows"
              className="ml-1 w-11 appearance-none rounded-md border border-slate-300 bg-white px-1.5 py-1 text-center text-xs font-medium text-slate-700 shadow-sm"
              style={{
                appearance: 'none',
                WebkitAppearance: 'none',
                backgroundImage: 'none',
              }}
              value={limit}
              onChange={(event) =>
                onLimitChange(
                  Number(event.currentTarget.value) as 10 | 25 | 50 | 100,
                )
              }
              disabled={disabled}
              title={disabledReason}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </label>
        </div>
      </div>
      {preview?.status === 'loading' && (
        <div
          className="border-b bg-blue-50 px-4 py-2 text-xs text-blue-800"
          role="status"
        >
          Refreshing preview…
        </div>
      )}
      {preview?.status === 'error' && (
        <div
          className="border-b bg-red-50 px-4 py-2 text-xs text-red-800"
          role="alert"
        >
          {preview.error}
        </div>
      )}
      {preview?.data ? (
        <div className="max-h-[26rem] overflow-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                {columns.map((column) => {
                  const isDropTarget =
                    dropTarget?.column === column.column &&
                    draggingColumn !== column.column;
                  const isDropBefore =
                    isDropTarget && dropTarget?.position === 'before';
                  return (
                    <th
                      key={column.column}
                      draggable={!editingDisabled}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('text/plain', column.column);
                        setDraggingColumn(column.column);
                        setDropTarget(undefined);
                      }}
                      onDragOver={(event) => {
                        if (editingDisabled || !draggingColumn) return;
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setDropTarget(dropTargetForEvent(event, column.column));
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (
                          !editingDisabled &&
                          draggingColumn &&
                          draggingColumn !== column.column
                        ) {
                          const target = dropTargetForEvent(
                            event,
                            column.column,
                          );
                          dispatch({
                            type: 'reorderColumn',
                            output,
                            column: draggingColumn,
                            ...(target.position === 'before'
                              ? { before: column.column }
                              : { after: column.column }),
                          });
                        }
                        setDraggingColumn(undefined);
                        setDropTarget(undefined);
                      }}
                      onDragEnd={() => {
                        setDraggingColumn(undefined);
                        setDropTarget(undefined);
                      }}
                      className={`relative border-b px-2 py-1.5 transition-colors ${
                        draggingColumn === column.column ? 'opacity-50' : ''
                      } ${isDropTarget ? 'bg-blue-50' : ''}`}
                    >
                      {isDropTarget && (
                        <span
                          aria-hidden="true"
                          className={`pointer-events-none absolute inset-y-1 z-10 w-1 rounded-full bg-blue-600 shadow-[0_0_0_3px_rgba(37,99,235,0.14)] ${
                            isDropBefore ? 'left-0' : 'right-0'
                          }`}
                        />
                      )}
                      <div className="flex min-w-40 items-center gap-1.5">
                        <span
                          aria-hidden="true"
                          className="cursor-grab select-none text-slate-400 active:cursor-grabbing"
                          title="Drag to reorder"
                        >
                          <IconGripVertical size={16} stroke={1.8} />
                        </span>
                        <input
                          aria-label={`${column.column} display label`}
                          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          value={column.label ?? column.column}
                          disabled={editingDisabled}
                          onChange={(event) =>
                            dispatch({
                              type: 'setColumnLabel',
                              output,
                              column: column.column,
                              label: event.currentTarget.value,
                            })
                          }
                        />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preview.data.rows.map((row, index) => (
                <tr key={index} className="odd:bg-white even:bg-slate-50">
                  {columns.map((column) => (
                    <td
                      key={column.column}
                      className="max-w-64 truncate border-b px-3 py-2"
                      title={renderCell(row[column.column])}
                    >
                      {renderCell(row[column.column]) || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="p-8 text-center text-sm text-slate-500">
          {preview?.status === 'error'
            ? 'Preview unavailable. Change the configuration to try again.'
            : catalogBlocked
              ? 'Field discovery is unavailable for this table. Refresh discovery before previewing.'
              : state.config?.recipe.outputs?.find(
                    (item) => item.name === output,
                  )?.rootResourceType
                ? columns.length
                  ? 'Preparing a sample preview…'
                  : 'Select at least one column to preview.'
                : 'Choose a row resource before previewing.'}
        </div>
      )}
    </section>
  );
};

const PresentationPanels = ({
  state,
  dispatch,
  disabled,
}: {
  readonly state: BuilderSessionState;
  readonly dispatch: React.Dispatch<
    Parameters<typeof explorerBuilderReducer>[1]
  >;
  readonly disabled: boolean;
}) => {
  const output = state.selectedOutput ?? '';
  const [sharedName, setSharedName] = useState('');
  const [fileActionName, setFileActionName] = useState('');
  const [fileActionRoute, setFileActionRoute] = useState('');
  const [fileExtension, setFileExtension] = useState('');
  const [fileExtensionActions, setFileExtensionActions] = useState<
    ReadonlyArray<string>
  >([]);
  const [sharedMappingColumns, setSharedMappingColumns] = useState<
    Readonly<Record<string, string>>
  >({});
  const tables = builderTables(state.config);
  const fileActions = state.config?.fileActions?.actions ?? {};
  const fileExtensions = state.config?.fileActions?.extensions ?? {};
  const columnsForTable = (tableOutput: string) =>
    tableColumns(state, tableOutput).filter(
      (column) => column.filterable !== false,
    );
  const sharedMappings = tables
    .map((tableItem) => {
      const options = columnsForTable(tableItem.output);
      const selected =
        sharedMappingColumns[tableItem.output] ??
        (tableItem.output === output ? options[0]?.column : undefined);
      const column = options.find((candidate) => candidate.column === selected);
      return column
        ? {
            output: tableItem.output,
            column: column.column,
            label: column.label,
            logicalType: column.logicalType,
          }
        : undefined;
    })
    .filter(
      (mapping): mapping is NonNullable<typeof mapping> =>
        mapping !== undefined,
    );
  const sharedTypes = new Set(
    sharedMappings.map((mapping) => mapping.logicalType).filter(Boolean),
  );

  return (
    <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
        Shared filters and file actions
      </summary>
      <div className="grid gap-4 border-t border-slate-200 p-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Shared filters</h3>
          <p className="mt-1 text-xs text-slate-500">
            Map one friendly filter across compatible tables.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              className="min-w-0 flex-1 rounded border px-2 py-1.5 text-sm"
              value={sharedName}
              onChange={(event) => {
                setSharedName(event.currentTarget.value);
              }}
              placeholder="e.g. Status"
              disabled={disabled}
            />
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              disabled={
                disabled ||
                !sharedName.trim() ||
                sharedMappings.length === 0 ||
                sharedTypes.size > 1
              }
              onClick={() => {
                dispatch({
                  type: 'setSharedFilter',
                  name: sharedName,
                  mappings: sharedMappings,
                });
                setSharedName('');
                setSharedMappingColumns({});
              }}
            >
              Add
            </button>
          </div>
          {sharedName.trim() && (
            <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
              <p className="text-xs text-slate-600">
                Choose the compatible emitted column for each table.
              </p>
              {tables.map((tableItem) => {
                const options = columnsForTable(tableItem.output);
                const value =
                  sharedMappingColumns[tableItem.output] ??
                  (tableItem.output === output
                    ? (options[0]?.column ?? '')
                    : '');
                return (
                  <label
                    key={tableItem.output}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-28 shrink-0 font-medium text-slate-600">
                      {tableItem.title}
                    </span>
                    <select
                      className="min-w-0 flex-1 rounded border px-2 py-1 text-xs"
                      value={value}
                      disabled={disabled || options.length === 0}
                      onChange={(event) =>
                        setSharedMappingColumns((current) => ({
                          ...current,
                          [tableItem.output]: event.currentTarget.value,
                        }))
                      }
                    >
                      <option value="">
                        {options.length === 0
                          ? 'No filter-capable columns'
                          : 'Do not map this table'}
                      </option>
                      {options.map((column) => (
                        <option key={column.column} value={column.column}>
                          {column.label ?? column.column}
                          {column.logicalType ? ` · ${column.logicalType}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              })}
              {sharedTypes.size > 1 && (
                <p role="alert" className="text-xs text-amber-800">
                  Selected columns have incompatible logical types. Choose
                  columns with the same type before adding this shared filter.
                </p>
              )}
            </div>
          )}
          {Object.entries(state.config?.sharedFilters ?? {}).map(
            ([name, mappings]) => (
              <div
                key={name}
                className="mt-2 flex items-center justify-between rounded bg-slate-50 p-2 text-xs"
              >
                <span>
                  <span className="font-medium">{name}</span>
                  <span className="ml-2 text-slate-500">
                    {mappings
                      .map((mapping) => `${mapping.output}.${mapping.column}`)
                      .join(', ')}
                  </span>
                </span>
                <button
                  type="button"
                  className="underline"
                  disabled={disabled}
                  onClick={() => dispatch({ type: 'removeSharedFilter', name })}
                >
                  Remove
                </button>
              </div>
            ),
          )}
        </section>
        <section className="rounded-xl border bg-white p-4">
          <h3 className="font-semibold">Project file actions</h3>
          <p className="mt-1 text-xs text-slate-500">
            Name an action and map file extensions to its target route.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded border px-2 py-1.5 text-sm"
              value={fileActionName}
              onChange={(event) => setFileActionName(event.currentTarget.value)}
              placeholder="Action name"
              disabled={disabled}
            />
            <input
              className="rounded border px-2 py-1.5 text-sm"
              value={fileActionRoute}
              onChange={(event) =>
                setFileActionRoute(event.currentTarget.value)
              }
              placeholder="Target route"
              disabled={disabled}
            />
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              disabled={
                disabled || !fileActionName.trim() || !fileActionRoute.trim()
              }
              onClick={() => {
                dispatch({
                  type: 'setFileAction',
                  name: fileActionName,
                  targetRoute: fileActionRoute,
                });
                setFileActionName('');
                setFileActionRoute('');
              }}
            >
              Add action
            </button>
          </div>
          {Object.entries(fileActions).map(([name, route]) => (
            <div
              key={name}
              className="mt-2 flex items-center justify-between rounded bg-slate-50 p-2 text-xs"
            >
              <span>
                {name} → {route}
              </span>
              <button
                type="button"
                className="underline"
                disabled={disabled}
                onClick={() => dispatch({ type: 'removeFileAction', name })}
              >
                Remove
              </button>
            </div>
          ))}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              className="rounded border px-2 py-1.5 text-sm"
              value={fileExtension}
              onChange={(event) => {
                setFileExtension(event.currentTarget.value);
                setFileExtensionActions([]);
              }}
              placeholder="Extension, e.g. .bam"
              disabled={disabled}
            />
            <select
              className="rounded border px-2 py-1.5 text-sm"
              multiple
              disabled={disabled || !fileExtension.trim()}
              value={fileExtensionActions}
              onChange={(event) =>
                setFileExtensionActions(
                  Array.from(
                    event.currentTarget.selectedOptions,
                    (option) => option.value,
                  ),
                )
              }
              aria-label="Actions for file extension"
            >
              {Object.keys(fileActions).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              disabled={disabled || !fileExtension.trim()}
              onClick={() => {
                dispatch({
                  type: 'setFileActionExtensions',
                  extension: fileExtension,
                  actions: fileExtensionActions,
                });
                setFileExtension('');
                setFileExtensionActions([]);
              }}
            >
              Map extension
            </button>
          </div>
          {Object.entries(fileExtensions).map(([extension, names]) => (
            <div
              key={extension}
              className="mt-2 flex items-center justify-between rounded bg-slate-50 p-2 text-xs"
            >
              <span>
                {extension} → {names.join(', ')}
              </span>
              <button
                type="button"
                className="underline"
                disabled={disabled}
                onClick={() =>
                  dispatch({
                    type: 'setFileActionExtensions',
                    extension,
                    actions: [],
                  })
                }
              >
                Remove
              </button>
            </div>
          ))}
        </section>
      </div>
    </details>
  );
};

const BuilderWorkspace = ({
  organization,
  project,
}: {
  readonly organization: string;
  readonly project: string;
}) => {
  const projectId = `${organization}-${project}`;
  const authResourcePath = `/programs/${organization}/projects/${project}`;
  const [createExplorer, { isLoading: isCreatingExplorer }] =
    useCreateExplorerMutation();
  const [deleteExplorer, { isLoading: isDeletingExplorer }] =
    useDeleteExplorerMutation();
  const configs = useGetExplorerConfigsQuery(projectId);
  const [compileAuthoring] = useCompileExplorerAuthoringMutation();
  const [saveDraft, { isLoading: isSavingDraftRequest }] =
    useSaveExplorerDraftMutation();
  const [previewDraft] = usePreviewExplorerDraftMutation();
  const [publishExplorer, { isLoading: isPublishingRequest }] =
    usePublishExplorerMutation();
  const [state, dispatch] = useReducer(
    explorerBuilderReducer,
    projectId,
    (value) => createBuilderSession(value),
  );
  const [selectedId, setSelectedId] = useState('default');
  const [draggingTableOutput, setDraggingTableOutput] = useState<string>();
  const [tableDropTarget, setTableDropTarget] = useState<string>();
  const [tableSelectorOpen, setTableSelectorOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const newNameRef = useRef<HTMLInputElement>(null);
  const [builderToolbarHost, setBuilderToolbarHost] =
    useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<string>();
  const [previewLimit, setPreviewLimit] = useState<10 | 25 | 50 | 100>(25);
  const previewAbort = useRef<{ abort?: () => void } | undefined>(undefined);
  const previewInFlight = useRef<Promise<ExplorerPreview> | undefined>(
    undefined,
  );
  const previewTimer = useRef<number | undefined>(undefined);
  const previewIntent = useRef<string | undefined>(undefined);
  const commitInFlight = useRef(false);
  const isDefault =
    selectedId === 'default' || state.management === 'REPOSITORY';
  useEffect(() => {
    setBuilderToolbarHost(
      document.getElementById('explorer-builder-toolbar-host'),
    );
  }, []);
  const selectedServerConfig = configs.data?.find(
    (candidate) => candidate.explorerId === selectedId,
  );
  const selectedConfigFromList = selectedServerConfig
    ? configForBuilder(selectedServerConfig, selectedId === 'default')
    : undefined;
  const selectedExplorer = useGetExplorerQuery(
    { project: projectId, explorerId: selectedId },
    { skip: Boolean(selectedConfigFromList) },
  );
  const selectedServerState = selectedConfigFromList
    ? selectedServerConfig
    : (selectedExplorer.data ?? selectedServerConfig);
  const selectedConfig =
    selectedConfigFromList ??
    (selectedExplorer.data
      ? configForBuilder(selectedExplorer.data, selectedId === 'default')
      : undefined);
  const authoringConfig = state.config;
  const authoringCatalogConfig = useMemo(
    () =>
      authoringConfig && state.selectedOutput
        ? catalogConfigFor(authoringConfig, state.selectedOutput)
        : undefined,
    [authoringConfig, state.selectedOutput],
  );
  const authoringCatalog = useGetExplorerAuthoringCatalogQuery(
    {
      project: projectId,
      explorerId: selectedId,
      output: state.selectedOutput ?? '',
      config: authoringCatalogConfig as ExplorerConfigV2,
      authResourcePath,
    },
    // The repository/default Explorer is editable in the browser, and its
    // graph and field picker require the live authoring catalog.
    { skip: !authoringCatalogConfig || !state.selectedOutput },
  );
  const authoringCatalogScopeKey = authoringCatalogConfig
    ? canonicalizeExplorerConfig(authoringCatalogConfig)
    : undefined;
  const authoringCatalogScopeKeyRef = useRef(authoringCatalogScopeKey);
  authoringCatalogScopeKeyRef.current = authoringCatalogScopeKey;
  // Loom's supported authoring catalog is project-wide: its nodes and route
  // edges replace the removed legacy project-map call. Candidate
  // fields remain in state.catalog, where they are joined to the same graph
  // snapshot and opaque selection IDs.
  const catalogCandidatesByResource = new Map<string, CatalogCandidate[]>();
  for (const candidate of authoringCatalog.data?.candidates ?? []) {
    const resourceType = candidate.resourceType?.trim();
    if (!resourceType) continue;
    const normalized = normalizeCatalogCandidate(candidate, resourceType);
    if (!normalized) continue;
    const values = catalogCandidatesByResource.get(resourceType) ?? [];
    if (
      !values.some(
        (value) => candidateIdentity(value) === candidateIdentity(normalized),
      )
    )
      values.push(normalized);
    catalogCandidatesByResource.set(resourceType, values);
  }
  const projectGraph = {
    sourceGeneration: authoringCatalog.data?.sourceGeneration,
    resources: (authoringCatalog.data?.resources ?? [])
      .map((value): GraphResource | undefined => {
        const resource = normalizeGraphResource(value);
        if (!resource) return undefined;
        // The authoring REST response keeps resources and candidates in
        // separate arrays. Join them before graph filtering so a node with no
        // value-bearing selections never reaches ReactFlow.
        const fields = [
          ...resource.fields,
          ...(catalogCandidatesByResource.get(resource.resourceType) ?? []),
        ].filter(
          (candidate, index, values) =>
            values.findIndex(
              (value) =>
                candidateIdentity(value) === candidateIdentity(candidate),
            ) === index,
        );
        return { ...resource, fields };
      })
      .filter((resource): resource is GraphResource => resource !== undefined),
    relationships: (authoringCatalog.data?.relationships ?? [])
      .map((relationship) => normalizeGraphRelationship(relationship))
      .filter((relationship): relationship is GraphRelationship =>
        Boolean(relationship),
      ),
  };
  const projectGraphStatus: 'loading' | 'ready' | 'error' =
    authoringCatalog.error
      ? 'error'
      : authoringCatalog.data
        ? 'ready'
        : 'loading';
  const projectGraphError = authoringCatalog.error
    ? lifecycleError(authoringCatalog.error).diagnostics[0]?.message
    : undefined;
  const resourceSuggestions = [
    ...(configs.data ?? []).flatMap((candidate) =>
      resourceTypesFromConfig(configFromServer(candidate)),
    ),
    ...resourceTypesFromConfig(selectedConfig),
    ...projectGraph.resources.map((resource) => resource.resourceType),
  ].filter(
    (resourceType, index, values) => values.indexOf(resourceType) === index,
  );
  const activeConfig = selectedServerState
    ? (activeConfigFromServer(selectedServerState) ??
      (selectedId === 'default' && selectedConfig ? selectedConfig : undefined))
    : undefined;
  const tableList = builderTables(state.config);
  const selectedTable = tableList.find(
    (table) => table.output === state.selectedOutput,
  );
  const authoringTraversalKey = selectedTable
    ? JSON.stringify(selectedTable.traversal)
    : '';
  const authoringRoot = selectedTable?.rootResourceType;
  const derivedId = slugifyExplorerId(newName);
  // Column order is presentation-only. Keep it out of the preview effect's
  // identity so dragging a header does not recompile and refetch the same rows.
  const previewConfigDigest = state.config
    ? canonicalizeExplorerConfig({
        ...state.config,
        views: state.config.views.map((view) => ({
          ...view,
          table: {
            ...view.table,
            columns: [...view.table.columns].sort((left, right) =>
              left.column.localeCompare(right.column),
            ),
          },
        })),
      })
    : '';

  // The seed intentionally captures the current reducer state once per server config.
  // eslint-disable-next-line reactHooks/exhaustive-deps
  useEffect(() => {
    let cancelled = false;
    if (!selectedConfig) return;
    const seed = {
      ...state,
      explorerId: selectedId,
      management:
        selectedId === 'default'
          ? ('REPOSITORY' as const)
          : ('INTERACTIVE' as const),
    };
    const published = activeConfig ?? null;
    void initialStateFromConfig(
      projectId,
      seed,
      selectedConfig,
      selectedServerState?.draftVersion ?? 0,
      selectedServerState?.draftDigest,
      published,
      selectedServerState?.updatedAt,
      selectedServerState,
    ).then((next) => {
      if (!cancelled) dispatch({ type: 'load', state: next });
    });
    return () => {
      cancelled = true;
    };
  }, [
    projectId,
    selectedId,
    selectedConfig,
    activeConfig,
    selectedServerState?.draftDigest,
    selectedServerState?.draftVersion,
    selectedServerState?.updatedAt,
  ]);
  useEffect(() => {
    dispatch({
      type: 'setCatalog',
      catalog: {
        complete: false,
        diagnostics: [],
        resources: [],
        relationships: [],
      },
    });
  }, [selectedId, state.selectedOutput, authoringRoot, authoringTraversalKey]);
  useEffect(() => {
    const catalog = authoringCatalog.data;
    if (!catalog) return;
    const rawResources = Array.isArray(catalog.resources)
      ? catalog.resources
      : [];
    const rawRelationships = Array.isArray(catalog.relationships)
      ? catalog.relationships
      : [];
    const rawCandidates = Array.isArray(catalog.candidates)
      ? catalog.candidates
      : [];
    const catalogDiagnostics = Array.isArray(catalog.diagnostics)
      ? catalog.diagnostics
      : [];
    const normalizedResources = rawResources
      .map((resource) => normalizeGraphResource(resource))
      .filter((resource): resource is GraphResource => Boolean(resource));
    const normalizedCandidates = rawCandidates
      .map((candidate) =>
        isRecord(candidate) && isResourceType(candidate.resourceType)
          ? normalizeCatalogCandidate(candidate, candidate.resourceType.trim())
          : undefined,
      )
      .filter((candidate): candidate is CatalogCandidate => Boolean(candidate));
    const relationships = rawRelationships
      .map((relationship) => normalizeGraphRelationship(relationship))
      .filter((relationship): relationship is GraphRelationship =>
        Boolean(relationship),
      );
    const invalidEntries =
      rawResources.length -
      normalizedResources.length +
      rawRelationships.length -
      relationships.length +
      rawCandidates.length -
      normalizedCandidates.length;
    const diagnostics =
      invalidEntries > 0
        ? [
            ...catalogDiagnostics,
            {
              severity: 'error' as const,
              code: 'INVALID_CATALOG_ENTRY',
              message: `Loom returned ${invalidEntries} incomplete graph or field catalog record${invalidEntries === 1 ? '' : 's'}. Refresh discovery before previewing or publishing.`,
            },
          ]
        : catalogDiagnostics;
    dispatch({
      type: 'setCatalog',
      catalog: {
        snapshotToken: catalog.snapshotToken,
        scopeKey: authoringCatalogScopeKeyRef.current,
        catalogDigest: catalog.catalogDigest,
        sourceGeneration: catalog.sourceGeneration,
        resolvedSchemaDigest: catalog.resolvedSchemaDigest,
        authScopeDigest: catalog.authScopeDigest,
        baseRecipeDigest: catalog.baseRecipeDigest,
        complete: catalog.complete && invalidEntries === 0,
        diagnostics,
        resources: normalizedResources.map((resource) => ({
          ...resource,
          fields: normalizedCandidates.filter(
            (candidate) => candidate.resourceType === resource.resourceType,
          ),
        })),
        relationships,
      },
    });
  }, [authoringCatalog.data]);
  useEffect(() => {
    if (!authoringCatalog.error) return;
    const details = lifecycleError(authoringCatalog.error);
    dispatch({
      type: 'setCatalog',
      catalog: {
        complete: false,
        diagnostics: details.diagnostics,
        resources: [],
        relationships: [],
      },
    });
  }, [authoringCatalog.error]);

  const compileForOutput = async (
    config: ExplorerConfigV2,
    output: string,
  ): Promise<ExplorerConfigV2> => {
    if (!state.catalog.snapshotToken || !state.catalog.complete)
      throw {
        data: {
          code: 'CATALOG_INCOMPLETE',
          message: 'Loom field discovery has not completed for this table.',
        },
      };
    if (
      !isDefault &&
      (!authoringCatalogScopeKey ||
        state.catalog.scopeKey !== authoringCatalogScopeKey)
    )
      throw {
        data: {
          code: 'CATALOG_REFRESHING',
          message:
            'Loom field discovery is refreshing for the current row resource. Try previewing again when it completes.',
        },
      };
    const compiled = await compileAuthoring({
      project: projectId,
      explorerId: selectedId,
      authResourcePath,
      output,
      config,
      snapshotToken: state.catalog.snapshotToken,
      selectedCandidateIdsByNode: selectedCandidateIdsForCompile(state, output),
      ...(isDefault ? {} : { expectedDraftVersion: state.draftVersion }),
    }).unwrap();
    if (compiled.diagnostics.some((item) => item.severity === 'error'))
      throw {
        data: { code: 'VALIDATION_FAILED', diagnostics: compiled.diagnostics },
      };
    return applyCompiledColumnCapabilities(
      compiled.config,
      output,
      compiled.emittedColumns,
    );
  };

  const refreshPreview = async (force = false) => {
    if (commitInFlight.current) return;
    const config = state.config;
    const output = state.selectedOutput;
    if (
      !config ||
      !output ||
      !selectedTable?.rootResourceType ||
      !selectedTable.columns.some((column) => column.visible)
    ) {
      setMessage(
        'Choose a row resource and at least one column before previewing.',
      );
      return;
    }
    if (!state.catalog.complete) {
      setMessage(
        'Loom field discovery is still running. Preview will be available when the catalog is complete.',
      );
      return;
    }
    if (
      !isDefault &&
      (!authoringCatalogScopeKey ||
        state.catalog.scopeKey !== authoringCatalogScopeKey)
    ) {
      setMessage(
        'Loom field discovery is refreshing for the current row resource. Preview will be available when it completes.',
      );
      return;
    }
    if (state.catalog.diagnostics.some((item) => item.severity === 'error')) {
      setMessage(
        'The field catalog reported blocking diagnostics. Resolve them before previewing.',
      );
      return;
    }
    const intent = `${previewConfigDigest}|${output}|${previewLimit}|${state.catalog.snapshotToken ?? ''}`;
    if (!force && previewIntent.current === intent) return;
    previewIntent.current = intent;
    let compiledConfig = config;
    let previewConfig = config;
    let digest = '';
    let draftDigestForRequest = '';
    let previewRequestPromise: Promise<ExplorerPreview> | undefined;
    // Mark the intent as loading before asynchronous compilation starts. If
    // compilation itself is rejected, the preview must still leave the
    // "Preparing" state and render a retryable error.
    const provisionalDigest =
      previewConfigDigest || `${output}:${previewLimit}`;
    dispatch({
      type: 'previewLoading',
      output,
      digest: provisionalDigest,
    });
    try {
      // The repository default already contains canonical declarations and
      // Loom rejects the interactive authoring compiler for this Explorer.
      compiledConfig = isDefault
        ? config
        : await compileForOutput(config, output);
      // draftDigest identifies the complete working draft. The request body
      // is output-scoped for Loom's preview compiler, but its concurrency
      // identity must not change merely because the selected table changed.
      draftDigestForRequest = isDefault
        ? ''
        : await digestExplorerConfig(compiledConfig);
      previewConfig = configForOutput(compiledConfig, output);
      digest = await digestExplorerPreview(previewConfig, output, previewLimit);
      const cached = state.previewCache[previewCacheKey(output, digest)];
      if (!force && cached?.status === 'ready' && cached.data) {
        dispatch({
          type: 'previewLoading',
          output,
          digest,
        });
        dispatch({
          type: 'previewReady',
          output,
          digest,
          data: cached.data,
        });
        return;
      }
      const existing = state.preview[output];
      if (
        !force &&
        existing?.digest === digest &&
        existing.status === 'loading'
      )
        return;
      if (commitInFlight.current) return;
      previewAbort.current?.abort?.();
      dispatch({ type: 'previewLoading', output, digest });
      const request = previewDraft({
        project: projectId,
        explorerId: selectedId,
        authResourcePath,
        config: previewConfig,
        output,
        limit: previewLimit,
        ...(draftDigestForRequest
          ? { draftDigest: draftDigestForRequest }
          : {}),
      });
      previewAbort.current = request;
      previewRequestPromise = request.unwrap();
      previewInFlight.current = previewRequestPromise;
      const result = await previewRequestPromise;
      if (result.diagnostics?.some((item) => item.severity === 'error')) {
        throw {
          data: {
            code: 'PREVIEW_VALIDATION_FAILED',
            message: 'Loom returned blocking preview diagnostics.',
            diagnostics: result.diagnostics,
          },
        };
      }
      dispatch({ type: 'previewReady', output, digest, data: result });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        (error as { name?: string }).name === 'AbortError'
      )
        return;
      const details = lifecycleError(error);
      const failure = details.diagnostics.map((item) => item.message).join(' ');
      if (previewIntent.current === intent) previewIntent.current = undefined;
      dispatch({
        type: 'error',
        diagnostics: details.diagnostics,
        conflict: details.conflict,
      });
      setMessage(`Preview request failed: ${failure}`);
      dispatch({
        type: 'previewError',
        output,
        digest: digest || provisionalDigest,
        error: details.diagnostics.map((item) => item.message).join(' '),
      });
    } finally {
      if (previewInFlight.current === previewRequestPromise) {
        previewInFlight.current = undefined;
        previewAbort.current = undefined;
      }
    }
  };
  // Preview is keyed by the digest and selected output; the callback is recreated with the current draft.
  // eslint-disable-next-line reactHooks/exhaustive-deps
  useEffect(() => {
    // Repository defaults preview their canonical packet directly; custom
    // Explorers run the authoring compiler before previewing.
    if (!state.config || (!isDefault && !state.activeConfig)) return;
    const timer = window.setTimeout(() => {
      previewTimer.current = undefined;
      void refreshPreview();
    }, 750);
    previewTimer.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (previewTimer.current === timer) previewTimer.current = undefined;
    };
  }, [
    previewConfigDigest,
    state.selectedOutput,
    previewLimit,
    state.catalog.complete,
    state.catalog.snapshotToken,
    isDefault,
    state.activeConfig,
  ]);

  const cancelPendingPreview = async () => {
    if (previewTimer.current !== undefined) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = undefined;
    }
    previewAbort.current?.abort?.();
    const pending = previewInFlight.current;
    if (!pending) return;
    try {
      await pending;
    } catch {
      // Aborting a preview is expected when a save or publish takes ownership
      // of the project-level materialization path.
    }
  };

  const createCustom = async (from: 'default' | 'blank') => {
    const title = newName.trim();
    const requestedId = slugifyExplorerId(title);
    const startingConfig =
      from === 'default' && isDefault ? state.config : undefined;
    if (!title || !requestedId || requestedId === 'default') {
      newNameRef.current?.focus();
      setMessage('Enter a name for the new Explorer.');
      return;
    }
    if (
      configs.data?.some((candidate) => candidate.explorerId === requestedId)
    ) {
      setMessage(`“${requestedId}” is already in use. Choose another name.`);
      return;
    }
    try {
      const created = await createExplorer({
        project: projectId,
        name: title,
        title,
        from,
        authResourcePath,
      }).unwrap();
      let result = created;
      if (startingConfig) {
        // Create only accepts the source selector. Persist a local copy in the
        // draft endpoint after creation, changing the identity to the new
        // interactive Explorer before sending it to Loom.
        const copiedConfig: ExplorerConfigV2 = {
          ...startingConfig,
          explorer: {
            ...startingConfig.explorer,
            id: created.explorerId,
            title,
            management: 'interactive',
          },
        };
        result = await saveDraft({
          project: projectId,
          explorerId: created.explorerId,
          config: copiedConfig,
          authResourcePath,
          expectedDraftVersion: created.draftVersion,
          expectedDraftDigest: created.draftDigest || undefined,
        }).unwrap();
      }
      setSelectedId(result.explorerId);
      setNewName('');
      setMessage(
        startingConfig
          ? `Created ${title} from the current default configuration.`
          : `Created ${title}.`,
      );
    } catch (error) {
      const details = lifecycleError(error);
      setMessage(
        startingConfig
          ? `Create Explorer request failed while copying the configuration: ${details.diagnostics
              .map((item) => item.message)
              .join(' ')}`
          : `Create Explorer request failed: ${details.diagnostics
              .map((item) => item.message)
              .join(' ')}`,
      );
    }
  };

  const deleteSelectedExplorer = async () => {
    if (selectedId === 'default' || isDeletingExplorer) return;
    const title = selectedConfig?.explorer.title ?? selectedId;
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    try {
      await deleteExplorer({
        project: projectId,
        explorerId: selectedId,
        authResourcePath,
      }).unwrap();
      setSelectedId('default');
      setMessage(`Deleted ${title}.`);
    } catch (error) {
      setMessage(
        `Delete Explorer request failed: ${lifecycleError(error)
          .diagnostics.map((item) => item.message)
          .join(' ')}`,
      );
    }
  };

  const save = async () => {
    if (!state.config || commitInFlight.current) return;
    commitInFlight.current = true;
    dispatch({ type: 'saving' });
    try {
      await cancelPendingPreview();
      const configForSave =
        !isDefault && state.selectedOutput && state.catalog.snapshotToken
          ? await compileForOutput(state.config, state.selectedOutput)
          : state.config;
      const saved = await saveDraft({
        project: projectId,
        explorerId: selectedId,
        config: configForSave,
        authResourcePath,
        expectedDraftVersion: state.draftVersion,
        expectedDraftDigest: state.draftDigest || undefined,
      }).unwrap();
      const config = requireServerConfig(saved);
      const digest = saved.draftDigest || (await digestExplorerConfig(config));
      if (isDefault) {
        const published = await publishExplorer({
          project: projectId,
          explorerId: selectedId,
          authResourcePath,
          expectedDraftVersion: saved.draftVersion,
          expectedDraftDigest: digest,
        }).unwrap();
        const publishedConfig = requirePublishedConfig(published);
        const publishedDigest =
          published.draftDigest ||
          (await digestExplorerConfig(publishedConfig));
        dispatch({
          type: 'published',
          config: publishedConfig,
          revisionId: published.activeRevisionId,
          draftVersion: published.draftVersion,
          draftDigest: publishedDigest,
          publishedAt: published.updatedAt,
          activeUrl: published.activeUrl,
          shareUrl: published.shareUrl,
          lifecycleMetadata: published,
        });
        setMessage('Default Explorer saved and activated.');
        return;
      }
      dispatch({
        type: 'saved',
        config,
        draftVersion: saved.draftVersion,
        draftDigest: digest,
        updatedAt: saved.updatedAt,
        lifecycleMetadata: saved,
      });
      setMessage('Draft saved. The active Explorer is unchanged.');
    } catch (error) {
      const details = lifecycleError(error);
      dispatch({
        type: 'error',
        diagnostics: details.diagnostics,
        conflict: details.conflict,
      });
      setMessage(
        `Save draft request failed. Your local changes are still here: ${details.diagnostics
          .map((item) => item.message)
          .join(' ')}`,
      );
    } finally {
      commitInFlight.current = false;
    }
  };
  const makeLive = async () => {
    if (!state.config || commitInFlight.current) return;
    if (
      !selectedTable?.rootResourceType ||
      !selectedTable.columns.some((column) => column.visible)
    ) {
      setMessage(
        'Choose a row resource and at least one visible column before publishing.',
      );
      return;
    }
    if (!state.catalog.complete) {
      setMessage(
        'Loom field discovery is still running. Wait for the catalog to finish before publishing.',
      );
      return;
    }
    if (state.catalog.diagnostics.some((item) => item.severity === 'error')) {
      setMessage(
        'The field catalog reported blocking diagnostics. Resolve them before publishing.',
      );
      return;
    }
    const referenceDiagnostics = presentationDiagnostics(state.config);
    if (referenceDiagnostics.length > 0) {
      dispatch({ type: 'error', diagnostics: referenceDiagnostics });
      setMessage(
        'Some presentation controls reference unavailable columns or actions. Resolve them before publishing.',
      );
      return;
    }
    let version = state.draftVersion;
    let digest = state.draftDigest;
    let configForSave = state.config;
    const expectedDraftDigest = state.draftDigest || undefined;
    commitInFlight.current = true;
    try {
      await cancelPendingPreview();
      if (!isDefault && state.selectedOutput && state.catalog.snapshotToken) {
        configForSave = await compileForOutput(
          configForSave,
          state.selectedOutput,
        );
        digest = await digestExplorerConfig(configForSave);
      }
      if (!digest) digest = await digestExplorerConfig(configForSave);
      if (state.dirty || configForSave !== state.config) {
        dispatch({ type: 'saving' });
        const saved = await saveDraft({
          project: projectId,
          explorerId: selectedId,
          config: configForSave,
          authResourcePath,
          expectedDraftVersion: version,
          expectedDraftDigest,
        }).unwrap();
        const savedConfig = requireServerConfig(saved);
        version = saved.draftVersion;
        digest = saved.draftDigest || (await digestExplorerConfig(savedConfig));
        configForSave = savedConfig;
        dispatch({
          type: 'saved',
          config: savedConfig,
          draftVersion: version,
          draftDigest: digest,
          updatedAt: saved.updatedAt,
          lifecycleMetadata: saved,
        });
      }
      dispatch({ type: 'publishing' });
      const published = await publishExplorer({
        project: projectId,
        explorerId: selectedId,
        authResourcePath,
        expectedDraftVersion: version,
        expectedDraftDigest: digest,
      }).unwrap();
      const publishedConfig = requirePublishedConfig(published);
      const publishedDigest =
        published.draftDigest || (await digestExplorerConfig(publishedConfig));
      dispatch({
        type: 'published',
        config: publishedConfig,
        revisionId: published.activeRevisionId,
        draftVersion: published.draftVersion,
        draftDigest: publishedDigest,
        publishedAt: published.updatedAt,
        activeUrl: published.activeUrl,
        shareUrl: published.shareUrl,
        lifecycleMetadata: published,
      });
      setMessage('Published successfully. Your Explorer URL is ready below.');
    } catch (error) {
      const details = lifecycleError(error);
      dispatch({
        type: 'error',
        diagnostics: details.diagnostics,
        conflict: details.conflict,
      });
      setMessage(
        `Publication request failed. The previous active Explorer remains available: ${details.diagnostics
          .map((item) => item.message)
          .join(' ')}`,
      );
    } finally {
      commitInFlight.current = false;
    }
  };
  const addTable = () => {
    const title = window.prompt('Table name');
    if (!title?.trim()) return;
    const output = slugifyExplorerId(title) || `table-${tableList.length + 1}`;
    if (tableList.some((table) => table.output === output)) {
      setMessage('That table name is already in use.');
      return;
    }
    dispatch({ type: 'addTable', output, title: title.trim() });
  };
  const duplicateTable = () => {
    if (!selectedTable) return;
    const base = `${selectedTable.output}-copy`;
    let output = base;
    let suffix = 2;
    while (tableList.some((table) => table.output === output))
      output = `${base}-${suffix++}`;
    dispatch({
      type: 'duplicateTable',
      output,
      sourceOutput: selectedTable.output,
      title: `${selectedTable.title} copy${suffix > 2 ? ` ${suffix - 1}` : ''}`,
    });
  };
  const reloadServer = async () => {
    try {
      const result = await configs.refetch().unwrap();
      const serverState = result.find(
        (candidate) => candidate.explorerId === selectedId,
      );
      const serverConfig = serverState
        ? configForBuilder(serverState, selectedId === 'default')
        : undefined;
      if (!serverState || !serverConfig) {
        setMessage(
          'The selected Explorer is no longer available in the authenticated listing.',
        );
        return;
      }
      const next = await initialStateFromConfig(
        projectId,
        { ...state, explorerId: selectedId },
        serverConfig,
        serverState.draftVersion ?? 0,
        serverState.draftDigest,
        activeConfigFromServer(serverState) ?? null,
        serverState.updatedAt,
        serverState,
      );
      dispatch({ type: 'load', state: next });
      setMessage(
        'Reloaded the current server draft. Your local changes were not sent.',
      );
    } catch (error) {
      setMessage(
        `Reload request failed: ${lifecycleError(error)
          .diagnostics.map((item) => item.message)
          .join(' ')}`,
      );
    }
  };
  if (configs.isLoading)
    return (
      <main className="p-6" role="status">
        Loading Explorer Builder…
      </main>
    );
  if (configs.isError)
    return (
      <main className="p-6" role="alert">
        Explorer configuration could not be loaded. Check your project access
        and try again.
      </main>
    );
  if (
    !(configs.data ?? []).some(
      (candidate) => candidate.explorerId === 'default',
    )
  )
    return (
      <main className="p-6" role="alert">
        The authenticated Explorer listing did not include the repository
        default. The Builder cannot select an authoritative starting
        configuration.
      </main>
    );
  if (selectedId === 'default' && selectedServerState && !selectedConfig)
    return (
      <main className="p-6" role="status">
        The repository default configuration is not available yet. Its
        executable recipe is still managed by ETL, but browser presentation
        edits will be stored separately when the configuration is available.
      </main>
    );
  if (!selectedServerState || !selectedConfig)
    return (
      <main className="p-6" role="status">
        Loading the selected Explorer configuration…
      </main>
    );
  // The default recipe/source remains repository-managed by ETL/Git-DRS, but
  // its Explorer presentation is editable in the browser. Browser saves do
  // not participate in Git-DRS history or interactive Explorer CAS.
  const interactionDisabled = false;
  const commitBusy =
    state.lifecycle === 'saving' ||
    state.lifecycle === 'publishing' ||
    isSavingDraftRequest ||
    isPublishingRequest;
  const primaryActionLabel = commitBusy ? 'Publishing…' : 'Publish';
  const primaryDiagnostic = state.diagnostics[0];
  const diagnosticsAreErrors = state.diagnostics.some(
    (item) => item.severity === 'error',
  );
  const diagnosticMessage = primaryDiagnostic?.message ?? message;
  const diagnosticCode = primaryDiagnostic?.code;
  const catalogNeedsRetry = state.catalog.diagnostics.some(
    (item) => item.severity === 'error',
  );
  const previewState = state.selectedOutput
    ? state.preview[state.selectedOutput]
    : undefined;
  const previewBusy = previewState?.status === 'loading';
  const previewMissingRequirements =
    !selectedTable?.rootResourceType ||
    !selectedTable.columns.some((column) => column.visible);
  const diagnosticHeading =
    diagnosticCode === 'AUTHENTICATION_REQUIRED'
      ? 'Sign in required'
      : diagnosticCode === 'NOT_FOUND'
        ? 'Builder service unavailable'
        : diagnosticCode === 'INVALID_REQUEST'
          ? 'Table definition needs attention'
          : diagnosticCode === 'CATALOG_DISCOVERY_FAILED'
            ? 'Field discovery unavailable'
            : diagnosticsAreErrors ||
                /failed|not found|could not|error/i.test(message ?? '')
              ? 'Builder needs attention'
              : 'Last operation';
  const explorerToolbar = (
    <div className="flex min-w-0 items-center gap-2">
      <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-600">
        <span className="sr-only">Explorer</span>
        <span className="flex items-center gap-1">
          <select
            aria-label="Explorer"
            className="max-w-56 appearance-none rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            style={{
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: 'none',
            }}
            value={selectedId}
            onChange={(event) => setSelectedId(event.currentTarget.value)}
          >
            {(configs.data ?? []).map((candidate) => (
              <option key={candidate.explorerId} value={candidate.explorerId}>
                {configFromServer(candidate)?.explorer.title ??
                  candidate.explorerId}
                {candidate.explorerId === 'default'
                  ? ' · repository default'
                  : ' · custom'}
              </option>
            ))}
          </select>
          <button
            type="button"
            aria-label={
              selectedId === 'default'
                ? 'The repository default cannot be deleted'
                : `Delete ${selectedConfig?.explorer.title ?? selectedId}`
            }
            className="rounded p-1 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={
              selectedId === 'default' || isDeletingExplorer || commitBusy
            }
            title={
              selectedId === 'default'
                ? 'The repository default cannot be deleted.'
                : 'Delete this Explorer'
            }
            onClick={() => void deleteSelectedExplorer()}
          >
            <IconTrash size={16} stroke={1.8} aria-hidden="true" />
          </button>
        </span>
      </label>
      <details className="relative shrink-0">
        <summary className="cursor-pointer list-none rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
          New Explorer
        </summary>
        <div className="absolute left-0 top-full z-40 mt-1 w-80 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <div className="text-sm font-semibold text-slate-800">
            Create a custom Explorer
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Choose a name, then start with the default configuration or an empty
            one. The name becomes the Explorer’s URL ID.
          </p>
          <label className="mt-3 block text-xs font-medium text-slate-600">
            Name
            <input
              aria-label="New Explorer name"
              ref={newNameRef}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm outline-blue-500"
              value={newName}
              onChange={(event) => setNewName(event.currentTarget.value)}
              placeholder="e.g. Biospecimen review"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-500">
            URL ID (generated from name):{' '}
            <code className="rounded bg-slate-100 px-1 text-slate-700">
              {derivedId || '—'}
            </code>
          </p>
          <div className="mt-3 space-y-1.5">
            <button
              type="button"
              className="block w-full rounded bg-blue-700 px-3 py-2 text-left text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isCreatingExplorer || isSavingDraftRequest}
              onClick={() => void createCustom('default')}
            >
              <span className="block">Start from the default</span>
              <span className="mt-0.5 block font-normal text-blue-100">
                Copy the current default configuration into this Explorer.
              </span>
            </button>
            <button
              type="button"
              className="block w-full rounded border border-slate-300 px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isCreatingExplorer || isSavingDraftRequest}
              onClick={() => void createCustom('blank')}
            >
              <span className="block">Start blank</span>
              <span className="mt-0.5 block font-normal text-slate-500">
                Create an empty Explorer and configure it yourself.
              </span>
            </button>
          </div>
        </div>
      </details>
      {state.lifecycle === 'published' && (
        <a
          className="ml-1 shrink-0 rounded border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-800 hover:bg-blue-50"
          href={`/Explorer/${encodeURIComponent(projectId)}?explorerId=${encodeURIComponent(selectedId)}`}
        >
          Open Explorer
        </a>
      )}
    </div>
  );
  return (
    <>
      {builderToolbarHost
        ? createPortal(explorerToolbar, builderToolbarHost)
        : null}
      <main className="min-h-screen bg-slate-50 p-2 text-slate-900 sm:p-3">
        <header className="sticky top-0 z-30 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-sm backdrop-blur sm:p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <label className="flex items-center text-xs font-medium text-slate-600">
              Table
              <div className="relative ml-2 min-w-52">
                <div className="flex items-center rounded border border-slate-300 bg-white text-sm">
                  <input
                    aria-label="Table name"
                    className="min-w-0 flex-1 bg-transparent px-2 py-1 outline-none"
                    value={selectedTable?.title ?? ''}
                    readOnly={interactionDisabled || !selectedTable}
                    placeholder="Select table"
                    onChange={(event) => {
                      if (!selectedTable) return;
                      dispatch({
                        type: 'renameTable',
                        output: selectedTable.output,
                        title: event.currentTarget.value,
                      });
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Open table list"
                    aria-expanded={tableSelectorOpen}
                    className="px-2 py-1 text-slate-400 hover:text-slate-700"
                    onClick={() => setTableSelectorOpen((open) => !open)}
                  >
                    ▾
                  </button>
                </div>
                {tableSelectorOpen && (
                  <div className="absolute left-0 top-full z-40 mt-1 min-w-64 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                    <ol
                      role="listbox"
                      aria-label="Explorer tables"
                      className="space-y-1"
                    >
                      {tableList.map((table, index) => {
                        const active = state.selectedOutput === table.output;
                        const dropTarget = tableDropTarget === table.output;
                        return (
                          <li key={table.output}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={active}
                              aria-label={`${table.title}. Drag to reorder.`}
                              draggable={!interactionDisabled}
                              className={`flex w-full cursor-grab items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs font-medium transition active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50 ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-50'} ${dropTarget ? 'ring-2 ring-blue-300 ring-inset' : ''} ${draggingTableOutput === table.output ? 'opacity-50' : ''}`}
                              onClick={() => {
                                dispatch({
                                  type: 'selectOutput',
                                  output: table.output,
                                });
                                setTableSelectorOpen(false);
                              }}
                              onDragStart={(event) => {
                                if (interactionDisabled) return;
                                event.dataTransfer.effectAllowed = 'move';
                                event.dataTransfer.setData(
                                  'text/plain',
                                  table.output,
                                );
                                setDraggingTableOutput(table.output);
                                setTableDropTarget(undefined);
                              }}
                              onDragOver={(event) => {
                                if (
                                  interactionDisabled ||
                                  !draggingTableOutput ||
                                  draggingTableOutput === table.output
                                )
                                  return;
                                event.preventDefault();
                                event.dataTransfer.dropEffect = 'move';
                                setTableDropTarget(table.output);
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                if (
                                  !interactionDisabled &&
                                  draggingTableOutput &&
                                  draggingTableOutput !== table.output
                                ) {
                                  const bounds =
                                    event.currentTarget.getBoundingClientRect();
                                  const droppedAfter =
                                    event.clientY >
                                    bounds.top + bounds.height / 2;
                                  const before = droppedAfter
                                    ? tableList[index + 1]?.output
                                    : table.output;
                                  if (before !== draggingTableOutput)
                                    dispatch({
                                      type: 'reorderTable',
                                      output: draggingTableOutput,
                                      before,
                                    });
                                }
                                setDraggingTableOutput(undefined);
                                setTableDropTarget(undefined);
                              }}
                              onDragEnd={() => {
                                setDraggingTableOutput(undefined);
                                setTableDropTarget(undefined);
                              }}
                            >
                              <IconGripVertical
                                size={13}
                                stroke={1.8}
                                aria-hidden="true"
                              />
                              <span className="truncate">{table.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            </label>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              disabled={interactionDisabled}
              title={
                interactionDisabled
                  ? 'The repository default is read-only.'
                  : 'Add a new table to this local Builder session'
              }
              onClick={addTable}
            >
              New table
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs"
              disabled={interactionDisabled || !selectedTable}
              title={
                !selectedTable
                  ? 'Select a table before duplicating it.'
                  : 'Duplicate the selected table'
              }
              onClick={duplicateTable}
            >
              Duplicate table
            </button>
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs text-red-700"
              disabled={interactionDisabled || tableList.length <= 1}
              title={
                tableList.length <= 1
                  ? 'Keep at least one table.'
                  : 'Delete the selected table'
              }
              onClick={() => {
                if (
                  state.selectedOutput &&
                  window.confirm(
                    `Delete ${selectedTable?.title ?? 'this table'}?`,
                  )
                )
                  dispatch({
                    type: 'removeTable',
                    output: state.selectedOutput,
                  });
              }}
            >
              Delete table
            </button>
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              <>
                <button
                  type="button"
                  aria-busy={previewBusy}
                  className="inline-flex items-center gap-2 rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    previewMissingRequirements ||
                    previewBusy ||
                    commitBusy ||
                    authoringCatalog.isFetching
                  }
                  title={
                    previewMissingRequirements
                      ? 'Choose a row resource and at least one visible column before previewing.'
                      : authoringCatalog.isFetching
                        ? 'Field discovery is still running.'
                        : 'Compile the current draft and load a fresh sample of rows.'
                  }
                  onClick={() => void refreshPreview(true)}
                >
                  {previewBusy && (
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-slate-700"
                    />
                  )}
                  <span>{previewBusy ? 'Previewing…' : 'Preview'}</span>
                </button>
                <button
                  type="button"
                  aria-busy={commitBusy}
                  className="inline-flex items-center gap-2 rounded border border-blue-300 px-3 py-1.5 text-xs font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!state.dirty || commitBusy}
                  title={
                    commitBusy
                      ? 'Publishing this Explorer. This may take a while while Loom materializes the dataset.'
                      : !state.dirty
                        ? 'There are no unpublished changes to publish.'
                        : 'Publish this Explorer. This may take a while while Loom materializes the dataset.'
                  }
                  onClick={() => void (isDefault ? save() : makeLive())}
                >
                  {commitBusy && (
                    <span
                      aria-hidden="true"
                      className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700"
                    />
                  )}
                  <span>{primaryActionLabel}</span>
                </button>
              </>
            </div>
          </div>
        </header>
        {state.conflict && (
          <section
            role="alert"
            className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900"
          >
            <strong>Another editor saved a newer draft.</strong> Your local
            changes are preserved.{' '}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() => void reloadServer()}
            >
              Reload server version
            </button>{' '}
            <button
              type="button"
              className="ml-2 underline"
              onClick={() =>
                void navigator.clipboard?.writeText(
                  state.config ? canonicalizeExplorerConfig(state.config) : '',
                )
              }
            >
              Copy local configuration
            </button>
          </section>
        )}
        {(state.diagnostics.length > 0 || message) && (
          <section
            role={diagnosticsAreErrors ? 'alert' : 'status'}
            className={`mt-3 rounded-lg border px-3 py-2 text-xs ${diagnosticsAreErrors || /failed|not found|could not|error/i.test(message ?? '') ? 'border-red-300 bg-red-50 text-red-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong>{diagnosticHeading}</strong>
              <span className="min-w-0 flex-1">{diagnosticMessage}</span>
              {catalogNeedsRetry && (
                <button
                  type="button"
                  className="rounded border border-red-300 bg-white px-2 py-1 font-medium text-red-900 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={authoringCatalog.isFetching}
                  onClick={() => void authoringCatalog.refetch()}
                >
                  {authoringCatalog.isFetching
                    ? 'Retrying field discovery…'
                    : 'Retry field discovery'}
                </button>
              )}
            </div>
            {(primaryDiagnostic?.code ||
              primaryDiagnostic?.requestId ||
              primaryDiagnostic?.endpoint ||
              primaryDiagnostic?.fieldPath ||
              state.diagnostics.length > 1) && (
              <details className="mt-1">
                <summary className="cursor-pointer font-medium underline">
                  Technical details
                </summary>
                <div className="mt-1 space-y-1 text-[10px] opacity-80">
                  {primaryDiagnostic?.code && (
                    <div>Code: {primaryDiagnostic.code}</div>
                  )}
                  {primaryDiagnostic?.requestId && (
                    <div>Request: {primaryDiagnostic.requestId}</div>
                  )}
                  {primaryDiagnostic?.endpoint && (
                    <div className="break-all">
                      Endpoint: {primaryDiagnostic.endpoint}
                    </div>
                  )}
                  {primaryDiagnostic?.fieldPath && (
                    <div>Field: {primaryDiagnostic.fieldPath}</div>
                  )}
                  {state.diagnostics.length > 1 && (
                    <ul className="list-disc pl-4">
                      {state.diagnostics.slice(1).map((item, index) => (
                        <li key={`${item.code}-${index}`}>
                          {item.message} ({item.code})
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            )}
          </section>
        )}
        <div className="mt-2 space-y-3">
          <BuilderRenderBoundary
            key={`${selectedId}:${state.selectedOutput ?? ''}`}
          >
            <GuidedGraphWorkspace
              state={state}
              dispatch={dispatch}
              disabled={interactionDisabled}
              readOnly={interactionDisabled}
              resourceSuggestions={resourceSuggestions}
              projectGraph={projectGraph}
              projectGraphStatus={projectGraphStatus}
              projectGraphError={projectGraphError}
            />
          </BuilderRenderBoundary>
          <PreviewTable
            state={state}
            dispatch={dispatch}
            disabled={
              !selectedTable?.rootResourceType ||
              !selectedTable.columns.some((column) => column.visible)
            }
            readOnly={interactionDisabled}
            limit={previewLimit}
            onLimitChange={setPreviewLimit}
          />
          <PresentationPanels
            state={state}
            dispatch={dispatch}
            disabled={interactionDisabled}
          />
        </div>
      </main>
    </>
  );
};

export default BuilderWorkspace;
