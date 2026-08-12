import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BaseEdge,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type EdgeProps,
} from '@xyflow/react';
import type {
  ExplorerAuthoringDocument,
  JSONValue,
  RecipeAuthoringDocument,
  RecipeDraftPreview,
  RecipeColumnCandidate,
  RecipeColumnCandidateConnection,
  SemanticConcept,
  SemanticConceptCatalog,
} from '@gen3/core';
import { fetchRecipeColumnCandidates, fetchSemanticConceptCatalog } from '@gen3/core';
import {
  type FhirFieldHint,
  type FhirProjectMap,
  type FhirTraversalHint,
  scanFhirProjectMap,
} from './fhirProjectMap';
import { ExplorerSamplePreview } from '../sample/ExplorerSamplePreview';
import { layoutDatasetGraph, type GraphLayoutResult } from './graphLayout';
import {
  familyLabel,
  conceptSelectionsFor,
  isPartialSemanticCatalog,
  recipeFamilyLabel,
  semanticCatalogAvailability,
  semanticConceptDisambiguator,
  semanticConceptsFor,
  semanticFieldRefForPath,
  semanticFieldsFor,
  semanticResourceFor,
} from './semanticConcepts';

type RecipeOutput = Record<string, JSONValue>;

const edgeId = (edge: FhirTraversalHint) =>
  `${edge.fromType}/${edge.label}/${edge.toType}`;

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
);

const edgeTypes = { routed: RoutedEdge };

/** Refit after a pane resize; React Flow resizes its canvas but does not
 * automatically recompute the viewport that made the graph readable. */
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
        // Favor legible cards on first load. Users can pan to surrounding
        // resources; an unreadable all-nodes thumbnail is not useful.
        graph.fitView({ padding: 0.06, minZoom: 0.38, maxZoom: 1.15, duration: 160 });
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

const asRecord = (value: JSONValue | undefined): Record<string, JSONValue> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, JSONValue>)
    : {};

const outputsOf = (document: RecipeAuthoringDocument): RecipeOutput[] =>
  Array.isArray(document.outputs)
    ? document.outputs.filter(
        (item): item is RecipeOutput =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item),
      )
    : [];

const titleFor = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const friendlyResourceLabels = {
  Patient: 'People',
  ResearchSubject: 'Study participants',
  Specimen: 'Biospecimens',
  DocumentReference: 'Files and documents',
  Observation: 'Measurements and findings',
  Condition: 'Diagnoses and conditions',
  DiagnosticReport: 'Diagnostic reports',
  Procedure: 'Procedures',
  MedicationAdministration: 'Medications given',
  Medication: 'Medications',
  BodyStructure: 'Body sites',
  Group: 'Groups and cohorts',
} as const;

const resourceLabel = (resourceType: string) =>
  friendlyResourceLabels[
    resourceType as keyof typeof friendlyResourceLabels
  ] ?? titleFor(resourceType);

export const rowGrainForResource = (resourceType: string): string => {
  switch (resourceType.trim()) {
    case 'Patient':
      return 'patient';
    case 'Specimen':
      return 'specimen';
    case 'DocumentReference':
      return 'file';
    case 'Condition':
      return 'diagnosis';
    case 'Observation':
      return 'observation';
    case 'ResearchSubject':
      return 'study_enrollment';
    default:
      return 'resource';
  }
};

const resolveResourceType = (
  nodes: FhirProjectMap['nodes'],
  candidate: string,
) => {
  const normalized = candidate.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return (
    nodes.find(
      (node) =>
        node.resourceType.replace(/[^A-Za-z0-9]/g, '').toLowerCase() ===
        normalized,
    )?.resourceType ??
    (normalized.length >= 5
      ? nodes.find((node) =>
          node.resourceType
            .replace(/[^A-Za-z0-9]/g, '')
            .toLowerCase()
            .endsWith(normalized),
        )?.resourceType
      : undefined)
  );
};

const shortFieldPath = (field: FhirFieldHint, resourceType: string) => {
  // `valuePath` is only the value portion of a structured Loom selector. The
  // catalog's `path` is the canonical FHIR path; when older servers omit it,
  // derive a complete path from sourcePath + valuePath instead of treating the
  // value path as a root-relative selector.
  const sourcePath = field.selector?.sourcePath?.trim();
  const valuePath = field.selector?.valuePath?.trim();
  const structuredPath = sourcePath && valuePath
    ? sourcePath.endsWith(valuePath)
      ? sourcePath
      : `${sourcePath.replace(/\.$/, '')}.${valuePath.replace(/^\./, '')}`
    : sourcePath || undefined;
  const candidate = field.path?.trim() || structuredPath || field.fieldRef;
  return candidate
    .replace(new RegExp(`^${resourceType}[./]`), '')
    .replace(/^root\./, '')
    .replace(/^\./, '');
};

const normalizedFieldPath = (field: FhirFieldHint, resourceType: string) =>
  shortFieldPath(field, resourceType)
    .replace(/\[(?:\d+)?\]/g, '[]')
    .replace(/\.\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');

/**
 * Keep selectable data columns at the leaves of the populated FHIR catalog.
 * Loom can return both a structural object (for example `name`) and its
 * populated values (`name.family`, `name.given`). Selecting the container
 * would produce an opaque object column, so it is useful context in the
 * graph but not a steward-facing column choice.
 */
export const dataFieldsFor = (
  fields: ReadonlyArray<FhirFieldHint>,
  resourceType: string,
): ReadonlyArray<FhirFieldHint> => {
  const paths = fields.map((field) => normalizedFieldPath(field, resourceType));
  return fields.filter((field, index) => {
    const path = paths[index];
    if (!path) return false;
    return !paths.some((candidate, candidateIndex) =>
      candidateIndex !== index &&
      (candidate.startsWith(`${path}.`) || candidate.startsWith(`${path}[]`)),
    );
  });
};

const fieldName = (path: string, index: number, stableName?: string) => {
  if (stableName?.trim()) return stableName.trim();
  const finalSegment = path
    .replace(/\[\]/g, '')
    .split('.')
    .filter(Boolean)
    .at(-1)
    ?.replace(/[^A-Za-z0-9_]/g, '_');
  return finalSegment || `field_${index + 1}`;
};

const outputNameFor = (resourceType: string) =>
  resourceType.endsWith('s') ? resourceType : `${resourceType}s`;

const safeAlias = (resourceType: string, used: Set<string>) => {
  const base = resourceType.replace(/[^A-Za-z0-9]/g, '_').toLowerCase() || 'related';
  let alias = base;
  let suffix = 2;
  while (used.has(alias) || alias === 'root') alias = `${base}_${suffix++}`;
  used.add(alias);
  return alias;
};

const defaultFields = (
  fields: ReadonlyArray<FhirFieldHint>,
  resourceType?: string,
) =>
  (resourceType ? dataFieldsFor(fields, resourceType) : fields)
    .filter((field) => Boolean(field.fieldRef))
    .sort((left, right) => {
      const leftId = /(^|\.)id$/i.test(left.fieldRef) ? -1 : 0;
      const rightId = /(^|\.)id$/i.test(right.fieldRef) ? -1 : 0;
      return leftId - rightId;
    })
    .slice(0, 6)
    .map((field) => field.fieldRef);

const uniqueFieldNames = (fields: ReadonlyArray<FhirFieldHint>, resourceType: string) => {
  const used = new Set<string>();
  return fields.map((field, index) => {
    const base = fieldName(shortFieldPath(field, resourceType), index, field.columnName);
    let name = base;
    let suffix = 2;
    while (used.has(name)) name = `${base}_${suffix++}`;
    used.add(name);
    return name;
  });
};

const candidateField = (candidate: RecipeColumnCandidate): FhirFieldHint => ({
  fieldRef: candidate.id,
  label: candidate.label,
  // Keep the raw key in the picker. `valueSelector` may already be qualified
  // with a traversal alias and is only appropriate when lowering the recipe.
  path: candidate.rawKey || candidate.valueSelector,
  columnName: candidate.publicName,
  selector: { valuePath: candidate.valueSelector },
  recipeCandidate: candidate,
});

const candidateNodePath = (
  output: RecipeOutput | undefined,
  resourceType: string,
): ReadonlyArray<string> | undefined => {
  if (!output || typeof output.rootResourceType !== 'string') return undefined;
  if (output.rootResourceType === resourceType) return [];
  const visit = (
    traversals: ReadonlyArray<JSONValue>,
    path: ReadonlyArray<string>,
  ): ReadonlyArray<string> | undefined => {
    for (const traversalValue of traversals) {
      const traversal = asRecord(traversalValue);
      const alias = typeof traversal.alias === 'string' ? traversal.alias : '';
      const target = typeof traversal.toResourceType === 'string' ? traversal.toResourceType : '';
      if (!alias || !target) continue;
      const nextPath = [...path, alias];
      if (target === resourceType) return nextPath;
      const nested = Array.isArray(traversal.traversals)
        ? visit(traversal.traversals, nextPath)
        : undefined;
      if (nested) return nested;
    }
    return undefined;
  };
  return visit(Array.isArray(output.traversals) ? output.traversals : [], []);
};

const selectedNativeCandidates = (
  node: Record<string, JSONValue>,
  candidates: ReadonlyArray<RecipeColumnCandidate>,
  selected: ReadonlyArray<string>,
): Record<string, JSONValue> => {
  if (candidates.length === 0) return node;
  // Once this node is controlled by the recipe-aware picker, its native
  // declarations are the only selection source. Keeping the old root-level
  // concept list here would make Loom compile the same selection twice.
  const { conceptSelections: _legacyConceptSelections, ...nodeWithoutLegacySelections } = node;
  const selectedCandidates = candidates.filter((candidate) => selected.includes(candidate.id));
  const ordinary = selectedCandidates.filter((candidate) =>
    candidate.familyKind === 'FIELD' || candidate.familyKind === 'CATALOG_PROJECTION',
  );
  const selectedByFamily = new Map<string, RecipeColumnCandidate[]>();
  for (const candidate of selectedCandidates) {
    const key = `${candidate.familyKind}:${candidate.familyName}`;
    selectedByFamily.set(key, [...(selectedByFamily.get(key) ?? []), candidate]);
  }
  const candidatesByFamily = new Map<string, RecipeColumnCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.familyKind}:${candidate.familyName}`;
    candidatesByFamily.set(key, [...(candidatesByFamily.get(key) ?? []), candidate]);
  }
  const updateFamily = (key: 'dynamicColumns' | 'pivots', kind: 'DYNAMIC' | 'PIVOT') =>
    (Array.isArray(node[key]) ? node[key].map(asRecord) : []).map((family) => {
      const name = typeof family.name === 'string' ? family.name : '';
      const familyKey = `${kind}:${name}`;
      if (!candidatesByFamily.has(familyKey)) return family;
      return { ...family, columnMode: 'SELECTED', columns: (selectedByFamily.get(familyKey) ?? []).map((candidate) => candidate.selectionKey) };
    });
  const extensions = (Array.isArray(node.extensionColumns) ? node.extensionColumns.map(asRecord) : []).map((family) => {
    const name = typeof family.name === 'string' ? family.name : '';
    const familyKey = `EXTENSION:${name}`;
    if (!candidatesByFamily.has(familyKey)) return family;
    return {
      ...family,
      columnMode: 'SELECTED',
      columns: (selectedByFamily.get(familyKey) ?? []).flatMap((candidate) => {
        if (!candidate.extensionMapping) return [];
        try {
          const parsed: unknown = JSON.parse(candidate.extensionMapping);
          return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? [parsed as JSONValue] : [];
        } catch {
          return [];
        }
      }),
    };
  });
  // Catalog projections are discovery-only declarations. Once one of their
  // leaves is chosen, lower all of the offered leaves as ordinary fields and
  // remove the projection so it cannot rediscover extra columns later.
  const controlsCatalogProjections = candidates.some((candidate) => candidate.familyKind === 'CATALOG_PROJECTION');
  return {
    ...nodeWithoutLegacySelections,
    fields: ordinary.map((candidate) => ({ name: candidate.selectionKey, expr: { select: candidate.valueSelector } })),
    ...(controlsCatalogProjections ? { catalogProjections: [] } : {}),
    dynamicColumns: updateFamily('dynamicColumns', 'DYNAMIC'),
    pivots: updateFamily('pivots', 'PIVOT'),
    extensionColumns: extensions,
  };
};

const mapFromRecipe = (document: RecipeAuthoringDocument): FhirProjectMap => {
  const nodes = new Map<string, { resourceType: string; documentCount?: number; fields: FhirFieldHint[]; traversals: [] }>();
  for (const output of outputsOf(document)) {
    const resourceType = typeof output.rootResourceType === 'string' ? output.rootResourceType : '';
    if (!resourceType) continue;
    const fields = Array.isArray(output.fields)
      ? output.fields.map(asRecord).map((field) => {
          const expr = asRecord(field.expr);
          const select = typeof expr.select === 'string' ? expr.select.replace(/^root\./, '') : '';
          return {
            fieldRef: `${resourceType}.${select}`,
            label: typeof field.name === 'string' ? titleFor(field.name) : select,
            path: select,
            selector: { valuePath: select },
          };
        }).filter((field) => field.path)
      : [];
    nodes.set(resourceType, { resourceType, fields, traversals: [] });
  }
  return { nodes: [...nodes.values()], edges: [] };
};

const selectedOutputOf = (document: RecipeAuthoringDocument) => outputsOf(document)[0];

const outputKey = (output: RecipeOutput | undefined) =>
  typeof output?.name === 'string' ? output.name : undefined;

const outputId = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') || 'table';

const recipeFieldRef = (
  field: Record<string, JSONValue>,
  resourceType: string,
  catalog: SemanticConceptCatalog | null,
  selections: ReadonlyArray<Record<string, JSONValue>> = [],
) => {
  const concepts = semanticConceptsFor(catalog, resourceType);
  const conceptId = typeof field.conceptId === 'string' ? field.conceptId : '';
  if (conceptId && concepts.some((concept) => concept.id === conceptId)) return conceptId;
  const columnName = typeof field.columnName === 'string'
    ? field.columnName
    : typeof field.name === 'string' ? field.name : '';
  const selection = selections.find((candidate) => candidate.columnName === columnName);
  const selectedConceptId = typeof selection?.conceptId === 'string' ? selection.conceptId : '';
  if (selectedConceptId && concepts.some((concept) => concept.id === selectedConceptId)) return selectedConceptId;
  const expression = asRecord(field.expr);
  const path = typeof expression.select === 'string'
    ? expression.select.replace(/^root\./, '')
    : '';
  return semanticFieldRefForPath(catalog, resourceType, path) ?? '';
};

const renameTraversalField = (traversals: JSONValue[], column: string, value: string): JSONValue[] =>
  traversals.map((candidate) => {
    const traversal = asRecord(candidate);
    const alias = typeof traversal.alias === 'string' ? traversal.alias : '';
    const prefix = alias ? `${alias}__` : '';
    const fields = Array.isArray(traversal.fields) ? traversal.fields.map(asRecord) : [];
    const nextFields = fields.map((field) => {
      const name = typeof field.name === 'string' ? field.name : '';
      return column === `${prefix}${name}` ? { ...field, name: value } : field;
    });
    const nested = Array.isArray(traversal.traversals)
      ? renameTraversalField(traversal.traversals, column, value)
      : traversal.traversals;
    return { ...traversal, fields: nextFields, ...(nested ? { traversals: nested } : {}) };
  });

const hydrateRecipeTraversal = (
  output: RecipeOutput,
  map: FhirProjectMap,
  root: string,
  catalog: SemanticConceptCatalog | null,
) => {
  const path: FhirTraversalHint[] = [];
  const fieldsByNode: Record<string, string[]> = {};
  const visit = (parent: string, traversals: JSONValue[]) => {
    for (const candidate of traversals) {
      const traversal = asRecord(candidate);
      const child = typeof traversal.toResourceType === 'string' ? traversal.toResourceType : '';
      const label = typeof traversal.name === 'string' ? traversal.name : '';
      const edge = map.edges.find((item) => item.fromType === parent && item.toType === child && item.label === label);
      if (!edge) continue;
      path.push(edge);
      const alias = typeof traversal.alias === 'string' ? traversal.alias : '';
      const selections = Array.isArray(traversal.conceptSelections)
        ? traversal.conceptSelections.map(asRecord)
        : [];
      const selected = Array.isArray(traversal.fields) ? traversal.fields.map(asRecord).map((field) => {
        const expression = asRecord(field.expr);
        const select = typeof expression.select === 'string' ? expression.select.replace(new RegExp(`^${alias}\\.`), '') : '';
        const node = map.nodes.find((item) => item.resourceType === child);
        return recipeFieldRef(field, child, catalog, selections) || (node?.fields.find((fieldHint) => shortFieldPath(fieldHint, child) === select)?.fieldRef ?? '');
      }).filter(Boolean) : [];
      fieldsByNode[child] = selected;
      if (Array.isArray(traversal.traversals)) visit(child, traversal.traversals);
    }
  };
  if (Array.isArray(output.traversals)) visit(root, output.traversals);
  return { path, fieldsByNode };
};

const connectedGraph = (
  map: FhirProjectMap,
  root: string,
  depth: number,
) => {
  const distances = new Map<string, number>([[root, 0]]);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDistance = distances.get(current) ?? 0;
    if (currentDistance >= Math.min(depth, 4)) continue;
    for (const edge of map.edges) {
      if (edge.edgeCount <= 0) continue;
      const next = edge.fromType === current
        ? edge.toType
        : edge.toType === current
          ? edge.fromType
          : undefined;
      if (next && !distances.has(next)) {
        distances.set(next, currentDistance + 1);
        queue.push(next);
      }
    }
  }
  // A disconnected resource cannot participate in a traversal. Keep the
  // canvas focused on resources that have at least one currently visible
  // relationship instead of presenting floating, unactionable cards.
  const connectedTypes = new Set(
    map.edges
      .filter((edge) => edge.edgeCount > 0)
      .flatMap((edge) => [edge.fromType, edge.toType]),
  );
  const nodes = map.nodes.filter((node) => connectedTypes.has(node.resourceType));
  const edges = map.edges.filter(
    (edge) =>
      edge.edgeCount > 0,
  );
  return { nodes, edges, distances };
};

const FlowGraph = ({
  map,
  root,
  depth,
  selectedPath,
  selectedNodeType,
  onNodeSelect,
  reachableEdgeIds,
  onEdgeSelect,
  onPaneClick,
  showSparseData,
  disabled,
}: {
  readonly map: FhirProjectMap;
  readonly root: string;
  readonly depth: number;
  readonly selectedPath: ReadonlyArray<FhirTraversalHint>;
  readonly selectedNodeType: string;
  readonly onNodeSelect: (resourceType: string) => void;
  readonly reachableEdgeIds: ReadonlySet<string>;
  readonly onEdgeSelect: (edge: FhirTraversalHint) => void;
  readonly onPaneClick: () => void;
  readonly showSparseData: boolean;
  readonly disabled: boolean;
  readonly recipeSource?: 'platform-default' | 'project-draft';
}) => {
  const graphViewportRef = useRef<HTMLDivElement>(null);
  const selectedSparseKey = selectedPath
    .filter((edge) => edge.edgeCount < 10)
    .map(edgeId)
    .sort()
    .join('|');
  const graphMap = useMemo(() => {
    if (showSparseData) return map;
    const selectedKeys = new Set(selectedSparseKey.split('|').filter(Boolean));
    const edges = map.edges.filter(
      (edge) =>
        edge.edgeCount >= 10 ||
        selectedKeys.has(edgeId(edge)),
    );
    return {
      nodes: map.nodes,
      edges,
    };
  }, [map, selectedSparseKey, showSparseData]);
  const graph = useMemo(
    () => connectedGraph(graphMap, root, depth),
    [graphMap, root, depth],
  );
  const maxDocuments = Math.max(1, ...graph.nodes.map((node) => node.documentCount ?? 0));
  const nodeDimensions = useMemo(
    () =>
      graph.nodes.map((node) => {
        const scale = Math.sqrt((node.documentCount ?? 0) / maxDocuments);
        return {
          id: node.resourceType,
          width: 190 + Math.round(scale * 55),
          height: 74 + Math.round(scale * 18),
        };
      }),
    [graph.nodes, maxDocuments],
  );
  const [layout, setLayout] = useState<GraphLayoutResult>();
  useEffect(() => {
    let current = true;
    setLayout(undefined);
    void layoutDatasetGraph(
      nodeDimensions,
      graph.edges.map((edge) => ({
        id: edgeId(edge),
        source: edge.fromType,
        target: edge.toType,
      })),
    ).then((nextLayout) => {
      if (current) setLayout(nextLayout);
    });
    return () => {
      current = false;
    };
  }, [graph.edges, nodeDimensions]);

  if (graph.nodes.length === 0) return null;
  if (!layout) {
    return <div role="status" className="mt-3 flex h-full items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-600">Arranging the dataset graph…</div>;
  }
  const nodes = graph.nodes.map((node) => {
    const scale = Math.sqrt((node.documentCount ?? 0) / maxDocuments);
    const isRoot = node.resourceType === root;
    const isSelected = node.resourceType === selectedNodeType;
    const isInPath = isRoot || selectedPath.some((edge) => edge.toType === node.resourceType);
    const isReachable = graph.edges.some((edge) =>
      edge.toType === node.resourceType && reachableEdgeIds.has(edgeId(edge)),
    );
    return {
      id: node.resourceType,
      data: {
        label: `${resourceLabel(node.resourceType)}${isRoot ? '  ·  ROW START' : isInPath ? '  ·  IN TABLE' : isReachable ? '  ·  NEXT' : ''}${resourceLabel(node.resourceType) !== titleFor(node.resourceType) ? `\n${titleFor(node.resourceType)}` : ''}${node.documentCount ? `  ·  ${node.documentCount.toLocaleString()} records` : ''}${node.fields.length ? `\n${node.fields.length} available data columns` : ''}`,
      },
      position: layout.positions.get(node.resourceType) ?? { x: 0, y: 0 },
      style: {
        width: 190 + Math.round(scale * 55),
        minHeight: 74 + Math.round(scale * 18),
        border: isSelected ? '3px solid #7c3aed' : isInPath ? '3px solid #2f5aac' : isReachable ? '3px solid #16a34a' : '1px solid #94a3b8',
        borderRadius: 12,
        background: isSelected ? '#f3e8ff' : isInPath ? '#dbeafe' : isReachable ? '#f0fdf4' : `rgba(255,255,255,${0.82 + scale * 0.18})`,
        boxShadow: isInPath || isSelected || isReachable ? '0 8px 24px rgba(30,64,175,.18)' : '0 3px 10px rgba(15,23,42,.08)',
        opacity: isInPath || isSelected || isReachable ? 1 : 0.3,
        padding: 12,
        whiteSpace: 'pre-line' as const,
        cursor: 'pointer',
        fontWeight: isInPath || isSelected || isReachable ? 600 : 500,
      },
    };
  });
  const maxEdgeCount = Math.max(1, ...graph.edges.map((edge) => edge.edgeCount));
  const edges = graph.edges.map((edge) => ({
    id: edgeId(edge),
    source: edge.fromType,
    target: edge.toType,
    type: 'routed',
    data: { path: layout.routes.get(edgeId(edge)) },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#475569', width: 14, height: 14 },
    interactionWidth: 24,
    animated: false,
    style: (() => {
      const selected = selectedPath.some((candidate) => candidate.fromType === edge.fromType && candidate.toType === edge.toType && candidate.label === edge.label);
      const reachable = reachableEdgeIds.has(edgeId(edge));
      const weight = 1.25 + 6 * Math.sqrt(edge.edgeCount / maxEdgeCount);
      return { stroke: selected ? '#2563eb' : reachable ? '#16a34a' : '#64748b', strokeWidth: selected ? weight + 2 : reachable ? weight + 1 : weight, opacity: selected || reachable ? 1 : 0.12 + 0.24 * Math.sqrt(edge.edgeCount / maxEdgeCount) };
    })(),
  }));
  const graphIdentity = `${graph.nodes.map((node) => node.resourceType).sort().join(',')}|${graph.edges.map(edgeId).sort().join(',')}`;
  return (
    <>
    <div ref={graphViewportRef} aria-label="Populated FHIR relationship graph" className="relative mt-3 h-full min-h-0 w-full rounded-xl border border-slate-200 bg-slate-50 shadow-inner">
      <ReactFlowProvider>
        <GraphViewportFitter hostRef={graphViewportRef} graphIdentity={graphIdentity} />
        <ReactFlow
          fitView
          fitViewOptions={{ padding: 0.06, minZoom: 0.38, maxZoom: 1.15 }}
          nodes={nodes}
          edges={edges}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          onNodeClick={(_, node) => { if (!disabled) onNodeSelect(node.id); }}
          onEdgeClick={(_, edge) => {
            if (disabled) return;
            const candidate = graph.edges.find((item) => edgeId(item) === edge.id);
            if (candidate) onEdgeSelect(candidate);
          }}
          onPaneClick={onPaneClick}
          nodesConnectable={false}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cbd5e1" gap={28} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </ReactFlowProvider>
      <details className="absolute bottom-3 left-14 z-10 max-h-52 max-w-[min(40rem,calc(100%-5rem))] overflow-auto rounded-md border border-slate-300 bg-white/95 text-xs shadow-md">
        <summary className="cursor-pointer px-2 py-1.5 font-semibold text-slate-700">Relationship list &amp; keyboard controls</summary>
        <div className="flex flex-wrap gap-1 border-t p-2" aria-label="FHIR relationship controls">
        {graph.edges.map((edge) => {
          const selected = selectedPath.some((candidate) => candidate.fromType === edge.fromType && candidate.toType === edge.toType && candidate.label === edge.label);
          const actionable = reachableEdgeIds.has(edgeId(edge)) || selected;
          return <button key={`${edge.fromType}-${edge.label}-${edge.toType}`} type="button" disabled={disabled || !actionable} aria-pressed={selected} title={actionable ? 'Inspect this relationship' : 'Choose the preceding dataset first'} className={`rounded border px-2 py-1 ${selected ? 'border-blue-400 bg-blue-50' : actionable ? 'border-green-300 bg-green-50' : 'border-slate-100 text-slate-400'}`} onClick={() => onEdgeSelect(edge)}>
            Inspect {resourceLabel(edge.fromType)} → {resourceLabel(edge.toType)} · {edge.label} · {edge.edgeCount.toLocaleString()} links{!actionable && !selected ? ' · unavailable from current step' : ''}
          </button>;
        })}
        </div>
      </details>
    </div>
    </>
  );
};

export const GuidedBuilder = ({
  organization,
  project,
  recipe,
  explorer,
  disabled,
  recipeSource,
  onRecipeChange,
  onExplorerChange,
  onPreview,
  onRender,
  preview,
  previewStatus,
  previewError,
  previewOutput,
  onRetryPreview,
  onSaveDraft,
  onMakeLive,
}: {
  readonly organization: string;
  readonly project: string;
  readonly recipe: RecipeAuthoringDocument;
  readonly explorer: ExplorerAuthoringDocument;
  readonly disabled: boolean;
  readonly recipeSource?: 'platform-default' | 'project-draft';
  readonly onRecipeChange: (document: RecipeAuthoringDocument) => void;
  readonly onExplorerChange: (document: ExplorerAuthoringDocument) => void;
  readonly onPreview: (output: string, recipe: RecipeAuthoringDocument) => void;
  readonly onRender?: (output: string, recipe: RecipeAuthoringDocument) => void;
  readonly preview?: RecipeDraftPreview;
  readonly previewStatus?: 'idle' | 'loading' | 'ready' | 'error';
  readonly previewError?: string;
  readonly previewOutput?: string;
  readonly onRetryPreview?: () => void;
  readonly onSaveDraft?: () => void;
  readonly onMakeLive?: () => void;
}) => {
  const currentOutput = selectedOutputOf(recipe);
  const currentRoot =
    typeof currentOutput?.rootResourceType === 'string'
      ? currentOutput.rootResourceType
      : '';
  const [projectMap, setProjectMap] = useState<FhirProjectMap>(() =>
    mapFromRecipe(recipe),
  );
  const [semanticCatalog, setSemanticCatalog] = useState<SemanticConceptCatalog | null>(null);
  const [semanticCatalogState, setSemanticCatalogState] = useState<'loading' | 'ready' | 'empty' | 'unavailable'>('loading');
  const [recipeCandidates, setRecipeCandidates] = useState<ReadonlyArray<RecipeColumnCandidate>>([]);
  const [recipeCandidateConnection, setRecipeCandidateConnection] = useState<RecipeColumnCandidateConnection>();
  const [recipeCandidateState, setRecipeCandidateState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  const [scanState, setScanState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedRoot, setSelectedRoot] = useState(currentRoot);
  const [selectedOutputName, setSelectedOutputName] = useState<string | undefined>(outputKey(currentOutput));
  const [selectedNodeType, setSelectedNodeType] = useState(currentRoot);
  const [selectedFields, setSelectedFields] = useState<ReadonlyArray<string>>([]);
  const [selectedFieldsByNode, setSelectedFieldsByNode] = useState<Record<string, ReadonlyArray<string>>>({});
  const [selectedPath, setSelectedPath] = useState<ReadonlyArray<FhirTraversalHint>>([]);
  const [inspectedEdge, setInspectedEdge] = useState<FhirTraversalHint>();
  const [fieldSearch, setFieldSearch] = useState('');
  const [showTechnicalSource, setShowTechnicalSource] = useState(false);
  // Column selection is a first-class workspace, not a transient modal.
  // Keep it visible beside the graph on desktop; graph interactions simply
  // change which node the panel is inspecting.
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [expandedPane, setExpandedPane] = useState<'graph' | 'columns'>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showSparseData, setShowSparseData] = useState(false);
  const [scanAttempt, setScanAttempt] = useState(0);
  const initializedDefaultProject = useRef('');
  const hydratedSelection = useRef('');
  const hydratedCandidateSelection = useRef('');
  const selectedOutputIntent = useRef<string | undefined>(undefined);
  const [tableTitle, setTableTitle] = useState(
    typeof currentOutput?.name === 'string'
      ? titleFor(currentOutput.name)
      : `${titleFor(currentRoot)} overview`,
  );

  useEffect(() => {
    if (!expandedPane) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedPane(undefined);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expandedPane]);

  useEffect(() => {
    const controller = new AbortController();
    setScanState('loading');
    // Loom's ingested graph/catalog identity is the established
    // `<organization>-<project>` dataset key. Recipe drafts remain scoped by
    // Gecko as `<organization>/<project>`; do not mix the two identities.
    void scanFhirProjectMap(`${organization}-${project}`, controller.signal)
      .then((nextMap) => {
        setProjectMap(nextMap);
        setScanState('ready');
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setScanState('error');
      });
    return () => controller.abort();
  }, [organization, project, scanAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    setSemanticCatalogState('loading');
    const resourceTypes = projectMap.nodes.map((node) => node.resourceType).filter(Boolean);
    if (resourceTypes.length === 0) return () => controller.abort();
    void Promise.allSettled(resourceTypes.map((resourceType) =>
      fetchSemanticConceptCatalog(`${organization}-${project}`, resourceType, controller.signal),
    ))
      .then((results) => {
        const catalogs = results
          .filter((result): result is PromiseFulfilledResult<SemanticConceptCatalog> => result.status === 'fulfilled')
          .map((result) => result.value);
        if (catalogs.length === 0) throw new Error('Semantic catalog unavailable for all resources');
        const resources = catalogs.flatMap((catalog) => catalog.resources);
        const diagnostics = [
          ...catalogs.flatMap((catalog) => catalog.diagnostics),
          ...(results.some((result) => result.status === 'rejected')
            ? [{ severity: 'warning' as const, code: 'SEMANTIC_CATALOG_RESOURCE_UNAVAILABLE', message: 'Some resource concept catalogs were unavailable; technical fields remain available for those resources.' }]
            : []),
        ];
        const completenessStates = catalogs.map((catalog) => catalog.completeness?.state);
        const merged = catalogs[0] ? {
          ...catalogs[0],
          resources,
          diagnostics,
          completeness: {
            ...catalogs[0].completeness,
            state: completenessStates.includes('partial') ? 'partial' : completenessStates.every((state) => state === 'empty') ? 'empty' : 'complete',
            returnedResourceCount: resources.length,
            returnedConceptCount: resources.reduce((count, resource) => count + resource.families.reduce((familyCount, family) => familyCount + family.concepts.length, 0), 0),
          },
        } : null;
        setSemanticCatalog(merged);
        setSemanticCatalogState(semanticCatalogAvailability(merged));
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        setSemanticCatalog(null);
        setSemanticCatalogState('unavailable');
      });
    return () => controller.abort();
  }, [organization, project, projectMap.nodes, scanAttempt]);

  const availableRoots = useMemo(
    () => projectMap.nodes.map((node) => node.resourceType),
    [projectMap.nodes],
  );
  const selectedNode = projectMap.nodes.find(
    (node) => node.resourceType === selectedRoot,
  );
  const availableFields = useMemo(
    () => {
      const concepts = semanticFieldsFor(semanticCatalog, selectedRoot);
      return concepts.length > 0
        ? concepts
        : selectedNode ? dataFieldsFor(selectedNode.fields, selectedNode.resourceType) : [];
    },
    [semanticCatalog, selectedNode, selectedRoot],
  );

  useEffect(() => {
    if (!availableRoots.includes(selectedRoot)) {
      setSelectedRoot(availableRoots[0] ?? '');
      setSelectedNodeType(availableRoots[0] ?? '');
    }
  }, [availableRoots, selectedRoot]);

  useEffect(() => {
    if (availableFields.length === 0) return;
    setSelectedFields((current) =>
      current.length > 0 && current.every((field) => availableFields.some((item) => item.fieldRef === field))
        ? current
        : defaultFields(availableFields),
    );
  }, [availableFields]);


  useEffect(() => {
    setSelectedFieldsByNode((current) => ({
      ...current,
      [selectedRoot]: selectedFields,
    }));
  }, [selectedFields, selectedRoot]);

  const existingOutputs = outputsOf(recipe);
  const hasEditableOutput = existingOutputs.some((output) => {
    if (typeof output.rootResourceType !== 'string' || !output.rootResourceType) return false;
    return ['fields', 'traversals', 'catalogProjections', 'dynamicColumns', 'extensionColumns', 'pivots']
      .some((key) => Array.isArray(output[key]) && output[key].length > 0);
  });
  const existingTabs = Array.isArray(explorer.tabs)
    ? explorer.tabs.filter(
        (tab): tab is Record<string, JSONValue> =>
          Boolean(tab) && typeof tab === 'object' && !Array.isArray(tab),
      )
      : [];

  const activeOutput = existingOutputs.find((output) => outputKey(output) === selectedOutputName) ?? existingOutputs[0];
  const activeOutputName = outputKey(activeOutput);
  const candidateResourceType = selectedNodeType || selectedRoot;
  const selectedOutputIsPending = Boolean(
    selectedOutputName &&
    !existingOutputs.some((output) => outputKey(output) === selectedOutputName),
  );

  useEffect(() => {
    const outputName = activeOutputName;
    const nodePath = candidateNodePath(activeOutput, candidateResourceType);
    if (!outputName || !nodePath) {
      setRecipeCandidates([]);
      setRecipeCandidateConnection(undefined);
      setRecipeCandidateState('idle');
      return undefined;
    }
    const controller = new AbortController();
    setRecipeCandidateState('loading');
    void fetchRecipeColumnCandidates(
      `${organization}-${project}`,
      recipe,
      outputName,
      nodePath,
      controller.signal,
    ).then((connection) => {
      setRecipeCandidates(connection.nodes);
      setRecipeCandidateConnection(connection);
      setRecipeCandidateState('ready');
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      setRecipeCandidates([]);
      setRecipeCandidateConnection(undefined);
      setRecipeCandidateState('unavailable');
    });
    return () => controller.abort();
  }, [activeOutput, activeOutputName, candidateResourceType, organization, project, recipe]);

  useEffect(() => {
    if (recipeCandidateState !== 'ready' || recipeCandidates.length === 0) return;
    const selected = recipeCandidates.filter((candidate) => candidate.selected).map((candidate) => candidate.id).sort();
    const identity = `${activeOutputName}:${selected.join(',')}`;
    if (hydratedCandidateSelection.current === identity) return;
    hydratedCandidateSelection.current = identity;
    if (candidateResourceType === selectedRoot) setSelectedFields(selected);
    setSelectedFieldsByNode((current) => ({ ...current, [candidateResourceType]: selected }));
  }, [activeOutputName, candidateResourceType, recipeCandidateState, recipeCandidates, selectedRoot]);

  useEffect(() => {
    if (selectedOutputIsPending) return;
    const outputName = outputKey(activeOutput);
    const configuredRoot = typeof activeOutput?.rootResourceType === 'string'
      ? activeOutput.rootResourceType
      : '';
    const root = resolveResourceType(projectMap.nodes, configuredRoot) ?? configuredRoot;
    if (!activeOutput || !outputName || !root || !availableRoots.includes(root)) return;
    if (selectedOutputIntent.current && selectedOutputIntent.current !== outputName) return;
    const semanticIdentity = semanticCatalog?.catalogId ?? semanticCatalog?.resources
      .flatMap((resource) => resource.families.flatMap((family) => family.concepts.map((concept) => concept.id)))
      .sort()
      .join(',') ?? semanticCatalogState;
    const hydrationKey = `${outputName}|${root}|${projectMap.edges.map(edgeId).sort().join(',')}|${semanticIdentity}`;
    if (hydratedSelection.current === hydrationKey) return;
    hydratedSelection.current = hydrationKey;
    const hydrated = hydrateRecipeTraversal(activeOutput, projectMap, root, semanticCatalog);
    const rootConceptSelections = Array.isArray(activeOutput.conceptSelections)
      ? activeOutput.conceptSelections.map(asRecord)
      : [];
    const rootFields = Array.isArray(activeOutput.fields)
      ? activeOutput.fields.map(asRecord).map((field) => {
          const expr = asRecord(field.expr);
          const path = typeof expr.select === 'string' ? expr.select.replace(/^root\./, '') : '';
          return recipeFieldRef(field, root, semanticCatalog, rootConceptSelections) || (projectMap.nodes.find((node) => node.resourceType === root)?.fields
            .find((hint) => shortFieldPath(hint, root) === path)?.fieldRef ?? '');
        }).filter(Boolean)
      : [];
    setSelectedOutputName(outputName);
    setSelectedRoot(root);
    setSelectedNodeType(root);
    setSelectedPath(hydrated.path);
    setSelectedFields(rootFields);
    setSelectedFieldsByNode((current) => ({ ...current, ...hydrated.fieldsByNode, [root]: rootFields }));
    setTableTitle(titleFor(outputName));
  }, [activeOutput, availableRoots, projectMap, semanticCatalog, selectedOutputIsPending, selectedOutputName, selectedRoot]);

  const selectedNodeTypes = useMemo(() => {
    const connected = new Set<string>([selectedRoot]);
    for (const edge of selectedPath) {
      connected.add(edge.fromType);
      connected.add(edge.toType);
    }
    return [...connected];
  }, [selectedPath, selectedRoot]);
  const selectedQueryFieldCount = selectedNodeTypes.reduce(
    (total, resourceType) => total + (resourceType === selectedRoot
      ? selectedFields.length
      : (selectedFieldsByNode[resourceType]?.length ?? 0)),
    0,
  );
  const inspectorType = selectedNodeType || selectedRoot;
  const inspectorInQuery = selectedNodeTypes.includes(inspectorType);
  const traversalEndpoint = selectedPath.at(-1)?.toType ?? selectedRoot;
  const candidateEdge = useMemo(
    () => inspectedEdge &&
      inspectedEdge.fromType === traversalEndpoint &&
      inspectedEdge.toType === inspectorType &&
      inspectedEdge.edgeCount > 0 &&
      (showSparseData || inspectedEdge.edgeCount >= 10)
      ? inspectedEdge
      : projectMap.edges
      .filter((edge) =>
        edge.fromType === traversalEndpoint &&
        edge.toType === inspectorType &&
        edge.edgeCount > 0 &&
        (showSparseData || edge.edgeCount >= 10),
      )
      .sort((left, right) => right.edgeCount - left.edgeCount)[0],
    [inspectedEdge, inspectorType, projectMap.edges, showSparseData, traversalEndpoint],
  );
  const reachableEdgeIds = useMemo(
    () => new Set(
      projectMap.edges
        .filter((edge) =>
          edge.fromType === traversalEndpoint &&
          edge.edgeCount > 0 &&
          (showSparseData || edge.edgeCount >= 10),
        )
        .map(edgeId),
    ),
    [projectMap.edges, showSparseData, traversalEndpoint],
  );

  const workspaceOutput = activeOutput;
  const workspaceName = activeOutputName;
  const updateWorkspace = (outputs: ReadonlyArray<RecipeOutput>, tabs: ReadonlyArray<Record<string, JSONValue>>) => {
    const nextRecipe = { ...recipe, recipeSchemaVersion: typeof recipe.recipeSchemaVersion === 'number' ? recipe.recipeSchemaVersion : 1, outputs: Array.from(outputs) };
    onRecipeChange(nextRecipe);
    onExplorerChange({ ...explorer, schemaVersion: 1, tabs: Array.from(tabs) });
    const previewName = activeOutputName && outputs.some((output) => output.name === activeOutputName)
      ? activeOutputName
      : outputKey(outputs[0]);
    if (previewName) onPreview(previewName, nextRecipe);
  };

  const updateColumn = (index: number, key: 'name' | 'label' | 'visible', value: string | boolean) => {
    const target = activeOutput;
    if (!target) return;
    const fields = Array.isArray(target.fields) ? target.fields.map(asRecord) : [];
    const tab = existingTabs.find((candidate) => candidate.output === workspaceName);
    const table = asRecord(tab?.table);
    const columns = Array.isArray(table.columns) ? table.columns.map(asRecord) : [];
    const previousColumn = asRecord(columns[index]);
    const previousName = typeof previousColumn.field === 'string' ? previousColumn.field : '';
    const rootFieldIndex = fields.findIndex((field) => field.name === previousName);
    const traversalPrefix = previousName.includes('__') ? previousName.slice(0, previousName.indexOf('__') + 2) : '';
    const renamedColumn = key === 'name' && typeof value === 'string'
      ? traversalPrefix ? `${traversalPrefix}${value}` : value
      : value;
    if (key === 'name' && rootFieldIndex >= 0 && typeof value === 'string') {
      fields[rootFieldIndex] = { ...fields[rootFieldIndex], name: value };
    }
    const conceptSelections = Array.isArray(target.conceptSelections)
      ? target.conceptSelections.map(asRecord)
      : [];
    if (key === 'label' && rootFieldIndex >= 0 && conceptSelections[rootFieldIndex]) {
      conceptSelections[rootFieldIndex] = { ...conceptSelections[rootFieldIndex], label: value };
    }
    const nextOutput = key === 'name' && rootFieldIndex < 0 && Array.isArray(target.traversals)
      ? { ...target, fields, conceptSelections, traversals: renameTraversalField(target.traversals.map(asRecord), previousName, typeof value === 'string' ? value : '') }
      : { ...target, fields, ...(conceptSelections.length > 0 ? { conceptSelections } : {}) };
    const nextOutputs = existingOutputs.map((candidate) => candidate === target ? nextOutput : candidate);
    const outputName = typeof target.name === 'string' ? target.name : '';
    const nextTabs = existingTabs.map((tab) => {
      if (tab.output !== outputName) return tab;
      if (!columns[index]) return tab;
      columns[index] = { ...columns[index], ...(key === 'label' ? { label: value } : key === 'visible' ? { visible: value } : { field: renamedColumn }) };
      return { ...tab, table: { ...table, columns } };
    });
    updateWorkspace(nextOutputs, nextTabs);
  };

  const reorderColumn = (index: number, direction: -1 | 1) => {
    const tab = existingTabs.find((candidate) => candidate.output === workspaceName);
    if (!tab) return;
    const table = asRecord(tab.table);
    const columns = Array.isArray(table.columns) ? table.columns.map(asRecord) : [];
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    [columns[index], columns[target]] = [columns[target], columns[index]];
    updateWorkspace(existingOutputs, existingTabs.map((candidate) => candidate.output === workspaceName ? { ...candidate, table: { ...table, columns } } : candidate));
  };

  const fieldsForResource = (resourceType: string): ReadonlyArray<FhirFieldHint> => {
    if (resourceType === candidateResourceType && recipeCandidateState === 'ready' && recipeCandidates.length > 0) {
      return recipeCandidates.map(candidateField);
    }
    const semanticFields = semanticFieldsFor(semanticCatalog, resourceType);
    if (semanticFields.length > 0) return semanticFields;
    const node = projectMap.nodes.find((candidate) => candidate.resourceType === resourceType);
    return node ? dataFieldsFor(node.fields, resourceType) : [];
  };

  useEffect(() => {
    if (semanticCatalogState === 'loading') return;
    setSelectedFieldsByNode((current) => {
      let changed = false;
      const next = Object.fromEntries(Object.entries(current).map(([resourceType, values]) => {
        const valid = new Set(fieldsForResource(resourceType).map((field) => field.fieldRef));
        const filtered = values.filter((value) => valid.has(value));
        if (filtered.length !== values.length) changed = true;
        return [resourceType, filtered];
      }));
      return changed ? next : current;
    });
    setSelectedFields((current) => {
      const valid = new Set(fieldsForResource(selectedRoot).map((field) => field.fieldRef));
      const filtered = current.filter((value) => valid.has(value));
      return filtered.length === current.length ? current : filtered;
    });
    // Keep persisted selections that are still in the active catalog, while
    // dropping IDs from a stale generation or a resource-level fallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectMap.nodes, semanticCatalog, semanticCatalogState]);

  const semanticSelectionsFor = (
    resourceType: string,
    selected: ReadonlyArray<string>,
  ): ReadonlyArray<SemanticConcept> => semanticConceptsFor(semanticCatalog, resourceType)
    .filter((concept) => selected.includes(concept.id));

  const applyTable = (
    fieldsToUse = selectedFields,
    rootToUse = selectedRoot,
    titleToUse = tableTitle,
    fieldMap = selectedFieldsByNode,
    replaceActive = true,
    pathToUse = selectedPath,
  ) => {
    const fieldsForRoot = fieldsForResource(rootToUse);
    const fields = fieldsForRoot.filter((field) =>
      fieldsToUse.includes(field.fieldRef),
    );
    const outputName = (titleToUse.trim() || outputNameFor(rootToUse))
      .replace(/[^A-Za-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '') || outputNameFor(rootToUse);
    const aliases = new Map<string, string>();
    const usedAliases = new Set<string>(['root']);
    const traversalByResource = new Map<string, { edge: FhirTraversalHint; parent?: string; alias: string }>();
    const pending = [...pathToUse];
    const visitedTypes = new Set<string>([rootToUse]);
    while (pending.length > 0 && traversalByResource.size < 4) {
      // Loom traversal declarations are outbound only. Never reverse a graph
      // edge just because it happens to touch the selected root.
      const index = pending.findIndex((edge) => visitedTypes.has(edge.fromType) && !visitedTypes.has(edge.toType));
      if (index < 0) break;
      const edge = pending.splice(index, 1)[0];
      const target = edge.toType;
      const alias = safeAlias(target, usedAliases);
      aliases.set(target, alias);
      const frontier = edge.fromType;
      traversalByResource.set(target, { edge, parent: frontier, alias });
      visitedTypes.add(target);
    }
    const selectedTraversals = [...traversalByResource.entries()];
    const queryNodeTypes = [...new Set([rootToUse, ...pathToUse.flatMap((edge) => [edge.fromType, edge.toType])])];
    const relatedFieldsByResource = new Map<string, ReadonlyArray<{ name: string; expr: { select: string } }>>();
    const relatedColumns: ReadonlyArray<{ column: string; label: string }> = queryNodeTypes
      .filter((resourceType) => resourceType !== rootToUse && aliases.has(resourceType))
      .flatMap((resourceType) => {
        const fieldsForNode = fieldsForResource(resourceType);
        const selected = fieldsForNode.filter((field) => (fieldMap[resourceType] ?? []).includes(field.fieldRef));
        const names = uniqueFieldNames(selected, resourceType);
        return selected.map((field, index) => {
          const path = shortFieldPath(field, resourceType);
          const name = names[index];
          const concept = field.conceptId
            ? semanticConceptsFor(semanticCatalog, resourceType).find((candidate) => candidate.id === field.conceptId)
            : undefined;
          return {
            name,
            expr: { select: path },
            column: `${aliases.get(resourceType) ?? resourceType}__${name}`,
            label: field.label || titleFor(path),
            ...(concept ? { conceptId: concept.id, ruleId: concept.ruleId } : {}),
          };
        });
      });
    for (const resourceType of queryNodeTypes.filter((item) => item !== rootToUse && aliases.has(item))) {
      const selected = (fieldMap[resourceType] ?? []);
      const selectedFieldsForNode = fieldsForResource(resourceType).filter((field) => selected.includes(field.fieldRef));
      const names = uniqueFieldNames(selectedFieldsForNode, resourceType);
      relatedFieldsByResource.set(resourceType, selectedFieldsForNode.map((field, index) => {
        const path = shortFieldPath(field, resourceType);
          return { name: names[index], expr: { select: `${aliases.get(resourceType) ?? resourceType}.${path}` } };
      }));
    }
    const rootNames = uniqueFieldNames(fields, rootToUse);
    const rootFields = fields.map((field, index) => {
      const path = shortFieldPath(field, rootToUse);
      const concept = field.conceptId
        ? semanticConceptsFor(semanticCatalog, rootToUse).find((candidate) => candidate.id === field.conceptId)
        : undefined;
      return {
        name: rootNames[index],
        expr: { select: `root.${path}` },
        ...(concept ? { conceptId: concept.id, ruleId: concept.ruleId, columnName: concept.column.name } : {}),
      };
    });
    const { conceptSelections: _oldRootConceptSelections, ...activeOutputWithoutConceptSelections } = activeOutput ?? {};
    const outputDraft: RecipeOutput = {
      ...activeOutputWithoutConceptSelections,
      name: outputName,
      rootResourceType: rootToUse,
      rowGrain: rowGrainForResource(rootToUse),
      fields: rootFields,
      ...(semanticSelectionsFor(rootToUse, fieldsToUse).length > 0
        ? {
            conceptSelections: conceptSelectionsFor(semanticCatalog, rootToUse, fieldsToUse),
          }
        : {}),
      traversals: selectedTraversals.filter(([, item]) => item.parent === rootToUse).map(([resourceType, traversal]) => {
        const existingRootTraversals = Array.isArray(activeOutput?.traversals) ? activeOutput.traversals.map(asRecord) : [];
        const buildTraversal = (type: string, item: { edge: FhirTraversalHint; parent?: string; alias: string }, existing?: Record<string, JSONValue>): Record<string, JSONValue> => {
          const { conceptSelections: _oldConceptSelections, ...existingWithoutConceptSelections } = existing ?? {};
          const traversalDraft: Record<string, JSONValue> = {
          ...existingWithoutConceptSelections,
          // `name` is the exact populated Loom edge label. It is not a
          // display label and must not be decorated with the target type.
          name: item.edge.label,
          toResourceType: type,
          alias: item.alias,
          matchMode: 'OPTIONAL',
          fields: Array.from(relatedFieldsByResource.get(type) ?? []),
          ...(semanticSelectionsFor(type, fieldMap[type] ?? []).length > 0
            ? {
                conceptSelections: conceptSelectionsFor(semanticCatalog, type, fieldMap[type] ?? []),
              }
            : {}),
          traversals: selectedTraversals.filter(([, child]) => child.parent === type).map(([childType, child]) => {
            const oldChild = Array.isArray(existing?.traversals) ? existing.traversals.map(asRecord).find((candidate) => candidate.name === child.edge.label && candidate.toResourceType === childType) : undefined;
            return buildTraversal(childType, child, oldChild);
          }),
          };
          return type === candidateResourceType && recipeCandidateState === 'ready'
            ? selectedNativeCandidates(traversalDraft, recipeCandidates, fieldMap[type] ?? [])
            : traversalDraft;
        };
        const oldTraversal = existingRootTraversals.find((candidate) => candidate.name === traversal.edge.label && candidate.toResourceType === resourceType);
        return buildTraversal(resourceType, traversal, oldTraversal);
      }),
    };
    // Recipe-aware candidates are the primary selection contract. They write
    // the exact native family declarations Loom resolves; conceptSelections
    // remain only for compatibility while a server without this endpoint is
    // still in use.
    const output: RecipeOutput = rootToUse === candidateResourceType && recipeCandidateState === 'ready'
      ? selectedNativeCandidates(outputDraft, recipeCandidates, fieldsToUse)
      : outputDraft;
    const nextRecipe: RecipeAuthoringDocument = {
      ...recipe,
      recipeSchemaVersion:
        typeof recipe.recipeSchemaVersion === 'number'
          ? recipe.recipeSchemaVersion
          : 1,
      outputs: (() => {
        const replacementIndex = replaceActive && activeOutput ? existingOutputs.indexOf(activeOutput) : -1;
        if (replacementIndex < 0) return [...existingOutputs, output];
        return existingOutputs.map((candidate, index) => index === replacementIndex ? output : candidate);
      })(),
    };
    onRecipeChange(nextRecipe);
    setSelectedOutputName(outputName);
    onExplorerChange({
      ...explorer,
      schemaVersion: 1,
      tabs: [
        ...(() => {
          const nextTab = {
          id: outputId(outputName),
          title: titleToUse.trim() || titleFor(outputName),
          output: outputName,
          table: {
            columns: [...fields.map((field, index) => {
              const path = shortFieldPath(field, rootToUse);
              return {
                field: rootNames[index],
                label: field.label || titleFor(path),
                visible: true,
              };
              }), ...relatedColumns.map((field) => ({ field: field.column, label: field.label, visible: true }))],
          },
          };
          const replacementIndex = replaceActive && activeOutputName ? existingTabs.findIndex((tab) => tab.output === activeOutputName) : -1;
          if (replacementIndex < 0) return [...existingTabs, nextTab];
          return existingTabs.map((tab, index) => index === replacementIndex ? nextTab : tab);
        })(),
      ],
    });
    onPreview(outputName, nextRecipe);
    return { outputName, recipe: nextRecipe };
  };

  const removeTraversalStep = (stepIndex: number) => {
    const nextPath = selectedPath.slice(0, stepIndex);
    const retainedTypes = new Set([
      selectedRoot,
      ...nextPath.map((edge) => edge.toType),
    ]);
    const nextFieldMap = Object.fromEntries(
      Object.entries(selectedFieldsByNode).filter(([resourceType]) =>
        retainedTypes.has(resourceType),
      ),
    );
    const nextEndpoint = nextPath.at(-1)?.toType ?? selectedRoot;
    setSelectedPath(nextPath);
    setSelectedFieldsByNode(nextFieldMap);
    setSelectedNodeType(nextEndpoint);
    setInspectorOpen(false);
    const rendered = applyTable(
      selectedFields,
      selectedRoot,
      tableTitle,
      nextFieldMap,
      true,
      nextPath,
    );
    if (rendered) onRender?.(rendered.outputName, rendered.recipe);
  };

  const renderCurrentTable = () => {
    if (!selectedRoot || selectedFields.length === 0) return;
    applyTable(
      selectedFields,
      selectedRoot,
      tableTitle,
      selectedFieldsByNode,
      true,
      selectedPath,
    );
    setReviewOpen(true);
  };

  useEffect(() => {
    const projectKey = `${organization}/${project}`;
    if (
      scanState !== 'ready' ||
      semanticCatalogState === 'loading' ||
      !recipeSource ||
      hasEditableOutput ||
      initializedDefaultProject.current === projectKey
    ) return;
    const candidates = projectMap.nodes
      .filter((node) => node.fields.length > 0)
      .sort((left, right) => {
        if (left.resourceType === 'Patient') return -1;
        if (right.resourceType === 'Patient') return 1;
        return (right.documentCount ?? 0) - (left.documentCount ?? 0);
      });
    const suggestedRoot = candidates[0];
    if (!suggestedRoot) return;

    initializedDefaultProject.current = projectKey;
    const suggestedFields = defaultFields(fieldsForResource(suggestedRoot.resourceType), suggestedRoot.resourceType);
    const fieldMap = { [suggestedRoot.resourceType]: suggestedFields };
    setSelectedRoot(suggestedRoot.resourceType);
    setSelectedNodeType(suggestedRoot.resourceType);
    setSelectedPath([]);
    setSelectedFields(suggestedFields);
    setSelectedFieldsByNode(fieldMap);
    setTableTitle('Default Explorer');
    applyTable(
      suggestedFields,
      suggestedRoot.resourceType,
      'Default Explorer',
      fieldMap,
      existingOutputs.length > 0,
      [],
    );
    // The one-shot project guard intentionally keeps user-created blank drafts
    // from being repopulated after the initial suggestion.
    // eslint-disable-next-line reactHooks/exhaustive-deps
  }, [existingOutputs.length, hasEditableOutput, organization, project, projectMap, recipeSource, scanState, semanticCatalogState]);

  return (
    <section aria-label="Guided Explorer Builder" className="flex min-h-[38rem] flex-col gap-3">
      <header className="shrink-0 rounded-lg border border-blue-100 bg-gradient-to-r from-blue-50 to-white p-2.5">
        <div className="flex items-baseline gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#2f5aac]">Explorer Builder</p>
          <h1 className="text-lg font-semibold text-slate-900">Build a table from this project&apos;s data</h1>
        </div>
        <div role="toolbar" aria-label="Table workspace" className="mt-2 flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border border-slate-200 bg-white/90 p-2 shadow-sm">
          <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tables</span>
          {existingOutputs.map((candidate) => <button key={String(candidate.name)} type="button" className={`rounded-md px-3 py-1.5 text-sm ${candidate.name === activeOutput?.name ? 'bg-[#2f5aac] font-semibold text-white' : 'border border-slate-200 bg-white text-slate-700'}`} onClick={() => {
            const nextOutputName = outputKey(candidate);
            selectedOutputIntent.current = nextOutputName;
            setSelectedOutputName(nextOutputName);
            const nextRoot = typeof candidate.rootResourceType === 'string' ? candidate.rootResourceType : selectedRoot;
            setSelectedRoot(nextRoot);
            setSelectedNodeType(nextRoot);
            const hydrated = hydrateRecipeTraversal(candidate, projectMap, nextRoot, semanticCatalog);
            setSelectedPath(hydrated.path);
            setSelectedFieldsByNode((current) => ({ ...current, ...hydrated.fieldsByNode }));
            const conceptSelections = Array.isArray(candidate.conceptSelections)
              ? candidate.conceptSelections.map(asRecord)
              : [];
            const nextFields = Array.isArray(candidate.fields) ? candidate.fields.map(asRecord).map((field) => {
              const expr = asRecord(field.expr);
              const semanticRef = recipeFieldRef(field, nextRoot, semanticCatalog, conceptSelections);
              return semanticRef || (typeof expr.select === 'string' ? `${nextRoot}.${expr.select.replace(/^root\./, '')}` : '');
            }).filter(Boolean) : [];
            setSelectedFields(nextFields);
            setSelectedFieldsByNode((current) => ({ ...current, [nextRoot]: nextFields }));
            setTableTitle(typeof candidate.name === 'string' ? titleFor(candidate.name) : tableTitle);
          }}>{typeof candidate.name === 'string' ? titleFor(candidate.name) : 'Untitled'}</button>)}
          <span className="h-5 w-px bg-slate-200" aria-hidden="true" />
          <button type="button" disabled={disabled || availableRoots.length === 0} className="rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800 disabled:cursor-not-allowed disabled:opacity-50" onClick={() => {
            const root = selectedRoot || availableRoots[0];
            if (!root) return;
            const node = projectMap.nodes.find((candidate) => candidate.resourceType === root);
            const fields = defaultFields(node?.fields ?? [], root);
            setSelectedRoot(root);
            setSelectedNodeType(root);
            setSelectedPath([]);
            setSelectedFields(fields);
            setTableTitle(`${titleFor(root)} ${existingOutputs.length + 1}`);
            applyTable(fields, root, `${titleFor(root)} ${existingOutputs.length + 1}`, { ...selectedFieldsByNode, [root]: fields }, false, []);
          }}>New table</button>
          <button type="button" disabled={disabled || !workspaceOutput} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm" onClick={() => {
            if (!workspaceOutput || typeof workspaceOutput.name !== 'string') return;
            const copyName = `${workspaceOutput.name}_copy`;
            const sourceTab = existingTabs.find((tab) => tab.output === workspaceOutput.name);
            setSelectedOutputName(copyName);
            updateWorkspace([...existingOutputs, { ...workspaceOutput, name: copyName }], [...existingTabs, { ...(sourceTab ?? {}), id: outputId(copyName), title: titleFor(copyName), output: copyName }]);
          }}>Duplicate</button>
          <button type="button" disabled={disabled || !workspaceName} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm" onClick={() => {
            if (!workspaceName) return;
            const removedIndex = existingOutputs.findIndex((candidate) => candidate.name === workspaceName);
            const remaining = existingOutputs.filter((candidate) => candidate.name !== workspaceName);
            setSelectedOutputName(outputKey(remaining[removedIndex] ?? remaining[removedIndex - 1] ?? remaining[0]));
            updateWorkspace(remaining, existingTabs.filter((tab) => tab.output !== workspaceName));
          }}>Delete</button>
          <label className="ml-1 flex shrink-0 items-center gap-1.5 text-xs font-semibold text-slate-600" htmlFor="builder-table-title">Name
            <input id="builder-table-title" disabled={disabled} className="w-36 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-900" value={tableTitle} onChange={(event) => setTableTitle(event.currentTarget.value)} onBlur={() => applyTable(selectedFields, selectedRoot, tableTitle)} />
          </label>
          <span className="min-w-2 flex-1" />
          <button type="button" className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700" onClick={() => setInspectorOpen((open) => !open)}>{inspectorOpen ? 'Hide columns' : 'Show columns'}</button>
          <button type="button" disabled={disabled || !selectedRoot || selectedFields.length === 0} className="rounded-md bg-green-700 px-4 py-1.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-slate-400" onClick={renderCurrentTable}>Render table <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs">{selectedQueryFieldCount}</span></button>
          {onSaveDraft && <button type="button" disabled={disabled} className="rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm font-medium text-blue-800" onClick={onSaveDraft}>Save draft</button>}
          {onMakeLive && <button type="button" disabled={disabled} className="rounded-md bg-[#2f5aac] px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={onMakeLive}>Make live</button>}
        </div>
      </header>

      <div className={inspectorOpen ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'grid grid-cols-1 gap-3'}>
      <section
        aria-labelledby="fhir-map-heading"
        aria-modal={expandedPane === 'graph' || undefined}
        className={expandedPane === 'graph'
          ? 'fixed inset-3 z-50 flex h-[calc(100dvh-1.5rem)] min-w-0 flex-col rounded-xl border bg-white p-4 shadow-2xl'
          : 'relative flex h-[min(46dvh,34rem)] min-h-[28rem] min-w-0 flex-col rounded-lg border bg-white p-3 shadow-sm'}
      >
        <div className={`flex flex-wrap items-start justify-between gap-3 ${expandedPane === 'graph' ? '' : 'cursor-zoom-in'}`} onClick={(event) => {
          if (expandedPane === 'graph' || (event.target as Element).closest('button, input, label')) return;
          setExpandedPane('graph');
        }}>
          <div>
            <h2 id="fhir-map-heading" className="text-lg font-semibold">Explore the populated dataset</h2>
            <p className="text-sm text-slate-600">Larger cards contain more records; thicker lines connect more data. Click a card to inspect its fields, then add it to the traversal.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={showSparseData} onChange={(event) => setShowSparseData(event.currentTarget.checked)} /> Show sparse relationships (fewer than 10 links)</label><span className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
            {scanState === 'loading' ? 'Scanning project…' : scanState === 'ready' ? `${projectMap.nodes.length} resource types found` : 'Using the current recipe as a guide'}
          </span>{expandedPane === 'graph' && <button type="button" aria-label="Close expanded graph" className="rounded border border-slate-300 bg-white px-2 py-1 text-lg leading-none text-slate-700" onClick={() => setExpandedPane(undefined)}>×</button>}</div>
          {scanState === 'error' && <button type="button" className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-sm text-amber-900" onClick={() => setScanAttempt((attempt) => attempt + 1)}>Retry scan</button>}
        </div>
        {availableRoots.length > 0 ? <>
          <nav aria-label="Locked traversal" className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs">
            <span className="mr-1 font-semibold uppercase tracking-wide text-blue-800">Traversal</span>
            <button type="button" className="rounded-md border border-blue-300 bg-white px-2 py-1 font-semibold text-blue-950" onClick={() => {
              setSelectedNodeType(selectedRoot);
              setInspectorOpen(true);
            }}><span className="text-blue-500">1</span> {resourceLabel(selectedRoot)} <span className="font-normal text-slate-500">row start</span></button>
            {selectedPath.map((edge, index) => <React.Fragment key={`${edge.fromType}-${edge.label}-${edge.toType}`}>
              <span className="font-bold text-blue-500" aria-hidden="true">→</span>
              <span className="inline-flex overflow-hidden rounded-md border border-blue-300 bg-white">
                <button type="button" className="px-2 py-1 font-semibold text-blue-950" onClick={() => {
                  setSelectedNodeType(edge.toType);
                  setInspectorOpen(true);
                }}><span className="text-blue-500">{index + 2}</span> {resourceLabel(edge.toType)} <span className="font-normal text-slate-500">{edge.edgeCount.toLocaleString()} links</span></button>
                <button type="button" disabled={disabled} aria-label={`Remove ${resourceLabel(edge.toType)} and following traversal steps`} className="border-l border-blue-200 px-2 text-blue-700 hover:bg-blue-100 disabled:opacity-50" onClick={() => removeTraversalStep(index)}>Remove from here</button>
              </span>
            </React.Fragment>)}
            <span className="ml-1 text-slate-600">Select a locked step to inspect it; remove from a step to backtrack.</span>
            <span className="ml-auto text-slate-600"><strong className="text-green-700">NEXT</strong> = available · <strong className="text-blue-700">IN TABLE</strong> = locked · gray = unavailable from here</span>
          </nav>
          <div className="min-h-0 flex-1"><FlowGraph map={projectMap} root={selectedRoot} depth={4} selectedPath={selectedPath} selectedNodeType={selectedNodeType} reachableEdgeIds={reachableEdgeIds} showSparseData={showSparseData} disabled={disabled} onNodeSelect={(resourceType) => {
            const node = projectMap.nodes.find((candidate) => candidate.resourceType === resourceType);
            setSelectedFieldsByNode((current) => current[resourceType]
              ? current
              : { ...current, [resourceType]: defaultFields(node?.fields ?? [], resourceType) });
            setSelectedNodeType(resourceType);
            setInspectedEdge(undefined);
            setInspectorOpen(true);
          }} onEdgeSelect={(edge) => {
            const node = projectMap.nodes.find((candidate) => candidate.resourceType === edge.toType);
            setSelectedFieldsByNode((current) => current[edge.toType]
              ? current
              : { ...current, [edge.toType]: defaultFields(node?.fields ?? [], edge.toType) });
            setSelectedNodeType(edge.toType);
            setInspectedEdge(edge);
            setInspectorOpen(true);
          }} onPaneClick={() => { if (expandedPane !== 'graph') setExpandedPane('graph'); }} /></div>
        </> : <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No populated FHIR resources were found in this project yet. The graph will become available when populated data is present.</p>}
      </section>

      {inspectorOpen && <aside
        aria-labelledby="fields-heading"
        aria-modal={expandedPane === 'columns' || undefined}
        onClick={(event) => {
          if (expandedPane === 'columns' || (event.target as Element).closest('button, input, label, a')) return;
          setExpandedPane('columns');
        }}
        className={expandedPane === 'columns'
          ? 'fixed inset-3 z-50 h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl'
          : 'h-[min(46dvh,34rem)] min-h-[28rem] cursor-zoom-in overflow-y-auto rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-3'}
      >
        <div className="flex items-start justify-between gap-3">
        <div><h2 id="fields-heading" className="text-lg font-semibold">Choose {resourceLabel(selectedNodeType || selectedRoot)} columns</h2>
        <p className="mt-0.5 text-xs text-slate-600">Inspect first. The table changes only when you explicitly add this dataset.</p>
        </div>{expandedPane === 'columns' && <button type="button" aria-label="Close expanded column selector" className="rounded border border-slate-200 px-2 py-1 text-lg leading-none text-slate-600" onClick={() => setExpandedPane(undefined)}>×</button>}</div>
        {!inspectorInQuery && <div className={`mt-3 rounded border p-2 text-xs ${candidateEdge ? 'border-green-300 bg-green-50 text-green-950' : 'border-violet-200 bg-violet-50 text-violet-950'}`}>
          {candidateEdge
            ? <><strong>Available next step:</strong> {resourceLabel(traversalEndpoint)} → {resourceLabel(inspectorType)}. Choose columns below, then add it.</>
            : <>This dataset is not directly reachable from <strong>{resourceLabel(traversalEndpoint)}</strong>. Remove a traversal step above to choose a competing route, or start a new row root.</>}
        </div>}
        {inspectorInQuery && inspectorType !== selectedRoot && <div className="mt-3 flex items-center justify-between gap-2 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-950">
          <span><strong>Included in traversal.</strong> Field changes update this table.</span>
          <button type="button" className="shrink-0 rounded border border-blue-300 bg-white px-2 py-1 font-semibold" onClick={renderCurrentTable}>Render table</button>
        </div>}
        {selectedNodeType !== selectedRoot && <button type="button" disabled={disabled} className="mt-2 w-full rounded-md border border-violet-300 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 disabled:opacity-50" onClick={() => {
          const nextNode = projectMap.nodes.find((node) => node.resourceType === selectedNodeType);
          const nextFields = selectedFieldsByNode[selectedNodeType] ?? defaultFields(nextNode?.fields ?? [], selectedNodeType);
          setSelectedRoot(selectedNodeType);
          setSelectedPath([]);
          setSelectedFields(nextFields);
          setTableTitle(`${titleFor(selectedNodeType)} overview`);
          setSelectedFieldsByNode((current) => ({ ...current, [selectedNodeType]: nextFields }));
          applyTable(nextFields, selectedNodeType, `${titleFor(selectedNodeType)} overview`, { ...selectedFieldsByNode, [selectedNodeType]: nextFields }, true, []);
        }}>Start each row with {resourceLabel(selectedNodeType)}</button>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="guided-field-search">Search populated fields</label>
          <input id="guided-field-search" value={fieldSearch} onChange={(event) => setFieldSearch(event.currentTarget.value)} placeholder={recipeCandidateState === 'ready' ? 'Search columns, codes, systems, URLs, or examples' : semanticCatalogState === 'ready' ? 'Search concepts by name or example' : 'Search technical fields by name or path'} className="min-w-64 flex-1 rounded border border-slate-300 px-3 py-2 text-sm" />
          {(recipeCandidateState === 'ready' || semanticCatalogState === 'ready') && <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={showTechnicalSource} onChange={(event) => setShowTechnicalSource(event.currentTarget.checked)} /> Show technical source</label>}
          <button type="button" disabled={disabled || (!inspectorInQuery && !candidateEdge)} className="rounded border border-blue-300 px-2 py-1.5 text-xs text-blue-800" onClick={() => {
            const nextFields = defaultFields(fieldsForResource(inspectorType), inspectorType);
            const nextMap = { ...selectedFieldsByNode, [inspectorType]: nextFields };
            if (inspectorType === selectedRoot) setSelectedFields(nextFields);
            setSelectedFieldsByNode(nextMap);
            if (inspectorInQuery) applyTable(inspectorType === selectedRoot ? nextFields : selectedFields, selectedRoot, tableTitle, nextMap);
          }}>Select recommended</button>
          <button type="button" disabled={disabled || (!inspectorInQuery && !candidateEdge)} className="rounded border border-slate-200 px-2 py-1.5 text-xs" onClick={() => {
            const nextMap = { ...selectedFieldsByNode, [inspectorType]: [] };
            if (inspectorType === selectedRoot) setSelectedFields([]);
            setSelectedFieldsByNode(nextMap);
            if (inspectorInQuery) applyTable(inspectorType === selectedRoot ? [] : selectedFields, selectedRoot, tableTitle, nextMap);
          }}>Clear selection</button>
          <span className="text-xs text-slate-500">{selectedQueryFieldCount} selected across {selectedNodeTypes.length} node{selectedNodeTypes.length === 1 ? '' : 's'}</span>
        </div>
        {(selectedNodeType || selectedRoot) ? (
          <div className="mt-3 space-y-3">
            {(() => {
              const resourceType = selectedNodeType || selectedRoot;
              const node = projectMap.nodes.find((candidate) => candidate.resourceType === resourceType);
              const allNodeFields = node?.fields ?? [];
              const semanticResource = semanticResourceFor(semanticCatalog, resourceType);
              const nodeFields = fieldsForResource(resourceType);
              const hasRecipeCandidates = recipeCandidateState === 'ready' && resourceType === candidateResourceType && nodeFields.some((field) => field.recipeCandidate);
              const concepts = semanticConceptsFor(semanticCatalog, resourceType);
              const isExpandedColumnPanel = expandedPane === 'columns';
              const nodeSelected = resourceType === selectedRoot
                ? selectedFields
                : (selectedFieldsByNode[resourceType] ?? defaultFields(nodeFields, resourceType));
              return <React.Fragment key={resourceType}><fieldset className={isExpandedColumnPanel ? 'rounded-lg border border-slate-200 p-5' : 'rounded-md border border-slate-200 p-2.5'}>
                <legend className={`px-1 font-medium text-slate-800 ${isExpandedColumnPanel ? 'text-lg' : ''}`}>{semanticResource?.label || titleFor(resourceType)} details {resourceType === selectedRoot ? '(row root)' : '(optional path)'}</legend>
                <p className={`mt-1 text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`}>
                  {nodeSelected.length} selected · {nodeFields.length} {hasRecipeCandidates ? 'recipe columns' : concepts.length > 0 ? 'researcher concepts' : 'technical fields'} available
                  {(semanticResource?.documentCount ?? node?.documentCount) ? ` · ${(semanticResource?.documentCount ?? node?.documentCount)?.toLocaleString()} populated records` : ''}
                </p>
                {hasRecipeCandidates && <p className="mt-1 text-xs text-slate-500">Choose exact value-bearing columns. Loom will persist each choice in this node’s native recipe family.</p>}
                {hasRecipeCandidates && recipeCandidateConnection && !recipeCandidateConnection.completeness.complete && <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-950"><strong>Column discovery is incomplete.</strong> Refine this recipe family or raise its profiling bound before previewing or publishing.</p>}
                {recipeCandidateState === 'unavailable' && resourceType === candidateResourceType && <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-950"><strong>The recipe-aware Loom column request failed.</strong> The legacy concept list is shown as a temporary fallback.</p>}
                {concepts.length > 0 && !hasRecipeCandidates && <p className="mt-1 text-xs text-slate-500">Choose a plain-language concept. Loom retains its stable concept and rule identity for publication.</p>}
                {concepts.length === 0 && !hasRecipeCandidates && semanticCatalogState === 'empty' && <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"><strong>Loom returned no semantic concepts for this dataset generation.</strong> Technical FHIR fields are shown as a fallback. The project catalog must contain semantic observations before researcher-facing concept selection can be used.</p>}
                {concepts.length === 0 && semanticCatalogState === 'ready' && <p role="status" className="mt-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950"><strong>No semantic concepts were returned for {titleFor(resourceType)}.</strong> Other resource types may have concepts. Technical FHIR fields are shown for this resource.</p>}
                {semanticCatalogState === 'unavailable' && <p role="alert" className="mt-2 rounded border border-red-300 bg-red-50 p-2 text-xs text-red-950"><strong>The Loom semantic catalog request failed.</strong> Technical FHIR fields are shown as a fallback. Retry the project scan after checking authentication and the Loom service.</p>}
                {semanticCatalog && !hasRecipeCandidates && isPartialSemanticCatalog(semanticCatalog) && <p className="mt-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">This concept list is partial; some lower-ranked concepts may be omitted.</p>}
                {allNodeFields.length > nodeFields.length && <p className="mt-1 text-xs text-slate-500">
                  {allNodeFields.length - nodeFields.length} structural field{allNodeFields.length - nodeFields.length === 1 ? '' : 's'} hidden; choose a leaf value for a usable column.
                </p>}
                <div className={isExpandedColumnPanel ? 'mt-4 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2 2xl:grid-cols-3' : 'mt-2'}>
              {nodeFields.filter((field) => {
                const query = fieldSearch.trim().toLowerCase();
                const recipeCandidate = field.recipeCandidate;
                const concept = field.conceptId ? concepts.find((candidate) => candidate.id === field.conceptId) : undefined;
                const examples = concept?.examples?.suppressed ? '' : (concept?.examples?.values ?? []).join(' ');
                return !query || `${field.label ?? ''} ${shortFieldPath(field, resourceType)} ${examples} ${recipeCandidate?.rawKey ?? ''} ${recipeCandidate?.rawSystem ?? ''} ${recipeCandidate?.rawCode ?? ''} ${recipeCandidate?.extensionUrl ?? ''} ${(recipeCandidate?.examples ?? []).join(' ')}`.toLowerCase().includes(query);
              }).sort((left, right) => {
                const leftConcept = left.conceptId ? concepts.find((candidate) => candidate.id === left.conceptId) : undefined;
                const rightConcept = right.conceptId ? concepts.find((candidate) => candidate.id === right.conceptId) : undefined;
                return `${left.recipeCandidate?.familyName ?? leftConcept?.family ?? 'technical'}:${left.label ?? left.fieldRef}`.localeCompare(`${right.recipeCandidate?.familyName ?? rightConcept?.family ?? 'technical'}:${right.label ?? right.fieldRef}`);
              }).map((field, fieldIndex, visibleFields) => {
                const checked = nodeSelected.includes(field.fieldRef);
                const recipeCandidate = field.recipeCandidate;
                const concept = field.conceptId ? concepts.find((candidate) => candidate.id === field.conceptId) : undefined;
                const family = concept?.family ? semanticResource?.families.find((candidate) => candidate.id === concept.family) : undefined;
                const previous = visibleFields[fieldIndex - 1];
                const previousConcept = previous?.conceptId ? concepts.find((candidate) => candidate.id === previous.conceptId) : undefined;
                const startsFamily = Boolean((recipeCandidate && recipeCandidate.familyId !== previous?.recipeCandidate?.familyId) || (concept && concept.family !== previousConcept?.family));
                const duplicateLabel = Boolean(concept && visibleFields.some((candidate) =>
                  candidate.fieldRef !== field.fieldRef &&
                  candidate.label?.trim().toLocaleLowerCase() === field.label?.trim().toLocaleLowerCase(),
                ));
                const conceptDisambiguator = concept
                  ? semanticConceptDisambiguator(concept)
                  : '';
                return (
                  <React.Fragment key={field.fieldRef}><>{startsFamily && <p className={`col-span-full pt-2 font-semibold uppercase tracking-wide text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`}>{recipeCandidate ? recipeFamilyLabel(recipeCandidate.familyName) : familyLabel(concept?.family ?? 'technical', family?.label ?? (concept ? undefined : 'Technical fields'))}</p>}</><label className={`flex cursor-pointer items-start gap-2 ${isExpandedColumnPanel ? 'min-h-24 rounded-lg border border-slate-200 px-3 py-3 shadow-sm' : 'border-b border-slate-100 px-1 py-1.5'} ${checked ? 'border-blue-300 bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <input
                      checked={checked}
                      disabled={disabled || (!inspectorInQuery && !candidateEdge)}
                      onChange={() => {
                        const nextFields = checked
                          ? nodeSelected.filter((item) => item !== field.fieldRef)
                          : [...nodeSelected, field.fieldRef];
                        const nextMap = { ...selectedFieldsByNode, [resourceType]: nextFields };
                        setSelectedFieldsByNode(nextMap);
                        if (resourceType === selectedRoot) setSelectedFields(nextFields);
                        if (inspectorInQuery) applyTable(resourceType === selectedRoot ? nextFields : selectedFields, selectedRoot, tableTitle, nextMap);
                      }}
                      type="checkbox"
                    />
                    <span className="min-w-0 flex-1"><span className={`block truncate font-medium text-slate-800 ${isExpandedColumnPanel ? 'text-base' : 'text-sm'}`} title={field.label || titleFor(shortFieldPath(field, resourceType))}>{field.label || titleFor(shortFieldPath(field, resourceType))}</span>{recipeCandidate ? <><span className={`block truncate font-medium text-slate-600 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={recipeCandidate.rawSystem || recipeCandidate.rawCode || recipeCandidate.extensionUrl || recipeCandidate.rawKey}>{recipeCandidate.rawSystem || recipeCandidate.rawCode || recipeCandidate.extensionUrl || recipeCandidate.rawKey}</span><span className={`block text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`}>{recipeCandidate.valueType || 'value'}{recipeCandidate.cardinality === 'MANY' ? ' · repeated' : ''}{recipeCandidate.population ? ` · ${recipeCandidate.population.toLocaleString()} records` : ''}</span>{recipeCandidate.examples.length > 0 && <span className={`block truncate text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={recipeCandidate.examples.slice(0, 2).join(', ')}>Examples: {recipeCandidate.examples.slice(0, 2).join(', ')}{recipeCandidate.examples.length > 2 ? ` +${recipeCandidate.examples.length - 2}` : ''}</span>}{showTechnicalSource && <span className={`block truncate text-slate-400 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={`${recipeCandidate.familyKind} · ${recipeCandidate.valueSelector}`}>{recipeCandidate.familyKind} · {recipeCandidate.valueSelector}</span>}</> : concept ? <>{duplicateLabel && <span className={`block truncate font-medium text-slate-600 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={conceptDisambiguator || concept.id}>From: {conceptDisambiguator || concept.id}</span>}<span className={`block text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`}>{concept.column.logicalType || 'value'}{concept.column.repeated ? ' · repeated' : ''}{concept.population?.recordCount !== undefined ? ` · ${concept.population.recordCount.toLocaleString()} records` : ''}</span>{concept.examples?.suppressed ? <span className={`block text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`}>Examples withheld for safety{concept.examples.reason ? ` (${concept.examples.reason})` : ''}</span> : concept.examples?.values?.length ? <span className={`block truncate text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={concept.examples.values.slice(0, 2).join(', ')}>Examples: {concept.examples.values.slice(0, 2).join(', ')}{concept.examples.values.length > 2 ? ` +${concept.examples.values.length - 2}` : ''}</span> : null}</> : <span className={`block truncate text-slate-500 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={shortFieldPath(field, resourceType)}>Technical field · {shortFieldPath(field, resourceType)}</span>}{concept && showTechnicalSource && <span className={`block truncate text-slate-400 ${isExpandedColumnPanel ? 'text-sm' : 'text-xs'}`} title={`Source: ${concept.source?.system || 'unknown'} · rule ${concept.ruleId} · ${conceptDisambiguator || shortFieldPath(field, resourceType)}`}>Source: {concept.source?.system || 'unknown'} · rule {concept.ruleId} · {conceptDisambiguator || shortFieldPath(field, resourceType)}</span>}</span>
                  </label></React.Fragment>
                );
              })}
                </div>
              </fieldset>
              {!inspectorInQuery && candidateEdge && <button type="button" disabled={disabled || nodeSelected.length === 0 || selectedPath.length >= 4} className="w-full rounded-md bg-green-700 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400" onClick={() => {
                const nextPath = [...selectedPath, candidateEdge];
                const nextMap = { ...selectedFieldsByNode, [resourceType]: nodeSelected };
                setSelectedPath(nextPath);
                setSelectedFieldsByNode(nextMap);
                applyTable(selectedFields, selectedRoot, tableTitle, nextMap, true, nextPath);
              }}>Add {resourceLabel(resourceType)} to traversal · {nodeSelected.length} column{nodeSelected.length === 1 ? '' : 's'}</button>}
              </React.Fragment>;
            })()}
          </div>
        ) : (
          <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            No populated fields were returned for this resource yet. Select another populated node from the graph.
          </p>
        )}
      </aside>}
      </div>

      {reviewOpen && <section aria-label="Rendered sample" className="scroll-mt-4">
        {(() => {
          const tab = existingTabs.find((candidate) => candidate.output === workspaceName);
          const rawColumns: JSONValue[] = tab && Array.isArray(asRecord(tab.table).columns) ? asRecord(tab.table).columns as JSONValue[] : [];
          const configuredColumns = rawColumns.map(asRecord).map((column, index) => ({ name: typeof column.field === 'string' ? column.field : undefined, field: typeof column.field === 'string' ? column.field : undefined, label: typeof column.label === 'string' ? column.label : undefined, visible: column.visible !== false, order: index }));
          const columnIndex = (sourceName: string) => rawColumns.findIndex((column) => asRecord(column).field === sourceName);
          const hiddenColumns = configuredColumns.filter((column) => column.visible === false && column.field);
          return <>
          {hiddenColumns.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-white p-2 text-xs"><span className="font-semibold text-slate-600">Hidden columns</span>{hiddenColumns.map((column) => <button type="button" className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800" key={column.field} onClick={() => updateColumn(columnIndex(column.field!), 'visible', true)}>Show {column.label || column.field}</button>)}</div>}
          <ExplorerSamplePreview
          preview={preview}
          output={previewOutput}
          status={previewStatus}
          error={previewError}
          minimal
          columnConfig={configuredColumns}
          editableHeaders={!disabled}
          onColumnLabelChange={(sourceName, label) => updateColumn(columnIndex(sourceName), 'label', label)}
          onColumnMove={(sourceName, direction) => reorderColumn(columnIndex(sourceName), direction)}
          onColumnHide={(sourceName) => updateColumn(columnIndex(sourceName), 'visible', false)}
          selectedPathSummary={[selectedRoot, ...selectedPath.map((edge) => edge.toType)]}
          /></>;
        })()}
      </section>}
    </section>
  );
};
