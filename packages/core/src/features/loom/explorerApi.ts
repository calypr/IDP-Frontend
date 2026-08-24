import { GEN3_LOOM_API } from '../../constants';
import { loomApi, fetchLoomResponse } from './loomApi';
import { handleUnauthorizedStatus } from '../user/unauthorized';
import { selectCSRFToken } from '../user/userSliceRTK';
import type { CoreState } from '../../reducers';
import {
  configForOutput,
  validateExplorerConfigV2,
} from './explorer';
import type {
  ExplorerApiError,
  ExplorerAuthoringCandidate,
  ExplorerAuthoringCatalogRequest,
  ExplorerAuthoringCatalogResponse,
  ExplorerAuthoringCompileRequest,
  ExplorerAuthoringCompileResponse,
  ExplorerConfigV2,
  ExplorerDiagnostic,
  ExplorerMaterializationMappingV2,
  ExplorerState,
  RepositoryExplorerConfig,
  RecipeOutputV2,
  RecipeFieldV2,
  RecipeTraversalV2,
} from './explorer';
import { isExplorerStateV1 } from './explorerAuthoring';
import type { ExplorerStateV1 } from './explorerAuthoring';
import {
  bindAuthoringPreview,
  type AuthoringColumnBinding,
  type AuthoringPreviewResponse,
} from './authoringPreview';
import { canonicalLoomProjectId, encodeLoomProjectPath } from './projectId';

export interface ExplorerProjectRef {
  readonly project: string;
  readonly explorerId: string;
}

export interface CreateExplorerRequest {
  readonly project: string;
  /** Human name from which Loom derives the stable Explorer ID. */
  readonly name?: string;
  /** Kept for callers compiled against the first V2 client. New callers must
   * send name and let the server own collision-safe ID derivation. */
  readonly explorerId?: string;
  readonly title: string;
  readonly description?: string;
  readonly from: 'default' | 'blank';
  readonly authResourcePath?: string;
}

export interface DeleteExplorerRequest extends Pick<
  ExplorerProjectRef,
  'project'
> {
  readonly explorerId: string;
  /** Canonical Fence resource path used by scoped Loom write authorization. */
  readonly authResourcePath?: string;
}

export interface SaveExplorerDraftRequest extends ExplorerProjectRef {
  readonly config: ExplorerConfigV2;
  /** Canonical Fence resource path used by scoped Loom write authorization. */
  readonly authResourcePath?: string;
  /** All editable Explorer packets use CAS, including the repository default. */
  readonly expectedDraftVersion: number;
  readonly expectedDraftDigest?: string;
}

export interface PreviewExplorerDraftRequest extends ExplorerProjectRef {
  readonly config: ExplorerConfigV2;
  readonly output: string;
  readonly limit: 10 | 25 | 50 | 100;
  /** Canonical Fence resource path used by scoped Loom write authorization. */
  readonly authResourcePath?: string;
  /** Optional for the repository default, which is not stored in the
   * interactive Explorer CAS store. */
  readonly draftDigest?: string;
}

export interface PublishExplorerRequest extends ExplorerProjectRef {
  readonly config: ExplorerConfigV2;
  /** Canonical Fence resource path used by scoped Loom write authorization. */
  readonly authResourcePath?: string;
  /** Retained for callers compiled against the draft-based lifecycle. */
  readonly expectedDraftVersion: number;
  readonly expectedDraftDigest?: string;
}

export interface ExplorerPreview {
  readonly output: string;
  readonly columns: ReadonlyArray<{
    /** Semantic Builder key retained for editing and presentation. */
    readonly name: string;
    /** Exact key used to read a value from a returned row object. */
    readonly rowKey: string;
    readonly emissionId?: string;
    readonly candidateId?: string;
    readonly occurrenceId?: string;
    readonly label?: string;
    readonly logicalType?: string;
    readonly filterable?: boolean;
    readonly chartable?: boolean;
  }>;
  readonly rows: ReadonlyArray<Record<string, unknown>>;
  readonly rowCount: number;
  readonly digest?: string;
  readonly recipeDigest?: string;
  readonly resolvedSchemaDigest?: string;
  readonly sourceGeneration?: string;
  readonly diagnostics?: ReadonlyArray<ExplorerDiagnostic>;
  readonly requestId?: string;
}

export interface ExplorerPublicationResult extends ExplorerState {
  readonly activeUrl: string;
  readonly publicationId?: string;
  readonly shareUrl?: string;
  readonly materializationMappings?: ReadonlyArray<ExplorerMaterializationMappingV2>;
}

const explorerRoot = (project: string) =>
  `${GEN3_LOOM_API}/api/v1/projects/${encodeLoomProjectPath(project)}/explorers`;

const withAuthResourcePath = (endpoint: string, authResourcePath?: string) => {
  const path = authResourcePath?.trim();
  if (!path) return endpoint;
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}auth_resource_path=${encodeURIComponent(path)}`;
};

const parseBody = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return { message: text } as T;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type AuthoringV1Node = {
  readonly nodeId: string;
  readonly resourceType?: string;
  readonly label?: string;
};
type AuthoringV1Edge = {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly label?: string;
};
type AuthoringV1Candidate = {
  readonly candidateId: string;
  readonly nodeId: string;
  readonly path?: string;
  readonly fieldRef?: string;
  readonly label?: string;
  readonly logicalType?: string;
  readonly repeated?: boolean;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
};
type AuthoringV1Catalog = {
  readonly snapshotToken: string;
  readonly sourceGeneration?: string;
  readonly resolvedSchemaDigest?: string;
  readonly authorizationScopeDigest?: string;
  readonly nodes: ReadonlyArray<AuthoringV1Node>;
  readonly routeEdges: ReadonlyArray<AuthoringV1Edge>;
  readonly candidates: ReadonlyArray<AuthoringV1Candidate>;
};
type AuthoringV1Document = {
  readonly kind: 'ExplorerBuilderDocument';
  readonly output: { readonly id: string; readonly title: string };
  readonly baseNodeId: string;
  readonly rowNodeId: string;
  readonly routeEdgeIds?: ReadonlyArray<string>;
  readonly routeOccurrences?: ReadonlyArray<{
    readonly id: string;
    readonly index: number;
    readonly nodeId: string;
    readonly incomingEdgeId?: string;
  }>;
  readonly candidateIds?: ReadonlyArray<string>;
  readonly candidateOccurrences?: ReadonlyArray<{
    readonly candidateId: string;
    readonly occurrenceId: string;
  }>;
  readonly presentation?: Readonly<Record<string, unknown>>;
};
type AuthoringV1Bundle = {
  readonly apiVersion: 'loom.calypr.org/explorer-authoring/v1';
  readonly kind: 'ExplorerAuthoringBundle';
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly documents: ReadonlyArray<AuthoringV1Document>;
  readonly tabs: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly outputId: string;
    readonly order: number;
  }>;
};
const canonicalBundleCache = new Map<
  string,
  { readonly draft?: unknown; readonly active?: unknown; readonly draftReceiptId?: string; readonly runtime?: ExplorerStateV1['runtime']; readonly generated?: ExplorerStateV1['generated'] }
>();
const authoringCatalogCache = new Map<string, AuthoringV1Catalog>();
type AuthoringResolvedEmission = {
  readonly outputId: string;
  readonly emissionId: string;
  readonly candidateId?: string;
  readonly occurrenceId?: string;
};
const authoringEmissionCache = new Map<
  string,
  ReadonlyArray<AuthoringResolvedEmission>
>();
type AuthoringResolvedRoute = {
  readonly outputId: string;
  readonly baseNodeId?: string;
  readonly baseResourceType?: string;
  readonly rowNodeId?: string;
  readonly rowResourceType?: string;
};
const authoringRouteCache = new Map<
  string,
  ReadonlyArray<AuthoringResolvedRoute>
>();

const authoringCacheKey = (project: string, explorerId: string): string =>
  `${project}:${explorerId}`;

/**
 * Loom deployments expose lifecycle resources either directly, in a
 * `{ data: ... }` envelope, or in a publication envelope whose authoritative
 * Explorer state is under `state`. Normalize all three shapes before any
 * Builder or Viewer code selects draft versus active configuration.
 */
const unwrapExplorerEnvelope = (payload: unknown): unknown => {
  const data =
    isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(data) || !isRecord(data.state)) return data;
  return {
    ...data.state,
    activeUrl: data.activeUrl ?? data.state.activeUrl,
    publicationId: data.publicationId ?? data.state.publicationId,
    shareUrl: data.shareUrl ?? data.state.shareUrl,
    materializationMappings:
      data.materializationMappings ?? data.state.materializationMappings,
    materializations: data.materializations ?? data.state.materializations,
  };
};

const errorFromResponse = async (
  response: Response,
  endpoint: string,
): Promise<ExplorerApiError> => {
  const body = await parseBody<
    Partial<ExplorerApiError> & {
      error?:
        | string
        | {
            readonly code?: unknown;
            readonly message?: unknown;
            readonly retryable?: unknown;
            readonly requestId?: unknown;
            readonly diagnostics?: unknown;
          };
    }
  >(response);
  const nested =
    body.error && typeof body.error === 'object' ? body.error : undefined;
  const nestedRecord = nested as
    | (Partial<ExplorerApiError> & { readonly requestId?: unknown })
    | undefined;
  const unauthorized = response.status === 401;
  const message = unauthorized
    ? 'Your Loom session has expired. Sign in again to continue.'
    : typeof body.message === 'string'
      ? body.message
      : typeof body.error === 'string'
        ? body.error
        : typeof nested?.message === 'string'
          ? nested.message
          : `Explorer request failed (${response.status}).`;
  const diagnostics = Array.isArray(body.diagnostics)
    ? body.diagnostics
    : Array.isArray(nested?.diagnostics)
      ? (nested.diagnostics as ReadonlyArray<ExplorerDiagnostic>)
      : undefined;
  return {
    status: response.status,
    code: unauthorized
      ? 'AUTHENTICATION_REQUIRED'
      : typeof body.code === 'string'
        ? body.code
        : typeof nested?.code === 'string'
          ? nested.code
          : undefined,
    message,
    currentVersion:
      body.currentVersion ??
      (typeof nestedRecord?.currentVersion === 'number'
        ? nestedRecord.currentVersion
        : undefined),
    currentDigest:
      body.currentDigest ??
      (typeof nestedRecord?.currentDigest === 'string'
        ? nestedRecord.currentDigest
        : undefined),
    updatedAt:
      body.updatedAt ??
      (typeof nestedRecord?.updatedAt === 'string'
        ? nestedRecord.updatedAt
        : undefined),
    diagnostics,
    endpoint,
    requestId:
      response.headers.get('x-request-id') ??
      (typeof body.requestId === 'string' ? body.requestId : undefined) ??
      (typeof nestedRecord?.requestId === 'string'
        ? nestedRecord.requestId
        : undefined),
    retryable: unauthorized
      ? false
      : typeof body.retryable === 'boolean'
        ? body.retryable
        : typeof nestedRecord?.retryable === 'boolean'
          ? nestedRecord.retryable
          : undefined,
    fieldPath:
      body.fieldPath ??
      (typeof nestedRecord?.fieldPath === 'string' ||
      nestedRecord?.fieldPath === null
        ? nestedRecord.fieldPath
        : undefined),
    details:
      body.details ??
      (nestedRecord?.details && typeof nestedRecord.details === 'object'
        ? nestedRecord.details
        : undefined),
  };
};

const errorFromUnknown = (
  error: unknown,
  endpoint: string,
  fallbackCode: string,
): ExplorerApiError => {
  const typed = error as {
    readonly status?: number | 'CUSTOM_ERROR' | 'FETCH_ERROR';
    readonly httpStatus?: number;
    readonly message?: string;
    readonly code?: string;
    readonly endpoint?: string;
    readonly requestId?: string;
    readonly fieldPath?: string | null;
    readonly retryable?: boolean;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly meta?: { readonly endpoint?: string };
  };
  const httpStatus =
    typeof typed.httpStatus === 'number'
      ? typed.httpStatus
      : typeof typed.status === 'number'
        ? typed.status
        : undefined;
  const unauthorized = httpStatus === 401;
  const message = unauthorized
    ? 'Your Loom session has expired. Sign in again to continue.'
    : (typed.message ??
      `Loom could not complete ${fallbackCode.toLowerCase()}.`);
  const code = unauthorized
    ? 'AUTHENTICATION_REQUIRED'
    : (typed.code ?? fallbackCode);
  return {
    status: typed.status ?? httpStatus ?? 'CUSTOM_ERROR',
    code,
    message,
    endpoint: typed.meta?.endpoint ?? typed.endpoint ?? endpoint,
    requestId: typed.requestId,
    fieldPath: typed.fieldPath,
    retryable: unauthorized ? false : typed.retryable,
    details: typed.details,
  };
};

const configValidationError = (
  config: unknown,
  project: string,
  explorerId: string,
): { readonly error: ExplorerApiError } | undefined => {
  const result = validateExplorerConfigV2(config, project, explorerId);
  if (result.valid) return undefined;
  return {
    error: {
      status: 422,
      code: 'VALIDATION_FAILED',
      message: 'The ExplorerConfig V2 envelope is invalid.',
      diagnostics: result.diagnostics,
      fieldPath: result.diagnostics[0]?.configPath ?? '$',
      retryable: false,
    },
  };
};

/** Loom's current executable recipe.Traversal is one-hop and rejects a
 * `children` property. Empty arrays are removed by the serializers; a populated
 * tree must fail locally rather than silently dropping authored descendants. */
const nestedTraversalCompatibilityError = (
  config: ExplorerConfigV2,
): { readonly error: ExplorerApiError } | undefined => {
  for (const [outputIndex, output] of (config.recipe.outputs ?? []).entries()) {
    for (const [traversalIndex, traversal] of (
      output.traversals ?? []
    ).entries()) {
      if ((traversal.children?.length ?? 0) === 0) continue;
      const fieldPath = `$.recipe.outputs[${outputIndex}].traversals[${traversalIndex}].children`;
      return {
        error: {
          status: 422,
          code: 'UNSUPPORTED_NESTED_TRAVERSAL',
          message:
            'This Loom version does not support nested recipe traversals. Remove the descendant traversal before compiling.',
          diagnostics: [
            {
              severity: 'error',
              code: 'UNSUPPORTED_NESTED_TRAVERSAL',
              message:
                'Nested traversal steps cannot be compiled by the current Loom recipe schema.',
              configPath: fieldPath,
            },
          ],
          fieldPath,
          retryable: false,
        },
      };
    }
  }
  return undefined;
};

interface AuthoringCatalogDiagnostic {
  readonly severity?: string;
  readonly code?: string;
  readonly fieldPath?: string | null;
  readonly message?: string;
  readonly retryable?: boolean;
  readonly requestId?: string;
}

interface AuthoringCatalogColumn {
  readonly selectionId?: string;
  readonly label?: string;
  readonly group?: string;
  readonly description?: string;
  readonly examples?: ReadonlyArray<string>;
  readonly population?: number;
  readonly logicalType?: string;
  readonly repeated?: boolean;
  readonly cardinality?: string;
  readonly emittedColumnCount?: number;
  readonly expectedPublicColumn?: string;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
  readonly blocked?: boolean;
  readonly diagnostics?: ReadonlyArray<AuthoringCatalogDiagnostic>;
}

interface AuthoringCatalogNode {
  readonly nodeId?: string;
  readonly label?: string;
  readonly description?: string;
  readonly columns?: ReadonlyArray<AuthoringCatalogColumn>;
  readonly completeness?: {
    readonly complete?: boolean;
    readonly truncated?: boolean;
    readonly diagnostics?: ReadonlyArray<AuthoringCatalogDiagnostic>;
  };
}

interface AuthoringCatalogPayload {
  readonly explorerAuthoringCatalog?: {
    readonly snapshotToken?: string;
    readonly project?: string;
    readonly explorerId?: string;
    readonly sourceGeneration?: string;
    readonly authorizationScopeDigest?: string;
    readonly resolvedSchemaDigest?: string;
    readonly nodes?: ReadonlyArray<AuthoringCatalogNode>;
    readonly routeEdges?: ReadonlyArray<{
      readonly edgeId?: string;
      readonly fromNodeId?: string;
      readonly toNodeId?: string;
      readonly label?: string | null;
    }>;
    readonly completeness?: {
      readonly complete?: boolean;
      readonly truncated?: boolean;
      readonly diagnostics?: ReadonlyArray<AuthoringCatalogDiagnostic>;
    };
    readonly diagnostics?: ReadonlyArray<AuthoringCatalogDiagnostic>;
  };
}

interface AuthoringCatalogRESTPayload {
  readonly snapshotToken?: string;
  readonly project?: string;
  readonly explorerId?: string;
  readonly sourceGeneration?: string;
  readonly generation?: string;
  readonly authorizationScopeDigest?: string;
  readonly resolvedSchemaDigest?: string;
  readonly nodes?: ReadonlyArray<{
    readonly nodeId?: string;
    readonly label?: string;
    readonly resourceType?: string;
  }>;
  readonly selections?: ReadonlyArray<{
    readonly selectionId?: string;
    readonly nodeId?: string;
    readonly fieldRef?: string;
    readonly select?: string;
    readonly logicalType?: string;
    readonly filterable?: boolean;
    readonly chartable?: boolean;
  }>;
  readonly candidates?: ReadonlyArray<{
    readonly candidateId?: string;
    readonly selectionId?: string;
    readonly nodeId?: string;
    readonly path?: string;
    readonly fieldRef?: string;
    readonly label?: string;
    readonly select?: string;
    readonly logicalType?: string;
    readonly repeated?: boolean;
    readonly filterable?: boolean;
    readonly chartable?: boolean;
  }>;
  readonly routeEdges?: ReadonlyArray<{
    readonly edgeId?: string;
    readonly fromNodeId?: string;
    readonly toNodeId?: string;
    readonly label?: string;
  }>;
  readonly edges?: ReadonlyArray<{
    readonly edgeId?: string;
    readonly fromNodeId?: string;
    readonly toNodeId?: string;
    readonly label?: string;
  }>;
  readonly completeness?: {
    readonly complete?: boolean;
    readonly truncated?: boolean;
    readonly diagnostics?: ReadonlyArray<AuthoringCatalogDiagnostic>;
  };
  readonly diagnostics?: ReadonlyArray<AuthoringCatalogDiagnostic>;
}

const authoringDiagnostic = (
  diagnostic: AuthoringCatalogDiagnostic,
  fallbackCode: string,
  fallbackMessage: string,
): ExplorerDiagnostic => ({
  severity:
    diagnostic.severity?.trim().toLowerCase() === 'error' ? 'error' : 'warning',
  code: diagnostic.code?.trim() || fallbackCode,
  message: diagnostic.message?.trim() || fallbackMessage,
  fieldPath: diagnostic.fieldPath,
  retryable: diagnostic.retryable,
  requestId: diagnostic.requestId,
});

const fetchExplorerAuthoringCatalog = async (
  project: string,
  explorerId: string,
  authResourcePath?: string,
  signal?: AbortSignal,
): Promise<{
  readonly catalog: NonNullable<
    AuthoringCatalogPayload['explorerAuthoringCatalog']
  >;
  readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
  readonly complete: boolean;
  readonly snapshotToken?: string;
  readonly sourceGeneration?: string;
  readonly resolvedSchemaDigest?: string;
  readonly authScopeDigest?: string;
}> => {
  const endpoint = withAuthResourcePath(
    authoringV1Endpoint(project, explorerId, '/builder'),
    authResourcePath,
  );
  const result = await requestJson<unknown>(endpoint, {
    signal,
  });
  if (result.error) throw result.error;
  const builderPayload = unwrapExplorerEnvelope(result.data);
  if (!isRecord(builderPayload))
    throw new Error('Loom returned no Explorer Builder response.');
  const response = (isRecord(builderPayload.catalog)
    ? builderPayload.catalog
    : builderPayload) as AuthoringCatalogRESTPayload;
  const builderDiagnostics = Array.isArray(builderPayload.diagnostics)
    ? (builderPayload.diagnostics as ReadonlyArray<AuthoringCatalogDiagnostic>)
    : [];
  const columnsByNode = new Map<string, AuthoringCatalogColumn[]>();
  for (const selection of [
    ...(response.selections ?? []),
    ...(response.candidates ?? []).map((candidate) => ({
      selectionId: candidate.candidateId ?? candidate.selectionId,
      nodeId: candidate.nodeId,
      fieldRef: candidate.path ?? candidate.fieldRef,
      select: candidate.label ?? candidate.select,
      logicalType: candidate.logicalType,
      filterable: candidate.filterable,
      chartable: candidate.chartable,
    })),
  ]) {
    const nodeID = selection.nodeId?.trim();
    if (!nodeID) continue;
    const columns = columnsByNode.get(nodeID) ?? [];
    columns.push({
      selectionId: selection.selectionId,
      label: selection.fieldRef,
      description: selection.select,
      expectedPublicColumn: selection.select,
      logicalType: selection.logicalType,
      filterable: selection.filterable,
      chartable: selection.chartable,
    });
    columnsByNode.set(nodeID, columns);
  }
  const catalog: NonNullable<
    AuthoringCatalogPayload['explorerAuthoringCatalog']
  > = {
    snapshotToken: response.snapshotToken,
    project: response.project ?? stringValue(builderPayload.project),
    explorerId: response.explorerId ?? stringValue(builderPayload.explorerId),
    sourceGeneration: response.sourceGeneration ?? response.generation,
    authorizationScopeDigest: response.authorizationScopeDigest,
    resolvedSchemaDigest: response.resolvedSchemaDigest,
    nodes: (response.nodes ?? []).map((node) => ({
      nodeId: node.nodeId,
      label: node.label ?? node.resourceType,
      columns: columnsByNode.get(node.nodeId?.trim() ?? '') ?? [],
    })),
    routeEdges: response.routeEdges ?? response.edges,
    completeness: response.completeness,
    diagnostics: [...builderDiagnostics, ...(response.diagnostics ?? [])],
  };
  const diagnostics = [
    ...(catalog.diagnostics ?? []).map((diagnostic) =>
      authoringDiagnostic(
        diagnostic,
        'AUTHORING_CATALOG_DIAGNOSTIC',
        'Loom returned an authoring catalog diagnostic.',
      ),
    ),
    ...(catalog.completeness?.diagnostics ?? []).map((diagnostic) =>
      authoringDiagnostic(
        diagnostic,
        'AUTHORING_CATALOG_DIAGNOSTIC',
        'Loom returned an authoring catalog completeness diagnostic.',
      ),
    ),
  ];
  const complete =
    catalog.completeness?.complete !== false &&
    catalog.completeness?.truncated !== true &&
    diagnostics.every((diagnostic) => diagnostic.severity !== 'error');
  return {
    catalog,
    diagnostics,
    complete,
    snapshotToken: catalog.snapshotToken?.trim() || undefined,
    sourceGeneration: catalog.sourceGeneration?.trim() || undefined,
    resolvedSchemaDigest: catalog.resolvedSchemaDigest?.trim() || undefined,
    authScopeDigest: catalog.authorizationScopeDigest?.trim() || undefined,
  };
};

const stableCatalogString = (value: unknown): string => {
  if (Array.isArray(value))
    return `[${value.map(stableCatalogString).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, child]) =>
          `${JSON.stringify(key)}:${stableCatalogString(child)}`,
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const catalogDigest = async (value: unknown): Promise<string> => {
  const canonical = stableCatalogString(value);
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonical),
    );
    return `sha256:${Array.from(new Uint8Array(bytes))
      .map((item) => item.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return `canonical:${canonical}`;
};

/**
 * Normalize the supported REST catalog's value-bearing selections. The
 * catalog owns opaque selection IDs and selectors; the browser must not invent
 * either one.
 *
 * Keep this check deliberately narrow. Repeated scalar values are valid
 * columns, as are native dynamic, extension, and pivot families whose value
 * type may be reported as `unknown` until compilation resolves it.
 */
const isStructuralFieldCandidate = (valueType: string): boolean =>
  /^(array|object|map|list|struct|record|json)(?:<|\[|$)/i.test(
    valueType.trim(),
  );

const authoringCatalogColumnToCandidate = (
  column: AuthoringCatalogColumn,
  resourceType: string,
  output: string,
  nodePath: ReadonlyArray<string>,
  nodeId?: string,
): ExplorerAuthoringCandidate | undefined => {
  const id = column.selectionId?.trim();
  const selectionKey = column.label?.trim();
  const path =
    column.description?.trim() ||
    (selectionKey?.includes('.')
      ? selectionKey.slice(selectionKey.indexOf('.') + 1)
      : selectionKey);
  if (!id || !path) return undefined;
  const valueType = column.logicalType?.trim() || 'unknown';
  if (isStructuralFieldCandidate(valueType)) return undefined;
  const cardinality = column.cardinality?.trim() || '';
  const repeated =
    column.repeated === true ||
    /array|repeat|many|repeated|\[\]/i.test(
      `${valueType} ${cardinality} ${path}`,
    );
  const label =
    column.description?.trim() ||
    selectionKey ||
    path.split(/[./]/).filter(Boolean).at(-1) ||
    path;
  const diagnostics = column.diagnostics ?? [];
  const blockingDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.severity?.trim().toLowerCase() === 'error',
  );
  const valueSelector = path;
  return {
    id,
    nodeId: nodeId?.trim() || undefined,
    resourceType,
    path,
    label,
    publicName: column.expectedPublicColumn?.trim() || path,
    logicalType: valueType,
    repeated,
    populationCount: column.population,
    examples: column.examples,
    family: 'field',
    filterable: column.filterable ?? !repeated,
    chartable:
      column.chartable ??
      (!repeated && /number|integer|decimal|date|boolean/i.test(valueType)),
    selectionKey: selectionKey || path,
    valueSelector,
    familyName: 'Fields',
    familyKind: 'FIELD',
    nodePath,
    output,
    population: column.population,
    complete: !column.blocked && !blockingDiagnostic,
    diagnostic: blockingDiagnostic?.message?.trim() || undefined,
  };
};

const collectTraversalNodes = (
  output: RecipeOutputV2,
  nodePath: ReadonlyArray<string> = [],
): ReadonlyArray<{
  readonly resourceType: string;
  readonly nodePath: ReadonlyArray<string>;
}> => {
  const outputRecord = output;
  const result: Array<{
    readonly resourceType: string;
    readonly nodePath: ReadonlyArray<string>;
  }> = outputRecord.rootResourceType
    ? [{ resourceType: outputRecord.rootResourceType, nodePath }]
    : [];
  const visit = (
    nodes: ReadonlyArray<RecipeTraversalV2>,
    parentPath: ReadonlyArray<string>,
  ) =>
    nodes.forEach((node) => {
      const resourceType = node.toResourceType ?? node.resourceType;
      if (!resourceType) return;
      const path = [...parentPath, node.alias];
      result.push({ resourceType, nodePath: path });
      visit(node.children ?? [], path);
    });
  visit(outputRecord.traversals ?? [], nodePath);
  return result;
};

const canonicalOutputName = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) return 'output';
  return value.trim();
};

/**
 * The restored Builder still renders the V2 graph/presentation model. Loom's
 * wire response is deliberately V1-only, so this adapter translates the
 * canonical authoring bundle and server-owned runtime into that renderer
 * model at the frontend boundary. It never changes the response Loom sends
 * or puts legacy fields back on the server.
 */
const explorerConfigFromCanonicalBundle = (
  bundle: unknown,
  state: ExplorerStateV1,
): ExplorerConfigV2 | undefined => {
  if (!isRecord(bundle)) return undefined;
  const pluralDocuments = Array.isArray(bundle.documents)
    ? bundle.documents.filter(isRecord)
    : [];
  const documents = pluralDocuments.length > 0
    ? pluralDocuments
    : isRecord(bundle.document)
      ? [bundle.document]
      : [];
  const runtimeOutputs = state.runtime?.outputs ?? [];
  const generatedOutputs = state.generated.dataset?.outputs ?? [];
  const outputFor = (document: Record<string, unknown>) => {
    const output = isRecord(document.output) ? document.output : {};
    const outputId = canonicalOutputName(output.id);
    const runtime = runtimeOutputs.find(
      (candidate) =>
        candidate.outputId === outputId || candidate.name === outputId,
    );
    const generated = generatedOutputs.find(
      (candidate) => candidate.name === outputId,
    );
    const name = canonicalOutputName(runtime?.name ?? generated?.name ?? outputId);
    const title = canonicalOutputName(
      output.title ?? runtime?.title ?? name,
    );
    const rootResourceType = (() => {
      const source = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const known: Record<string, string> = {
        patient: 'Patient',
        documentreference: 'DocumentReference',
        file: 'DocumentReference',
        specimen: 'Specimen',
        medicationadministration: 'MedicationAdministration',
        groupmember: 'GroupMember',
        researchsubject: 'ResearchSubject',
      };
      return known[source] ?? name;
    })();
    const runtimeColumns = (() => {
      const raw = runtime?.columns;
      if (Array.isArray(raw)) return raw;
      if (isRecord(raw)) return Object.values(raw);
      return [];
    })().filter(isRecord);
    const fields = runtimeColumns.flatMap((column) => {
      const fieldName =
        typeof column.name === 'string' ? column.name.trim() : '';
      if (!fieldName) return [];
      return [
        {
          name: fieldName,
          label:
            typeof column.label === 'string' ? column.label : fieldName,
          logicalType:
            typeof column.logicalType === 'string'
              ? column.logicalType
              : 'string',
          selectionKey: fieldName,
          valueSelector: fieldName,
          filterable: column.filterable !== false,
          chartable: column.chartable === true,
        },
      ];
    });
    const columnsByEmission = new Map(
      runtimeColumns.flatMap((column) =>
        typeof column.emissionId === 'string' && typeof column.name === 'string'
          ? [[column.emissionId, column.name] as const]
          : [],
      ),
    );
    const tableColumns = (runtime?.table?.columns ?? []).flatMap((column) => {
      const name = columnsByEmission.get(column.emissionId);
      return name ? [{ column: name, visible: column.visible !== false }] : [];
    });
    const visibleColumns =
      tableColumns.length > 0
        ? tableColumns
        : fields.map((field) => ({ column: field.name, visible: true }));
    const bindingColumn = (binding: { readonly emissionId?: string }) =>
      binding.emissionId ? columnsByEmission.get(binding.emissionId) : undefined;
    const filters = (runtime?.filters ?? []).flatMap((binding) => {
      const column = bindingColumn(binding);
      return column
        ? [{ column, ...(binding.label ? { label: binding.label } : {}) }]
        : [];
    });
    const charts = (runtime?.charts ?? []).flatMap((binding) => {
      const column = bindingColumn(binding);
      return column
        ? [
            {
              column,
              type: binding.type ?? 'bar',
              ...(binding.title ? { title: binding.title } : {}),
            },
          ]
        : [];
    });
    return {
      name,
      title,
      rootResourceType,
      fields,
      traversals: [],
      view: {
        id: outputId || name,
        title,
        output: name,
        rowLabel: runtime?.rowLabel,
        table: { columns: visibleColumns },
        filters,
        charts,
        fixedFilters: runtime?.fixedFilters ?? {},
      },
    };
  };
  const outputs = documents.map(outputFor);
  if (outputs.length === 0) return undefined;
  const tabs = Array.isArray(bundle.tabs)
    ? bundle.tabs.filter(isRecord)
    : [];
  const views = outputs.map((output) => {
    const tab = tabs.find(
      (candidate) => candidate.outputId === output.name || candidate.outputId === output.view.output,
    );
    return {
      ...output.view,
      id: typeof tab?.id === 'string' ? tab.id : output.view.id,
      title: typeof tab?.title === 'string' ? tab.title : output.view.title,
    };
  });
  const firstRuntime = runtimeOutputs[0];
  return {
    apiVersion: 'loom.calypr.org/explorer-config/v2',
    kind: 'ExplorerConfig',
    project: state.project,
    explorer: {
      id: state.explorerId,
      title: state.title,
      management:
        state.management === 'REPOSITORY' || state.management === 'repository'
          ? 'repository'
          : 'interactive',
    },
    recipe: {
      // The executable recipe envelope uses `name`; `recipeName` belongs to
      // lifecycle metadata and is rejected by Loom's strict recipe decoder.
      name: firstRuntime?.selector?.recipe,
      translationVersion: firstRuntime?.selector?.translationVersion,
      outputs: outputs.map(({ view: _view, ...output }) => output),
    },
    views,
  };
};

const legacyStateFromCanonical = (
  state: ExplorerStateV1,
): ExplorerState => {
  canonicalBundleCache.set(authoringCacheKey(state.project, state.explorerId), {
    draft: state.draft.bundle,
    active: state.active.bundle,
    draftReceiptId: state.draft.receiptId,
    runtime: state.runtime,
    generated: state.generated,
  });
  const draftConfig = explorerConfigFromCanonicalBundle(state.draft.bundle, state);
  const activeConfig = explorerConfigFromCanonicalBundle(state.active.bundle, state);
  return {
    project: state.project,
    explorerId: state.explorerId,
    management:
      state.management === 'REPOSITORY' || state.management === 'repository'
        ? 'REPOSITORY'
        : 'INTERACTIVE',
    ...(draftConfig ? { draftConfig } : {}),
    ...(activeConfig ? { activeConfig } : {}),
    draftVersion: state.draft.version,
    draftDigest: state.draft.digest,
    activeRevisionId: state.active.revisionId,
    updatedBy: state.updatedBy,
    updatedAt: state.updatedAt,
    recipeDigest: state.generated.recipeDigest,
    resolvedSchemaDigest: state.generated.resolvedSchemaDigest,
    sourceGeneration: state.generated.sourceGeneration,
    activeUrl: state.activeUrl,
    diagnostics: state.generated.diagnostics,
    publication: state.generated.publication
      ? {
          state: state.generated.publication.state,
          generation: state.generated.publication.generation,
          executionId: state.generated.publication.executionId,
          revisionId: state.generated.publication.revisionId,
          updatedAt: state.generated.publication.updatedAt,
        }
      : undefined,
  };
};

const normalizeExplorerState = (
  payload: unknown,
  project: string,
  explorerId: string,
): ExplorerState => {
  const unwrapped = unwrapExplorerEnvelope(payload);
  if (isExplorerStateV1(unwrapped)) return legacyStateFromCanonical(unwrapped);
  const value = unwrapped as Partial<ExplorerState> &
    Partial<RepositoryExplorerConfig>;
  const draftConfig = value.draftConfig;
  const rawManagement = (value as { readonly management?: unknown }).management;
  const management =
    rawManagement === 'repository'
      ? 'REPOSITORY'
      : rawManagement === 'interactive'
        ? 'INTERACTIVE'
        : value.management ??
          (explorerId === 'default' ? 'REPOSITORY' : 'INTERACTIVE');
  const hasPublishedConfig = Boolean(value.activeConfig);
  const isRepositoryMetadata =
    !draftConfig &&
    !hasPublishedConfig &&
    (management === 'REPOSITORY' || explorerId === 'default');
  const isSummaryOnlyMetadata =
    !draftConfig &&
    !hasPublishedConfig &&
    (typeof (value as { readonly title?: unknown }).title === 'string' ||
      typeof value.activeRevisionId === 'string' ||
      typeof value.updatedAt === 'string');
  if (!draftConfig && !hasPublishedConfig && !isRepositoryMetadata && !isSummaryOnlyMetadata)
    throw new Error(
      'Explorer response did not include draftConfig or activeConfig.',
    );
  return {
    project: value.project ?? project,
    explorerId: value.explorerId ?? explorerId,
    management,
    ...(draftConfig ? { draftConfig } : {}),
    baselineConfig: value.baselineConfig,
    draftVersion: value.draftVersion ?? 0,
    draftDigest: value.draftDigest ?? '',
    activeConfig: value.activeConfig,
    activeRevisionId: value.activeRevisionId,
    updatedBy: value.updatedBy,
    updatedAt: value.updatedAt,
    diagnostics: value.diagnostics,
    dataset: value.dataset,
    emittedColumns: value.emittedColumns,
    publication: value.publication,
    publicationState: value.publicationState,
    datasets: value.datasets,
    materializations: value.materializations,
    publicationId: value.publicationId,
    recipeDigest: value.recipeDigest,
    resolvedSchemaDigest: value.resolvedSchemaDigest,
    sourceGeneration: value.sourceGeneration,
    sourceCommit: value.sourceCommit,
    executionId: value.executionId,
    recipeName: value.recipeName,
    translationVersion: value.translationVersion,
    physicalColumns: value.physicalColumns,
    materializationMappings: value.materializationMappings,
    frozenMaterializationMappings: value.frozenMaterializationMappings,
    publishedAt: value.publishedAt,
    activeUrl: value.activeUrl,
    shareUrl: value.shareUrl,
  };
};

const requestJson = async <T>(
  endpoint: string,
  init: RequestInit = {},
  csrfToken?: string,
): Promise<{ readonly data?: T; readonly error?: ExplorerApiError }> => {
  try {
    const headers = new Headers(init.headers);
    if (csrfToken && !headers.has('X-CSRF-Token'))
      headers.set('X-CSRF-Token', csrfToken);
    const response = await fetchLoomResponse(endpoint, {
      ...init,
      headers,
    });
    handleUnauthorizedStatus(response.status);
    if (!response.ok)
      return { error: await errorFromResponse(response, endpoint) };
    return { data: await parseBody<T>(response) };
  } catch (error) {
    return { error: errorFromUnknown(error, endpoint, 'REQUEST_FAILED') };
  }
};

const authoringV1Endpoint = (project: string, explorerId: string, suffix = '') =>
  `${explorerRoot(project)}/${encodeURIComponent(explorerId)}/authoring/v1${suffix}`;

const stringValue = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const rawAuthoringCatalog = async (
  project: string,
  explorerId: string,
  authResourcePath: string | undefined,
  signal: AbortSignal | undefined,
  apiState: CoreState,
): Promise<{ readonly data?: AuthoringV1Catalog; readonly error?: ExplorerApiError }> => {
  const key = authoringCacheKey(project, explorerId);
  const cached = authoringCatalogCache.get(key);
  if (cached && authoringEmissionCache.has(key)) return { data: cached };
  const endpoint = withAuthResourcePath(
    authoringV1Endpoint(project, explorerId, '/builder'),
    authResourcePath,
  );
  const result = await requestJson<unknown>(
    endpoint,
    { signal },
    selectCSRFToken(apiState),
  );
  if (result.error) return { error: result.error };
  const builderPayload = unwrapExplorerEnvelope(result.data);
  if (isRecord(builderPayload)) {
    // The combined Builder response is the authoritative source for opaque
    // route identities. Keep its bundle alongside the parsed catalog so the
    // V2 compatibility editor does not have to rediscover base/row nodes from
    // resource labels when a presentation-only edit triggers preview.
    if (isRecord(builderPayload.bundle)) {
      const cachedBundle = canonicalBundleCache.get(key);
      canonicalBundleCache.set(key, {
        ...cachedBundle,
        draft: builderPayload.bundle,
      });
    }
    const bindings = (Array.isArray(builderPayload.bindings)
      ? builderPayload.bindings
      : []
    ).filter(isRecord);
    authoringRouteCache.set(
      key,
      bindings.flatMap((binding) => {
        const outputId = stringValue(binding.outputId);
        if (!outputId) return [];
        return [{
          outputId,
          baseNodeId: stringValue(binding.baseNodeId),
          baseResourceType: stringValue(binding.baseResourceType),
          rowNodeId: stringValue(binding.rowNodeId),
          rowResourceType: stringValue(binding.rowResourceType),
        }];
      }),
    );
    const emissions = bindings.flatMap((binding) => {
      const outputId = stringValue(binding.outputId);
      if (!outputId || !Array.isArray(binding.candidateEmissions)) return [];
      return binding.candidateEmissions.filter(isRecord).flatMap((emission) => {
        const emissionId = stringValue(emission.emissionId);
        if (!emissionId) return [];
        return [{
          outputId,
          emissionId,
          candidateId: stringValue(emission.candidateId),
          occurrenceId: stringValue(emission.occurrenceId),
        }];
      });
    });
    authoringEmissionCache.set(key, emissions);
  }
  const payload = isRecord(builderPayload) && isRecord(builderPayload.catalog)
    ? builderPayload.catalog
    : builderPayload;
  if (!isRecord(payload)) {
    return { error: { status: 502, code: 'INVALID_EXPLORER_CATALOG_V1', message: 'Loom returned an invalid authoring catalog.' } };
  }
  const nodes = (Array.isArray(payload.nodes) ? payload.nodes : [])
    .filter(isRecord)
    .flatMap((node) => {
      const nodeId = stringValue(node.nodeId);
      if (!nodeId) return [];
      return [{ nodeId, resourceType: stringValue(node.resourceType) ?? stringValue(node.label), label: stringValue(node.label) }];
    });
  const routeEdges = (Array.isArray(payload.routeEdges)
    ? payload.routeEdges
    : Array.isArray(payload.edges)
      ? payload.edges
      : [])
    .filter(isRecord)
    .flatMap((edge) => {
      const edgeId = stringValue(edge.edgeId);
      const fromNodeId = stringValue(edge.fromNodeId);
      const toNodeId = stringValue(edge.toNodeId);
      if (!edgeId || !fromNodeId || !toNodeId) return [];
      return [{ edgeId, fromNodeId, toNodeId, label: stringValue(edge.label) }];
    });
  const candidates = (Array.isArray(payload.candidates)
    ? payload.candidates
    : Array.isArray(payload.selections)
      ? payload.selections
      : [])
    .filter(isRecord)
    .flatMap((candidate) => {
      const candidateId = stringValue(candidate.candidateId) ?? stringValue(candidate.selectionId);
      const nodeId = stringValue(candidate.nodeId);
      if (!candidateId || !nodeId) return [];
      return [{
        candidateId,
        nodeId,
        path: stringValue(candidate.path) ?? stringValue(candidate.fieldRef) ?? stringValue(candidate.select),
        fieldRef: stringValue(candidate.fieldRef),
        label: stringValue(candidate.label),
        logicalType: stringValue(candidate.logicalType),
        repeated: candidate.repeated === true,
        filterable: candidate.filterable !== false,
        chartable: candidate.chartable === true,
      }];
    });
  const snapshotToken = stringValue(payload.snapshotToken);
  if (!snapshotToken) {
    return { error: { status: 502, code: 'CATALOG_SNAPSHOT_MISSING', message: 'Loom did not return an authoring catalog snapshot token.' } };
  }
  const data: AuthoringV1Catalog = {
    snapshotToken,
    sourceGeneration: stringValue(payload.sourceGeneration),
    resolvedSchemaDigest: stringValue(payload.resolvedSchemaDigest),
    authorizationScopeDigest: stringValue(payload.authorizationScopeDigest ?? payload.authScopeDigest),
    nodes,
    routeEdges,
    candidates,
  };
  authoringCatalogCache.set(key, data);
  return { data };
};

const outputIdFor = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'output';

const outputDocumentsFromBundle = (bundle: unknown): ReadonlyArray<Record<string, unknown>> => {
  if (!isRecord(bundle)) return [];
  const documents = Array.isArray(bundle.documents) ? bundle.documents.filter(isRecord) : [];
  if (documents.length > 0) return documents;
  return isRecord(bundle.document) ? [bundle.document] : [];
};

const canonicalDocumentFor = (
  project: string,
  explorerId: string,
  outputId: string,
): Record<string, unknown> | undefined => {
  const cached = canonicalBundleCache.get(authoringCacheKey(project, explorerId));
  for (const bundle of [cached?.draft, cached?.active]) {
    const found = outputDocumentsFromBundle(bundle).find((document) => {
      const output = isRecord(document.output) ? document.output : undefined;
      return outputIdFor(stringValue(output?.id) ?? '') === outputId;
    });
    if (found) return found;
  }
  return undefined;
};

const presentationFromLegacyView = (
  project: string,
  explorerId: string,
  outputId: string,
  view: ExplorerConfigV2['views'][number] | undefined,
  candidateIds: ReadonlyArray<string>,
): Readonly<Record<string, unknown>> => {
  const cached = canonicalBundleCache.get(authoringCacheKey(project, explorerId));
  const runtimeOutput = cached?.runtime?.outputs.find(
    (candidate) => candidate.outputId === outputId || outputIdFor(candidate.name) === outputId,
  );
  const runtimeColumns = (() => {
    const raw = runtimeOutput?.columns;
    if (Array.isArray(raw)) return raw;
    if (isRecord(raw)) return Object.values(raw);
    return [];
  })().filter(isRecord);
  if (!view || runtimeColumns.length === 0) return {};
  const runtimeEmissionIds = new Set(
    runtimeColumns.flatMap((column) => {
      const emissionId = stringValue(column.emissionId);
      return emissionId ? [emissionId] : [];
    }),
  );
  const presentation: Record<string, unknown> = {};
  const emittedById = new Map(
    (cached?.generated?.emittedColumns ?? []).map((column) => [column.emissionId, column]),
  );
  for (const emissionId of Object.keys(presentation)) {
    const candidateId = emittedById.get(emissionId)?.candidateId;
    if (!candidateId || !candidateIds.includes(candidateId)) delete presentation[emissionId];
  }
  for (const column of runtimeColumns) {
    const emissionId = stringValue(column.emissionId);
    const name = stringValue(column.name);
    if (!emissionId || !name) continue;
    const candidateId = emittedById.get(emissionId)?.candidateId;
    if (!runtimeEmissionIds.has(emissionId) || !candidateId || !candidateIds.includes(candidateId)) continue;
    const existing = {};
    const tableColumnIndex = view.table.columns.findIndex(
      (candidate) => candidate.column === name,
    );
    const tableColumn = tableColumnIndex >= 0
      ? view.table.columns[tableColumnIndex]
      : undefined;
    const next: Record<string, unknown> = {
      ...existing,
      visible: tableColumn?.visible ?? false,
      order: tableColumn ? tableColumnIndex : undefined,
      ...(tableColumn?.label ? { label: tableColumn.label } : {}),
      table: {},
    };
    if (view.filters) {
      const filter = view.filters.find((candidate) => candidate.column === name);
      if (filter) next.filter = filter.label ? { label: filter.label } : {};
      else delete next.filter;
    }
    if (view.charts) {
      const chart = view.charts.find((candidate) => candidate.column === name);
      if (chart) next.chart = { type: chart.type, ...(chart.title ? { title: chart.title } : {}) };
      else delete next.chart;
    }
    presentation[emissionId] = next;
  }
  return presentation;
};

const fieldMatchesV1Candidate = (
  field: RecipeFieldV2,
  candidate: AuthoringV1Candidate,
): boolean => {
  const expressionSelectors = (value: unknown): string[] => {
    if (!isRecord(value)) return [];
    const selectors = typeof value.select === 'string' ? [value.select] : [];
    const nested = Object.values(value).flatMap((child) =>
      Array.isArray(child)
        ? child.flatMap(expressionSelectors)
        : expressionSelectors(child),
    );
    return [...selectors, ...nested];
  };
  const names = [
    field.name,
    field.selectionKey,
    field.valueSelector,
    ...expressionSelectors(field.expr),
  ].filter(
    (value): value is string => typeof value === 'string',
  ).flatMap((value) => {
    const normalized = value.toLowerCase().replace(/^root[.]/, '');
    return [normalized, normalized.replace(/[^a-z0-9]/g, '')];
  });
  const candidateNames = [candidate.path, candidate.fieldRef, candidate.label]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => [value.toLowerCase(), value.toLowerCase().replace(/[^a-z0-9]/g, '')]);
  return names.some((name) => candidateNames.includes(name) || candidateNames.some((candidateName) => candidateName.endsWith(`.${name}`) || name.endsWith(`.${candidateName}`) || candidateName.endsWith(name) || name.endsWith(candidateName)));
};

const semanticTokens = (value: string): string[] =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const tokenSequenceMatches = (
  left: ReadonlyArray<string>,
  right: ReadonlyArray<string>,
): boolean => {
  if (left.length === 0 || right.length === 0) return false;
  const matchesAt = (source: ReadonlyArray<string>, target: ReadonlyArray<string>) =>
    source.length >= target.length &&
    target.every((token, index) => source[source.length - target.length + index] === token);
  return matchesAt(left, right) || matchesAt(right, left);
};

const v1CandidateMatchesSemanticColumn = (
  column: string,
  candidate: AuthoringV1Candidate,
): boolean => {
  const columnTokens = semanticTokens(column);
  if (columnTokens.length === 0) return false;
  return [candidate.path, candidate.fieldRef, candidate.label]
    .filter((value): value is string => Boolean(value))
    .map(semanticTokens)
    .some((tokens) => {
      const variants = [
        tokens,
        ['value', 'code', 'display', 'system', 'use', 'reference', 'text'].includes(tokens[tokens.length - 1] ?? '')
          ? tokens.slice(0, -1)
          : tokens,
      ];
      return variants.some((variant) => tokenSequenceMatches(variant, columnTokens));
    });
};

type AuthoringBundleBuild = {
  readonly bundle: AuthoringV1Bundle;
  readonly columnBindings: ReadonlyArray<AuthoringColumnBinding>;
};

const authoringBundleFromV2Config = (
  config: ExplorerConfigV2,
  project: string,
  explorerId: string,
  selectedCandidateIdsByNode: Readonly<Record<string, ReadonlyArray<string>>> | undefined,
  catalog: AuthoringV1Catalog,
  selectedOutput?: string,
): AuthoringBundleBuild => {
  const nodeForResource = (resourceType: string | undefined): AuthoringV1Node | undefined => {
    if (!resourceType) return undefined;
    return catalog.nodes.find((node) => (node.resourceType ?? node.label ?? '').toLowerCase() === resourceType.toLowerCase());
  };
  const nodeById = new Map(catalog.nodes.map((node) => [node.nodeId, node]));
  const candidateById = new Map(catalog.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const columnBindings: AuthoringColumnBinding[] = [];
  const docs = (config.recipe.outputs ?? []).map((output) => {
    const view = config.views.find((candidate) => candidate.output === output.name);
    const cachedDocument = canonicalDocumentFor(project, explorerId, outputIdFor(output.name));
    const cachedOutput = isRecord(cachedDocument?.output) ? cachedDocument.output : undefined;
    const outputId = outputIdFor(stringValue(cachedOutput?.id) ?? output.name);
    const cachedBase = stringValue(cachedDocument?.baseNodeId);
    const rootResourceType = output.rootResourceType?.trim();
    const cachedBaseResource = cachedBase
      ? nodeById.get(cachedBase)?.resourceType ?? nodeById.get(cachedBase)?.label
      : undefined;
    const cachedBinding = authoringRouteCache
      .get(authoringCacheKey(project, explorerId))
      ?.find(
        (binding) =>
          outputIdFor(binding.outputId) === outputIdFor(outputId),
      );
    const cachedRootResourceTypes = [
      cachedBaseResource,
      cachedBinding?.baseResourceType,
    ].filter((value): value is string => Boolean(value));
    const cachedBaseMatchesRoot = Boolean(
      cachedBase &&
      nodeById.has(cachedBase) &&
      rootResourceType &&
      cachedRootResourceTypes.some(
        (resourceType) =>
          resourceType.toLowerCase() === rootResourceType.toLowerCase(),
      ),
    );
    const baseNode = (cachedBaseMatchesRoot
      ? cachedBase
      : nodeForResource(rootResourceType)?.nodeId) ?? '';
    const cachedEdges = Array.isArray(cachedDocument?.routeEdgeIds)
      ? cachedDocument.routeEdgeIds.filter((value): value is string => typeof value === 'string')
      : [];
    const cachedRow = stringValue(cachedDocument?.rowNodeId);
    // A legacy V2 packet can contain several branched ETL traversals under a
    // single row output. The V1 authoring document stores one row route and
    // cannot faithfully encode those recipe branches; keep the executable
    // recipe ETL-owned during migration instead of inventing a wrong linear
    // route. Ordinary Builder edits still use the authored one-hop route.
    const traversals = config.__legacyMigration === true
      ? []
      : output.traversals ?? [];
    const edgeIds = cachedBaseMatchesRoot && traversals.length === 0 && cachedEdges.length > 0 && cachedRow && nodeById.has(cachedRow)
      ? cachedEdges
      : [];
    let currentNodeId = baseNode;
    const generatedRouteEdges: string[] = [];
    const routeOccurrences: Array<NonNullable<AuthoringV1Document['routeOccurrences']>[number]> = [];
    for (const traversal of traversals) {
      const targetResource = traversal.toResourceType ?? traversal.resourceType;
      const label = traversal.name ?? traversal.relationship;
      const edge = catalog.routeEdges.find((candidate) => {
        if (candidate.fromNodeId !== currentNodeId && candidate.toNodeId !== currentNodeId) return false;
        const nextNode = candidate.fromNodeId === currentNodeId ? candidate.toNodeId : candidate.fromNodeId;
        const nextResource = nodeById.get(nextNode)?.resourceType ?? nodeById.get(nextNode)?.label;
        return (!targetResource || nextResource?.toLowerCase() === targetResource.toLowerCase()) && (!label || candidate.label?.toLowerCase() === label.toLowerCase());
      });
      if (!edge) break;
      generatedRouteEdges.push(edge.edgeId);
      currentNodeId = edge.fromNodeId === currentNodeId ? edge.toNodeId : edge.fromNodeId;
      routeOccurrences.push({ id: `route_${routeOccurrences.length}`, index: routeOccurrences.length, nodeId: currentNodeId, incomingEdgeId: edge.edgeId });
    }
    const routeEdgeIds = edgeIds.length > 0 ? edgeIds : generatedRouteEdges;
    const rowNodeId = edgeIds.length > 0 ? cachedRow ?? baseNode : (currentNodeId || baseNode);
    const selected = new Set<string>();
    if (!selectedOutput || selectedOutput === output.name)
      for (const ids of Object.values(selectedCandidateIdsByNode ?? {})) ids.forEach((id) => selected.add(id));
    const cachedRouteOccurrences = Array.isArray(cachedDocument?.routeOccurrences)
      ? cachedDocument.routeOccurrences.filter(isRecord).flatMap((occurrence) => {
          const id = stringValue(occurrence.id);
          const index = typeof occurrence.index === 'number' ? occurrence.index : undefined;
          const nodeId = stringValue(occurrence.nodeId);
          const incomingEdgeId = stringValue(occurrence.incomingEdgeId);
          return id && index !== undefined && nodeId
            ? [{ id, index, nodeId, ...(incomingEdgeId ? { incomingEdgeId } : {}) }]
            : [];
        })
      : [];
    const normalizedRouteOccurrences = cachedRouteOccurrences.length === routeEdgeIds.length || cachedRouteOccurrences.length === routeEdgeIds.length + 1
      ? cachedRouteOccurrences
      : routeOccurrences.length > 0
        ? routeOccurrences
        : routeEdgeIds.map((edgeId, index) => ({ id: `route_${index}`, index, nodeId: rowNodeId, incomingEdgeId: edgeId }));
    if (selected.size === 0) {
      for (const candidate of catalog.candidates) {
        const fields = candidate.nodeId === baseNode
          ? output.fields ?? []
          : traversals.flatMap((traversal, index) =>
              routeOccurrences[index]?.nodeId === candidate.nodeId
                ? traversal.fields ?? []
                : [],
            );
        const configuredColumns = view?.table.columns ?? [];
        if (
          fields.some((field) => fieldMatchesV1Candidate(field, candidate)) ||
          configuredColumns.some((column) =>
            v1CandidateMatchesSemanticColumn(column.column, candidate),
          )
        )
          selected.add(candidate.candidateId);
      }
    }
    if (selected.size === 0 && isRecord(cachedDocument)) {
      const cachedCandidates = Array.isArray(cachedDocument.candidateIds) ? cachedDocument.candidateIds : [];
      cachedCandidates.filter((id): id is string => typeof id === 'string').forEach((id) => selected.add(id));
    }
    const routeNodeIds = new Set([
      baseNode,
      ...normalizedRouteOccurrences.map((occurrence) => occurrence.nodeId),
    ]);
    const candidateIds = [...selected].filter((id) => {
      const candidate = candidateById.get(id);
      return Boolean(candidate && routeNodeIds.has(candidate.nodeId));
    });
    const cachedCandidateOccurrences = Array.isArray(cachedDocument?.candidateOccurrences)
      ? cachedDocument.candidateOccurrences.filter(isRecord).flatMap((occurrence) => {
          const candidateId = stringValue(occurrence.candidateId);
          const occurrenceId = stringValue(occurrence.occurrenceId);
          return candidateId && occurrenceId && candidateIds.includes(candidateId)
            ? [{ candidateId, occurrenceId }]
            : [];
        })
      : [];
    const candidateOccurrences = cachedCandidateOccurrences.length > 0
      ? cachedCandidateOccurrences
      : candidateIds.flatMap((candidateId) => {
          const candidate = candidateById.get(candidateId);
          if (!candidate) return [];
          if (candidate.nodeId === baseNode) return [{ candidateId, occurrenceId: 'base' }];
          const occurrence = normalizedRouteOccurrences.find((item) => item.nodeId === candidate.nodeId);
          return occurrence ? [{ candidateId, occurrenceId: occurrence.id }] : [];
        });
    for (const selection of candidateOccurrences) {
      const { candidateId, occurrenceId } = selection;
      const candidate = candidateById.get(candidateId);
      if (!candidate || !occurrenceId) continue;
      const cachedEmission = authoringEmissionCache
        .get(authoringCacheKey(project, explorerId))
        ?.find(
          (emission) =>
            emission.outputId === outputId &&
            emission.candidateId === candidateId &&
            emission.occurrenceId === occurrenceId,
        );
      const fields = [
        ...(output.fields ?? []),
        ...traversals.flatMap((traversal) => traversal.fields ?? []),
      ];
      const field = fields.find((item) => fieldMatchesV1Candidate(item, candidate));
      const tableColumn = view?.table.columns.find((item) => {
        const identity = item as typeof item & { readonly emissionId?: string };
        return cachedEmission?.emissionId
          ? identity.emissionId === cachedEmission.emissionId
          : v1CandidateMatchesSemanticColumn(item.column, candidate);
      }) ?? view?.table.columns.find((item) =>
        v1CandidateMatchesSemanticColumn(item.column, candidate),
      );
      const semanticColumn = tableColumn?.column ?? field?.name ?? candidate.path ?? candidate.label ?? candidateId;
      columnBindings.push({
        outputId,
        semanticColumn,
        ...(tableColumn?.label ? { label: tableColumn.label } : {}),
        candidateId,
        occurrenceId,
        emissionId: cachedEmission?.emissionId,
      });
    }
    return {
      kind: 'ExplorerBuilderDocument' as const,
      output: { id: outputId, title: output.title ?? view?.title ?? output.name },
      baseNodeId: baseNode,
      rowNodeId,
      routeEdgeIds: routeEdgeIds.length > 0 ? routeEdgeIds : undefined,
      routeOccurrences: routeEdgeIds.length > 0
        ? normalizedRouteOccurrences
        : undefined,
      candidateIds,
      candidateOccurrences,
      presentation: presentationFromLegacyView(project, explorerId, outputId, view, candidateIds),
    };
  });
  const tabs = (config.recipe.outputs ?? []).map((output, order) => {
    const view = config.views.find((candidate) => candidate.output === output.name);
    return {
      id: outputIdFor(view?.id ?? output.name),
      title: view?.title ?? output.title ?? output.name,
      outputId: outputIdFor(output.name),
      order,
    };
  });
  return {
    bundle: {
      apiVersion: 'loom.calypr.org/explorer-authoring/v1',
      kind: 'ExplorerAuthoringBundle',
      project,
      explorerId,
      title: config.explorer.title,
      documents: docs,
      tabs,
    },
    columnBindings,
  };
};

/**
 * V1 presentation is keyed by server-owned emission IDs, while the legacy
 * Builder stores presentation against semantic column names. The combined
 * Builder read already resolves those emission IDs; reuse that response when
 * publishing instead of calling the removed standalone compile route.
 */
const hydrateAuthoringPresentation = (
  bundle: AuthoringV1Bundle,
  config: ExplorerConfigV2,
  catalog: AuthoringV1Catalog,
): { readonly bundle?: AuthoringV1Bundle; readonly error?: ExplorerApiError } => {
  const bindingsByIdentity = new Map(
    bundle.documents.flatMap((document) =>
      (document.candidateOccurrences ?? []).flatMap((occurrence) => {
        const binding = catalog.candidates.find(
          (candidate) => candidate.candidateId === occurrence.candidateId,
        );
        return binding
          ? [[
              `${document.output.id}\u0000${occurrence.candidateId}\u0000${occurrence.occurrenceId}`,
              { candidate: binding, occurrenceId: occurrence.occurrenceId },
            ] as const]
          : [];
      }),
    ),
  );
  const resolvedEmissions = authoringEmissionCache.get(
    authoringCacheKey(config.project, config.explorer.id),
  ) ?? [];
  const builtDocuments: AuthoringV1Document[] = [];
  for (const document of bundle.documents) {
    if (!document.candidateIds || document.candidateIds.length === 0) {
      builtDocuments.push(document);
      continue;
    }
    const emittedColumns = resolvedEmissions.filter(
      (emission) => emission.outputId === document.output.id,
    );
    if (emittedColumns.length === 0) {
      builtDocuments.push(document);
      continue;
    }
    const outputName = config.recipe.outputs?.find(
      (output) => outputIdFor(output.name) === outputIdFor(document.output.id),
    )?.name;
    const view = config.views.find((candidate) => candidate.output === outputName);
    const presentation: Record<string, unknown> = {};
    emittedColumns.forEach((emission) => {
      if (!emission.candidateId) return;
      const occurrenceId = emission.occurrenceId ?? 'base';
      const binding = bindingsByIdentity.get(
        `${document.output.id}\u0000${emission.candidateId}\u0000${occurrenceId}`,
      );
      if (!binding) return;
      const matchesEmission = (item: { readonly column: string }) => {
        const identified = item as typeof item & {
          readonly emissionId?: string;
        };
        return identified.emissionId
          ? identified.emissionId === emission.emissionId
          : v1CandidateMatchesSemanticColumn(
              item.column,
              binding.candidate,
            );
      };
      const tableColumnIndex =
        view?.table.columns.findIndex(matchesEmission) ?? -1;
      const tableColumn = tableColumnIndex >= 0
        ? view?.table.columns[tableColumnIndex]
        : undefined;
      const filter = view?.filters?.find(matchesEmission);
      const chart = view?.charts?.find(matchesEmission);
      if (!tableColumn && !filter && !chart && view) return;
      presentation[emission.emissionId] = {
        visible: tableColumn?.visible ?? !view,
        ...(tableColumn ? { order: tableColumnIndex } : {}),
        ...(tableColumn?.label ? { label: tableColumn.label } : {}),
        table: {},
        ...(filter ? { filter: filter.label ? { label: filter.label } : {} } : {}),
        ...(chart
          ? {
              chart: {
                type: chart.type,
                ...(chart.title ? { title: chart.title } : {}),
              },
            }
          : {}),
      };
    });
    builtDocuments.push({
      ...document,
      ...(Object.keys(presentation).length > 0 ? { presentation } : {}),
    });
  }
  return { bundle: { ...bundle, documents: builtDocuments } };
};

const buildAuthoringV1Bundle = async (
  config: ExplorerConfigV2,
  project: string,
  explorerId: string,
  selectedCandidateIdsByNode: Readonly<Record<string, ReadonlyArray<string>>> | undefined,
  authResourcePath: string | undefined,
  signal: AbortSignal | undefined,
  apiState: CoreState,
  selectedOutput?: string,
): Promise<{ readonly catalog?: AuthoringV1Catalog; readonly bundle?: AuthoringV1Bundle; readonly columnBindings?: ReadonlyArray<AuthoringColumnBinding>; readonly snapshotToken?: string; readonly error?: ExplorerApiError }> => {
  const catalogResult = await rawAuthoringCatalog(project, explorerId, authResourcePath, signal, apiState);
  if (catalogResult.error || !catalogResult.data) return { error: catalogResult.error };
  const built = authoringBundleFromV2Config(config, project, explorerId, selectedCandidateIdsByNode, catalogResult.data, selectedOutput);
  const { bundle } = built;
  const missingRouteDocuments = bundle.documents.filter(
    (document) => !document.baseNodeId || !document.rowNodeId,
  );
  if (missingRouteDocuments.length > 0) {
    const missing = missingRouteDocuments[0];
    const output = config.recipe.outputs?.find(
      (candidate) =>
        outputIdFor(candidate.name) === outputIdFor(missing.output.id),
    );
    const rootResourceType = output?.rootResourceType?.trim();
    const outputLabel = missing.output.title || missing.output.id;
    return {
      error: {
        status: 422,
        code: 'AUTHORING_ROUTE_NODE_MISSING',
        message: rootResourceType
          ? `The Builder could not map output "${outputLabel}" with root resource "${rootResourceType}" to the current Loom catalog.`
          : `The Builder output "${outputLabel}" does not identify a root resource that exists in the current Loom catalog.`,
        fieldPath: `recipe.outputs.${Math.max(
          0,
          bundle.documents.indexOf(missing),
        )}.rootResourceType`,
        retryable: false,
        details: {
          outputId: missing.output.id,
          rootResourceType,
          baseNodeId: missing.baseNodeId || undefined,
          rowNodeId: missing.rowNodeId || undefined,
          catalogResourceTypes: [
            ...new Set(
              catalogResult.data.nodes.flatMap((node) =>
                node.resourceType ? [node.resourceType] : [],
              ),
            ),
          ],
        },
      },
    };
  }
  return { catalog: catalogResult.data, bundle, columnBindings: built.columnBindings, snapshotToken: catalogResult.data.snapshotToken };
};

const authoringDiagnosticToExplorer = (value: unknown): ExplorerDiagnostic => {
  const diagnostic = isRecord(value) ? value : {};
  const severity = stringValue(diagnostic.severity)?.toLowerCase() === 'error'
    ? 'error'
    : 'warning';
  return {
    severity,
    code: stringValue(diagnostic.code) ?? 'AUTHORING_DIAGNOSTIC',
    message: stringValue(diagnostic.message) ?? 'Loom returned an authoring diagnostic.',
    ...(stringValue(diagnostic.jsonPath) ? { configPath: stringValue(diagnostic.jsonPath) } : {}),
    ...(typeof diagnostic.retryable === 'boolean' ? { retryable: diagnostic.retryable } : {}),
    ...(stringValue(diagnostic.requestId) ? { requestId: stringValue(diagnostic.requestId) } : {}),
  };
};

const canonicalExplorerStateAfterAuthoringMutation = async (
  project: string,
  explorerId: string,
  authResourcePath: string | undefined,
  signal: AbortSignal | undefined,
  apiState: CoreState,
): Promise<{ readonly data: ExplorerState } | { readonly error: ExplorerApiError }> => {
  const result = await requestJson<unknown>(
    withAuthResourcePath(
      `${explorerRoot(project)}/${encodeURIComponent(explorerId)}`,
      authResourcePath,
    ),
    { signal },
    selectCSRFToken(apiState),
  );
  if (result.error) return { error: result.error };
  try {
    return { data: normalizeExplorerState(result.data, project, explorerId) };
  } catch (error) {
    return { error: errorFromUnknown(error, `${explorerRoot(project)}/${encodeURIComponent(explorerId)}`, 'INVALID_EXPLORER_STATE_V1') };
  }
};

const outputIdFromBundle = (
  bundle: AuthoringV1Bundle | undefined,
  output: string,
): string => {
  const fallback = outputIdFor(output);
  const document = bundle?.documents.find(
    (candidate) => outputIdFor(candidate.output.id) === fallback ||
      outputIdFor(candidate.output.title) === fallback,
  );
  return document?.output.id ?? fallback;
};

export const loomExplorerApi = loomApi.injectEndpoints({
  endpoints: (builder) => ({
    /** Lists both repository default and interactive Explorers. */
    getExplorerConfigs: builder.query<ReadonlyArray<ExplorerState>, string>({
      async queryFn(project, api) {
        const result = await requestJson<
          | ReadonlyArray<ExplorerState>
          | { readonly explorers?: ReadonlyArray<ExplorerState> }
        >(
          explorerRoot(project),
          { signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        const listPayload = unwrapExplorerEnvelope(result.data);
        const values: ReadonlyArray<ExplorerState> = Array.isArray(listPayload)
          ? (listPayload as ReadonlyArray<ExplorerState>)
          : isRecord(listPayload) && Array.isArray(listPayload.explorers)
            ? listPayload.explorers
            : ([] as ReadonlyArray<ExplorerState>);
        return {
          data: values.map((value) =>
            normalizeExplorerState(value, project, value.explorerId),
          ),
        };
      },
      providesTags: (_result, _error, project) => [
        { type: 'LOOM_EXPLORER', id: project },
      ],
    }),
    getExplorer: builder.query<ExplorerState, ExplorerProjectRef>({
      async queryFn({ project, explorerId }, api) {
        const endpoint = `${explorerRoot(project)}/${encodeURIComponent(explorerId)}`;
        const result = await requestJson<
          ExplorerState | RepositoryExplorerConfig
        >(
          endpoint,
          { signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        return result.error
          ? { error: result.error }
          : { data: normalizeExplorerState(result.data, project, explorerId) };
      },
      providesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER', id: `${args.project}:${args.explorerId}` },
      ],
    }),
    createExplorer: builder.mutation<ExplorerState, CreateExplorerRequest>({
      async queryFn(
        {
          project,
          name,
          explorerId,
          title,
          description,
          from,
          authResourcePath,
        },
        api,
      ) {
        const requestedName =
          name?.trim() || title.trim() || explorerId?.trim();
        if (!requestedName) {
          return {
            error: {
              status: 400,
              code: 'EXPLORER_NAME_REQUIRED',
              message: 'A name is required to create an Explorer.',
            },
          };
        }
        const result = await requestJson<ExplorerState>(
          withAuthResourcePath(explorerRoot(project), authResourcePath),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              name: requestedName,
              title,
              description,
              from,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        const returnedExplorerId =
          result.data?.explorerId ?? explorerId ?? requestedName;
        return result.error
          ? { error: result.error }
          : {
              data: normalizeExplorerState(
                result.data,
                project,
                returnedExplorerId,
              ),
            };
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER', id: args.project },
      ],
    }),
    deleteExplorer: builder.mutation<void, DeleteExplorerRequest>({
      async queryFn() {
        // Loom's V1 lifecycle intentionally has no destructive delete route.
        // Keep the legacy hook for the restored Builder UI, but never send a
        // DELETE request to an endpoint whose semantics are not part of V1.
        return {
          error: {
            status: 501,
            code: 'EXPLORER_DELETE_UNSUPPORTED',
            message: 'Explorer deletion is not supported by Loom authoring V1.',
          },
        };
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER', id: `${args.project}:${args.explorerId}` },
        { type: 'LOOM_EXPLORER', id: args.project },
      ],
    }),
    saveExplorerDraft: builder.mutation<
      ExplorerState,
      SaveExplorerDraftRequest
    >({
      async queryFn(
        {
          project,
          explorerId,
          config,
          authResourcePath,
          expectedDraftVersion,
          expectedDraftDigest,
        },
        api,
      ) {
        const invalidConfig = configValidationError(
          config,
          project,
          explorerId,
        );
        if (invalidConfig) return invalidConfig;
        const incompatibleTraversal = nestedTraversalCompatibilityError(config);
        if (incompatibleTraversal) return incompatibleTraversal;
        const built = await buildAuthoringV1Bundle(
          config,
          project,
          explorerId,
          undefined,
          authResourcePath,
          api.signal,
          api.getState() as CoreState,
        );
        if (built.error || !built.bundle)
          return { error: built.error ?? { status: 502, code: 'INVALID_AUTHORING_BUNDLE', message: 'The Builder could not construct an authoring bundle.' } };
        const hydrated = built.catalog
          ? await hydrateAuthoringPresentation(
              built.bundle,
              config,
              built.catalog,
            )
          : { bundle: built.bundle };
        if (hydrated.error || !hydrated.bundle)
          return { error: hydrated.error ?? { status: 502, code: 'AUTHORING_PRESENTATION_COMPILE_FAILED', message: 'The Builder could not compile the migrated presentation.' } };
        const result = await requestJson<unknown>(
          withAuthResourcePath(
            authoringV1Endpoint(project, explorerId, '/draft'),
            authResourcePath,
          ),
          {
            method: 'PUT',
            signal: api.signal,
            body: JSON.stringify({
              ...hydrated.bundle,
              snapshotToken: built.snapshotToken,
              expectedDraftVersion,
              ...(expectedDraftDigest === undefined
                ? {}
                : { expectedDraftDigest }),
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        return canonicalExplorerStateAfterAuthoringMutation(
          project,
          explorerId,
          authResourcePath,
          api.signal,
          api.getState() as CoreState,
        );
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER', id: `${args.project}:${args.explorerId}` },
        { type: 'LOOM_EXPLORER', id: args.project },
      ],
    }),
    previewExplorerDraft: builder.mutation<
      ExplorerPreview,
      PreviewExplorerDraftRequest
    >({
      async queryFn(
        {
          project,
          explorerId,
          config,
          output,
          limit,
          authResourcePath,
        },
        api,
      ) {
        const invalidConfig = configValidationError(
          config,
          project,
          explorerId,
        );
        if (invalidConfig) return invalidConfig;
        const incompatibleTraversal = nestedTraversalCompatibilityError(config);
        if (incompatibleTraversal) return incompatibleTraversal;
        const scopedConfig = configForOutput(config, output);
        const built = await buildAuthoringV1Bundle(
          scopedConfig,
          project,
          explorerId,
          undefined,
          authResourcePath,
          api.signal,
          api.getState() as CoreState,
          output,
        );
        if (built.error || !built.bundle)
          return { error: built.error ?? { status: 502, code: 'INVALID_AUTHORING_BUNDLE', message: 'The Builder could not construct an authoring bundle.' } };
        const previewOutputId = outputIdFromBundle(built.bundle, output);
        const result = await requestJson<AuthoringPreviewResponse>(
          withAuthResourcePath(
            authoringV1Endpoint(project, explorerId, '/preview'),
            authResourcePath,
          ),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              bundle: built.bundle,
              snapshotToken: built.snapshotToken,
              outputId: previewOutputId,
              limit,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        const response = result.data;
        if (!response || !Array.isArray(response.rows) || !Array.isArray(response.columns))
          return { error: { status: 502, code: 'INVALID_PREVIEW_RESPONSE', message: 'Loom returned an invalid Explorer preview response.' } };
        const bindings = (built.columnBindings ?? []).filter(
          (binding) => binding.outputId === previewOutputId,
        );
        return bindAuthoringPreview(
          response,
          bindings,
          output,
          authoringDiagnosticToExplorer,
        );
      },
    }),
    getExplorerAuthoringCatalog: builder.query<
      ExplorerAuthoringCatalogResponse,
      ExplorerAuthoringCatalogRequest
    >({
      async queryFn(
        { project, output, config, datasetGeneration, authResourcePath },
        api,
      ) {
        const requestedExplorerId =
          config && typeof config.explorer?.id === 'string'
            ? config.explorer.id
            : '';
        const invalidConfig = configValidationError(
          config,
          project,
          requestedExplorerId,
        );
        if (invalidConfig) return invalidConfig;
        try {
          const selectedOutput = config.recipe.outputs?.find(
            (candidate) => candidate.name === output,
          );
          const traversalNodes = selectedOutput
            ? collectTraversalNodes(selectedOutput)
            : [];
          const diagnostics: ExplorerDiagnostic[] = [];
          const resourcesByType = new Map<
            string,
            { readonly resourceType: string; readonly label: string }
          >();
          const relationshipsById = new Map<
            string,
            ExplorerAuthoringCatalogResponse['relationships'][number]
          >();

          const addResource = (resourceType: string) => {
            if (!resourcesByType.has(resourceType))
              resourcesByType.set(resourceType, {
                resourceType,
                label: resourceType,
              });
          };

          // V2 authoring discovery is served by the supported REST catalog.
          // It supplies the project graph, opaque selection IDs, and immutable
          // snapshot token used by the REST compile endpoint.
          const nodesByPath = new Map<
            string,
            {
              readonly resourceType: string;
              readonly nodePath: ReadonlyArray<string>;
            }
          >();
          for (const node of traversalNodes) {
            const key = node.nodePath.join('/');
            if (!nodesByPath.has(key)) nodesByPath.set(key, node);
          }
          const supportedCatalog = await fetchExplorerAuthoringCatalog(
            project,
            requestedExplorerId || 'default',
            authResourcePath,
            api.signal,
          );
          diagnostics.push(...supportedCatalog.diagnostics);
          if (!supportedCatalog.complete) {
            diagnostics.push({
              severity: 'error',
              code: 'AUTHORING_CATALOG_INCOMPLETE',
              message:
                'Loom did not return a complete Explorer authoring catalog.',
            });
          }
          const catalogNodeResourceTypes = new Map<string, string>();
          for (const catalogNode of supportedCatalog.catalog.nodes ?? []) {
            const resourceType = catalogNode.label?.trim();
            const nodeId = catalogNode.nodeId?.trim();
            if (!resourceType || !nodeId) continue;
            catalogNodeResourceTypes.set(nodeId, resourceType);
            addResource(resourceType);
          }
          for (const edge of supportedCatalog.catalog.routeEdges ?? []) {
            const source = edge.fromNodeId
              ? catalogNodeResourceTypes.get(edge.fromNodeId.trim())
              : undefined;
            const target = edge.toNodeId
              ? catalogNodeResourceTypes.get(edge.toNodeId.trim())
              : undefined;
            const label = edge.label?.trim();
            if (!source || !target || !label) continue;
            const id = `${source}/${label}/${target}`;
            const existing = relationshipsById.get(id);
            relationshipsById.set(id, {
              ...existing,
              id,
              source,
              target,
              label,
              direction: 'outbound',
            });
          }
          const candidatesByKey = new Map<string, ExplorerAuthoringCandidate>();
          const catalogNodesByResource = new Map<
            string,
            ReadonlyArray<AuthoringCatalogNode>
          >();
          for (const catalogNode of supportedCatalog.catalog.nodes ?? []) {
            const resourceType = catalogNode.label?.trim();
            if (!resourceType) continue;
            const entries = catalogNodesByResource.get(resourceType) ?? [];
            catalogNodesByResource.set(resourceType, [...entries, catalogNode]);
            for (const diagnostic of [
              ...(catalogNode.completeness?.diagnostics ?? []),
              ...(catalogNode.columns ?? []).flatMap(
                (column) => column.diagnostics ?? [],
              ),
            ]) {
              diagnostics.push(
                authoringDiagnostic(
                  diagnostic,
                  'AUTHORING_CATALOG_DIAGNOSTIC',
                  `Loom returned an authoring catalog diagnostic for ${resourceType}.`,
                ),
              );
            }
          }
          for (const resourceType of catalogNodeResourceTypes.values()) {
            const hasRootNode = [...nodesByPath.values()].some(
              (node) =>
                node.resourceType === resourceType &&
                node.nodePath.length === 0,
            );
            if (!hasRootNode)
              nodesByPath.set(`${resourceType}|`, {
                resourceType,
                nodePath: [],
              });
          }
          for (const node of nodesByPath.values()) {
            const catalogNodes = catalogNodesByResource.get(node.resourceType);
            if (!catalogNodes) continue;
            for (const catalogNode of catalogNodes) {
              for (const column of catalogNode.columns ?? []) {
                const normalized = authoringCatalogColumnToCandidate(
                  column,
                  node.resourceType,
                  output,
                  node.nodePath,
                  catalogNode.nodeId,
                );
                if (!normalized) continue;
                candidatesByKey.set(
                  `${node.resourceType}|${node.nodePath.join('/')}|${normalized.id}`,
                  normalized,
                );
              }
            }
          }
          const candidates = [...candidatesByKey.values()];
          const digestInput = {
            project,
            output,
            resources: [...resourcesByType.values()],
            relationships: [...relationshipsById.values()],
            candidates,
            diagnostics,
          };
          const digest = await catalogDigest(digestInput);
          const snapshotToken = supportedCatalog.snapshotToken;
          if (!snapshotToken) {
            diagnostics.push({
              severity: 'error',
              code: 'CATALOG_SNAPSHOT_MISSING',
              message:
                'Loom did not return an immutable authoring snapshot token. Refresh discovery before selecting columns.',
            });
          }
          return {
            data: {
              snapshotToken: snapshotToken ?? '',
              catalogDigest: digest,
              sourceGeneration:
                (supportedCatalog.sourceGeneration ??
                  datasetGeneration?.trim()) ||
                undefined,
              resolvedSchemaDigest: supportedCatalog.resolvedSchemaDigest,
              authScopeDigest: supportedCatalog.authScopeDigest,
              baseRecipeDigest: undefined,
              complete: diagnostics.every((item) => item.severity !== 'error'),
              diagnostics,
              resources: [...resourcesByType.values()],
              relationships: [...relationshipsById.values()],
              candidates,
            },
          };
        } catch (error) {
          const failure = errorFromUnknown(
            error,
            authoringV1Endpoint(
              project,
              requestedExplorerId || 'default',
              '/builder',
            ),
            'CATALOG_DISCOVERY_FAILED',
          );
          return {
            error: {
              ...failure,
              diagnostics: [
                {
                  severity: 'error',
                  code: failure.code ?? 'CATALOG_DISCOVERY_FAILED',
                  message: failure.message ?? 'Catalog discovery failed.',
                  endpoint: failure.endpoint,
                  requestId: failure.requestId,
                  fieldPath: failure.fieldPath,
                  retryable: failure.retryable,
                },
              ],
            },
          };
        }
      },
      providesTags: (_result, _error, args) => [
        {
          type: 'LOOM_EXPLORER',
          id: `${args.project}:${args.explorerId}:catalog:${args.output}`,
        },
      ],
    }),
    // Compatibility facade for the restored Builder UI. The UI still speaks
    // in ExplorerConfigV2, but compilation is now performed by the V1 intent
    // compiler and never sends a recipe AST over the wire.
    compileExplorerAuthoring: builder.mutation<
      ExplorerAuthoringCompileResponse,
      ExplorerAuthoringCompileRequest
    >({
      async queryFn(args, api) {
        const invalidConfig = configValidationError(args.config, args.project, args.explorerId);
        if (invalidConfig) return invalidConfig;
        const incompatibleTraversal = nestedTraversalCompatibilityError(args.config);
        if (incompatibleTraversal) return incompatibleTraversal;
        const built = await buildAuthoringV1Bundle(
          args.config,
          args.project,
          args.explorerId,
          args.selectedCandidateIdsByNode,
          args.authResourcePath,
          api.signal,
          api.getState() as CoreState,
          args.output,
        );
        if (built.error || !built.bundle || !built.catalog) return { error: built.error ?? { status: 502, code: 'INVALID_AUTHORING_BUNDLE', message: 'The Builder could not construct a V1 authoring document.' } };
        const outputId = outputIdFor(args.output);
        const document = built.bundle.documents.find((candidate) => outputIdFor(candidate.output.id) === outputId) ?? built.bundle.documents[0];
        if (!document) return { error: { status: 422, code: 'AUTHORING_DOCUMENT_MISSING', message: 'The Builder could not find the selected output in the V1 authoring bundle.' } };
        const result = await requestJson<unknown>(
          withAuthResourcePath(authoringV1Endpoint(args.project, args.explorerId, '/compile'), args.authResourcePath),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({ document, snapshotToken: built.snapshotToken, scope: 'DOCUMENT', ...(args.expectedDraftDigest ? { intentDigest: args.expectedDraftDigest } : {}) }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        const payload = unwrapExplorerEnvelope(result.data);
        const record = isRecord(payload) ? payload : {};
        const diagnostics = (Array.isArray(record.diagnostics) ? record.diagnostics : []).map(authoringDiagnosticToExplorer);
        const candidates = new Map(built.catalog.candidates.map((candidate) => [candidate.candidateId, candidate]));
        const rawEmitted = Array.isArray(record.emittedColumns) ? record.emittedColumns : [];
        const emittedColumns = rawEmitted.flatMap((value) => {
          if (!isRecord(value)) return [];
          const name = stringValue(value.name) ?? stringValue(value.publicColumn);
          if (!name) return [];
          return [{ name, logicalType: stringValue(value.logicalType) ?? 'string', filterable: value.filterable !== false, chartable: value.chartable === true }];
        });
        const fallbackColumns = built.columnBindings
          ?.filter((binding) => binding.outputId === document.output.id)
          .flatMap((binding) => {
            const candidate = candidates.get(binding.candidateId);
            return [{ name: binding.semanticColumn, logicalType: candidate?.logicalType ?? 'string', filterable: candidate?.filterable !== false, chartable: candidate?.chartable === true }];
          }) ?? [];
        return {
          data: {
            config: args.config,
            output: args.output,
            digest: stringValue(record.intentDigest) ?? stringValue(record.documentDigest) ?? '',
            snapshotToken: stringValue(record.snapshotToken) ?? built.snapshotToken ?? args.snapshotToken,
            recipeDigest: stringValue(record.recipeDigest),
            resolvedSchemaDigest: stringValue(record.resolvedSchemaDigest),
            sourceGeneration: stringValue(record.sourceGeneration),
            emittedColumns: emittedColumns.length > 0 ? emittedColumns : fallbackColumns,
            diagnostics,
          },
        };
      },
    }),
    publishExplorer: builder.mutation<
      ExplorerPublicationResult,
      PublishExplorerRequest
    >({
      async queryFn(
        {
          project,
          explorerId,
          config,
          authResourcePath,
        },
        api,
      ) {
        const invalidConfig = configValidationError(
          config,
          project,
          explorerId,
        );
        if (invalidConfig) return invalidConfig;
        const incompatibleTraversal = nestedTraversalCompatibilityError(config);
        if (incompatibleTraversal) return incompatibleTraversal;
        const built = await buildAuthoringV1Bundle(
          config,
          project,
          explorerId,
          undefined,
          authResourcePath,
          api.signal,
          api.getState() as CoreState,
        );
        if (built.error || !built.bundle || !built.catalog)
          return {
            error:
              built.error ??
              {
                status: 502,
                code: 'INVALID_AUTHORING_BUNDLE',
                message:
                  'The Builder could not construct an authoring bundle for publication.',
              },
          };
        const hydrated = await hydrateAuthoringPresentation(
          built.bundle,
          config,
          built.catalog,
        );
        if (hydrated.error || !hydrated.bundle)
          return {
            error:
              hydrated.error ??
              {
                status: 502,
                code: 'AUTHORING_PRESENTATION_COMPILE_FAILED',
                message:
                  'The Builder could not compile the presentation for publication.',
              },
          };
        const result = await requestJson<unknown>(
          withAuthResourcePath(
            authoringV1Endpoint(project, explorerId, '/publish'),
            authResourcePath,
          ),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              bundle: hydrated.bundle,
              snapshotToken: built.snapshotToken,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        const refreshed = await canonicalExplorerStateAfterAuthoringMutation(
          project,
          explorerId,
          authResourcePath,
          api.signal,
          api.getState() as CoreState,
        );
        if ('error' in refreshed)
          return { error: refreshed.error };
        return {
          data: {
            ...refreshed.data,
            // Authoring V1 publishes the submitted bundle and returns
            // lifecycle/runtime state, not the removed legacy activeConfig
            // projection. Preserve the exact config accepted by the 200
            // publication response for the compatibility Builder reducer.
            draftConfig: config,
            activeConfig: config,
            activeUrl: refreshed.data.activeUrl ?? '',
          },
        };
      },
      invalidatesTags: (_result, _error, args) => {
        const project = canonicalLoomProjectId(args.project);
        return [
          {
            type: 'LOOM_EXPLORER_AUTHORING',
            id: `${project}:${args.explorerId}`,
          },
          { type: 'LOOM_EXPLORER_AUTHORING', id: project },
          { type: 'LOOM_EXPLORER', id: `${project}:${args.explorerId}` },
          { type: 'LOOM_EXPLORER', id: project },
        ];
      },
    }),
    getActiveExplorer: builder.query<
      RepositoryExplorerConfig,
      ExplorerProjectRef
    >({
      async queryFn({ project, explorerId }, api) {
        const endpoint = `${explorerRoot(project)}/${encodeURIComponent(explorerId)}`;
        const result = await requestJson<RepositoryExplorerConfig>(
          endpoint,
          {
            signal: api.signal,
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        return {
          data: unwrapExplorerEnvelope(result.data) as RepositoryExplorerConfig,
        };
      },
      providesTags: (_result, _error, args) => [
        {
          type: 'LOOM_EXPLORER',
          id: `${args.project}:${args.explorerId}:active`,
        },
      ],
    }),
    /** Authenticated repository Explorer state used by existing project UI. */
    getRepositoryExplorerConfig: builder.query<
      RepositoryExplorerConfig | null,
      string
    >({
      async queryFn(project, api) {
        const result = await requestJson<RepositoryExplorerConfig>(
          `${explorerRoot(project)}/default`,
          { signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error?.status === 404) return { data: null };
        return result.error
          ? { error: result.error }
          : {
              data: unwrapExplorerEnvelope(
                result.data,
              ) as RepositoryExplorerConfig,
            };
      },
      providesTags: (_result, _error, project) => [
        { type: 'LOOM_EXPLORER', id: project },
      ],
    }),
  }),
});

export const {
  useGetExplorerConfigsQuery,
  useGetExplorerQuery,
  useCreateExplorerMutation,
  useDeleteExplorerMutation,
  useSaveExplorerDraftMutation,
  usePreviewExplorerDraftMutation,
  useGetExplorerAuthoringCatalogQuery,
  useCompileExplorerAuthoringMutation,
  usePublishExplorerMutation,
  useGetActiveExplorerQuery,
  useGetRepositoryExplorerConfigQuery,
} = loomExplorerApi;
