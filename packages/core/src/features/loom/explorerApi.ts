import { GEN3_LOOM_API } from '../../constants';
import { loomApi, fetchGraphQL, fetchLoomResponse } from './loomApi';
import { handleUnauthorizedStatus } from '../user/unauthorized';
import { selectCSRFToken } from '../user/userSliceRTK';
import type { CoreState } from '../../reducers';
import { configForOutput, validateExplorerConfigV2 } from './explorer';
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
  RecipeTraversalV2,
} from './explorer';

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
  /** Optional local starting packet used by the default Builder's
   * “create from this configuration” action. */
  readonly config?: ExplorerConfigV2;
}

export interface SaveExplorerDraftRequest extends ExplorerProjectRef {
  readonly config: ExplorerConfigV2;
  readonly expectedDraftVersion: number;
  readonly expectedDraftDigest?: string;
}

export interface PreviewExplorerDraftRequest extends ExplorerProjectRef {
  readonly config: ExplorerConfigV2;
  readonly output: string;
  readonly limit: 10 | 25 | 50 | 100;
  /** Optional for the repository default, which is not stored in the
   * interactive Explorer CAS store. */
  readonly draftDigest?: string;
}

export interface PublishExplorerRequest extends ExplorerProjectRef {
  readonly expectedDraftVersion: number;
  readonly expectedDraftDigest: string;
}

export interface ExplorerPreview {
  readonly output: string;
  readonly columns: ReadonlyArray<{
    readonly name: string;
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
  `${GEN3_LOOM_API}/api/v1/projects/${encodeURIComponent(project)}/explorers`;

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

/**
 * Loom deployments have briefly exposed REST resources both directly and in
 * a `{ data: ... }` envelope. Accept the envelope at this boundary so the
 * Builder receives the same ExplorerState either way.
 */
const unwrapExplorerEnvelope = (payload: unknown): unknown =>
  isRecord(payload) && isRecord(payload.data) ? payload.data : payload;

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
    endpoint: typed.meta?.endpoint ?? endpoint,
    requestId: typed.requestId,
    fieldPath: typed.fieldPath,
    retryable: unauthorized ? false : typed.retryable,
    details: typed.details,
  };
};

const repositoryReadOnlyError = (): { readonly error: ExplorerApiError } => ({
  error: {
    status: 403,
    code: 'REPOSITORY_READ_ONLY',
    message:
      'The repository default is read-only. Create a custom Explorer to save changes.',
  },
});

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

const graphEndpoint = `${GEN3_LOOM_API}/graphql/graph`;

interface IntrospectionFieldSelector {
  readonly sourcePath?: string;
  readonly valuePath?: string;
  readonly where?: {
    readonly path?: string;
    readonly op?: string;
    readonly value?: string;
  };
}

interface IntrospectionField {
  readonly resourceType?: string;
  readonly fieldRef?: string;
  readonly label?: string;
  readonly path?: string;
  readonly selector?: IntrospectionFieldSelector;
  readonly kind?: string;
  readonly docCount?: number;
  readonly sampleCount?: number;
  readonly distinctValues?: ReadonlyArray<string>;
  readonly distinctTruncated?: boolean;
  readonly pivotCandidate?: boolean;
  readonly pivotKind?: string;
  readonly pivotColumns?: ReadonlyArray<string>;
  readonly pivotFamily?: string;
  readonly defaultPivotColumnSelector?: IntrospectionFieldSelector;
  readonly defaultPivotValueSelector?: IntrospectionFieldSelector;
}

interface IntrospectionTraversal {
  readonly fromType?: string;
  readonly label?: string;
  readonly toType?: string;
  readonly edgeCount?: number;
}

interface IntrospectionResource {
  readonly resourceType?: string;
  readonly fields?: ReadonlyArray<IntrospectionField>;
  readonly pivotFields?: ReadonlyArray<IntrospectionField>;
  readonly traversals?: ReadonlyArray<IntrospectionTraversal>;
}

interface IntrospectionRelatedResource {
  readonly viaLabel?: string;
  readonly edgeCount?: number;
  readonly target?: IntrospectionResource;
}

interface IntrospectionPayload {
  readonly dataframeBuilderIntrospection?: {
    readonly project?: string;
    readonly rootResourceType?: string;
    readonly authResourcePaths?: ReadonlyArray<string>;
    readonly root?: IntrospectionResource;
    readonly relatedResources?: ReadonlyArray<IntrospectionRelatedResource>;
    readonly traversals?: ReadonlyArray<IntrospectionTraversal>;
    readonly fields?: ReadonlyArray<IntrospectionField>;
    readonly pivotFields?: ReadonlyArray<IntrospectionField>;
  };
}

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
  readonly authorizationScopeDigest?: string;
  readonly resolvedSchemaDigest?: string;
  readonly nodes?: ReadonlyArray<{
    readonly nodeId?: string;
    readonly label?: string;
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
  readonly routeEdges?: ReadonlyArray<{
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

const introspectionQuery = `query BuilderIntrospection($input: DataframeBuilderIntrospectionInput!) {
  dataframeBuilderIntrospection(input: $input) {
    project
    rootResourceType
    authResourcePaths
    root {
      resourceType
      fields {
        resourceType fieldRef label path kind docCount sampleCount distinctValues distinctTruncated
        pivotCandidate pivotKind pivotColumns pivotFamily
        selector { sourcePath valuePath where { path op value } }
        defaultPivotColumnSelector { sourcePath valuePath where { path op value } }
        defaultPivotValueSelector { sourcePath valuePath where { path op value } }
      }
      pivotFields {
        resourceType fieldRef label path kind docCount sampleCount distinctValues distinctTruncated
        pivotCandidate pivotKind pivotColumns pivotFamily
        selector { sourcePath valuePath where { path op value } }
        defaultPivotColumnSelector { sourcePath valuePath where { path op value } }
        defaultPivotValueSelector { sourcePath valuePath where { path op value } }
      }
      traversals { fromType label toType edgeCount }
    }
    relatedResources {
      viaLabel
      edgeCount
      target {
        resourceType
        fields {
          resourceType fieldRef label path kind docCount sampleCount distinctValues distinctTruncated
          pivotCandidate pivotKind pivotColumns pivotFamily
          selector { sourcePath valuePath where { path op value } }
          defaultPivotColumnSelector { sourcePath valuePath where { path op value } }
          defaultPivotValueSelector { sourcePath valuePath where { path op value } }
        }
        pivotFields {
          resourceType fieldRef label path kind docCount sampleCount distinctValues distinctTruncated
          pivotCandidate pivotKind pivotColumns pivotFamily
          selector { sourcePath valuePath where { path op value } }
          defaultPivotColumnSelector { sourcePath valuePath where { path op value } }
          defaultPivotValueSelector { sourcePath valuePath where { path op value } }
        }
        traversals { fromType label toType edgeCount }
      }
    }
    traversals { fromType label toType edgeCount }
    fields {
      resourceType fieldRef label path kind docCount sampleCount distinctValues distinctTruncated
      pivotCandidate pivotKind pivotColumns pivotFamily
      selector { sourcePath valuePath where { path op value } }
      defaultPivotColumnSelector { sourcePath valuePath where { path op value } }
      defaultPivotValueSelector { sourcePath valuePath where { path op value } }
    }
    pivotFields {
      resourceType fieldRef label path kind docCount sampleCount distinctValues distinctTruncated
      pivotCandidate pivotKind pivotColumns pivotFamily
      selector { sourcePath valuePath where { path op value } }
      defaultPivotColumnSelector { sourcePath valuePath where { path op value } }
      defaultPivotValueSelector { sourcePath valuePath where { path op value } }
    }
  }
}`;

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
  const endpoint = `${explorerRoot(project)}/${encodeURIComponent(explorerId)}/authoring/catalog`;
  const result = await requestJson<AuthoringCatalogRESTPayload>(endpoint, {
    signal,
  });
  if (result.error) throw result.error;
  const response = result.data;
  if (!response) throw new Error('Loom returned no Explorer authoring catalog response.');
  const columnsByNode = new Map<string, AuthoringCatalogColumn[]>();
  for (const selection of response.selections ?? []) {
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
  const catalog: NonNullable<AuthoringCatalogPayload['explorerAuthoringCatalog']> = {
    snapshotToken: response.snapshotToken,
    project: response.project,
    explorerId: response.explorerId,
    sourceGeneration: response.sourceGeneration,
    authorizationScopeDigest: response.authorizationScopeDigest,
    resolvedSchemaDigest: response.resolvedSchemaDigest,
    nodes: (response.nodes ?? []).map((node) => ({
      nodeId: node.nodeId,
      label: node.label,
      columns: columnsByNode.get(node.nodeId?.trim() ?? '') ?? [],
    })),
    routeEdges: response.routeEdges,
    completeness: response.completeness,
    diagnostics: response.diagnostics,
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
 * The supported authoring catalog returns opaque selection IDs and the
 * introspection query returns the raw selectors needed to author V2 fields.
 * Join those two surfaces by fieldRef so the browser never invents selectors
 * or candidate IDs.
 *
 * Keep this check deliberately narrow.  Repeated scalar values are valid
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
  introspectionFields: ReadonlyArray<IntrospectionField>,
): ExplorerAuthoringCandidate | undefined => {
  const id = column.selectionId?.trim();
  const selectionKey = column.label?.trim();
  const matchedField = introspectionFields.find(
    (field) => field.fieldRef?.trim() === selectionKey,
  );
  const path =
    matchedField?.path?.trim() ||
    (selectionKey?.includes('.')
      ? selectionKey.slice(selectionKey.indexOf('.') + 1)
      : selectionKey);
  if (!id || !path) return undefined;
  const valueType =
    column.logicalType?.trim() || matchedField?.kind?.trim() || 'unknown';
  if (isStructuralFieldCandidate(valueType)) return undefined;
  const cardinality = column.cardinality?.trim() || '';
  const repeated =
    column.repeated === true ||
    /array|repeat|many|repeated|\[\]/i.test(
      `${valueType} ${cardinality} ${path}`,
    );
  const label =
    matchedField?.label?.trim() ||
    column.description?.trim() ||
    selectionKey ||
    path.split(/[./]/).filter(Boolean).at(-1) ||
    path;
  const diagnostics = column.diagnostics ?? [];
  const blockingDiagnostic = diagnostics.find(
    (diagnostic) => diagnostic.severity?.trim().toLowerCase() === 'error',
  );
  const valueSelector = matchedField?.selector?.valuePath?.trim() || path;
  return {
    id,
    resourceType,
    path,
    label,
    publicName: column.expectedPublicColumn?.trim() || path,
    logicalType: valueType,
    repeated,
    populationCount: column.population ?? matchedField?.docCount,
    examples: column.examples,
    family: 'field',
    recommended: /(^|[._])id$/i.test(path),
    filterable: column.filterable ?? !repeated,
    chartable:
      column.chartable ??
      (!repeated && /number|integer|decimal|date|boolean/i.test(valueType)),
    technicalDetails: selectionKey,
    selectionKey: selectionKey || path,
    valueSelector,
    familyName: 'Fields',
    familyKind: 'FIELD',
    nodePath,
    output,
    population: column.population ?? matchedField?.docCount,
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

const normalizeExplorerState = (
  payload: unknown,
  project: string,
  explorerId: string,
): ExplorerState => {
  const value = unwrapExplorerEnvelope(payload) as Partial<ExplorerState> &
    Partial<RepositoryExplorerConfig>;
  const draftConfig = value.draftConfig;
  const management =
    value.management ??
    (explorerId === 'default' ? 'REPOSITORY' : 'INTERACTIVE');
  const hasPublishedConfig = Boolean(value.activeConfig);
  const isRepositoryMetadata =
    !draftConfig &&
    !hasPublishedConfig &&
    (management === 'REPOSITORY' || explorerId === 'default');
  if (!draftConfig && !hasPublishedConfig && !isRepositoryMetadata)
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
          : (isRecord(listPayload) && Array.isArray(listPayload.explorers)
              ? listPayload.explorers
              : [] as ReadonlyArray<ExplorerState>);
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
          config,
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
        if (config) {
          const invalidConfig = configValidationError(
            config,
            project,
            explorerId ?? 'default',
          );
          if (invalidConfig) return invalidConfig;
        }
        const result = await requestJson<ExplorerState>(
          explorerRoot(project),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              name: requestedName,
              title,
              description,
              from,
              authResourcePath,
              ...(config ? { config } : {}),
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
    saveExplorerDraft: builder.mutation<
      ExplorerState,
      SaveExplorerDraftRequest
    >({
      async queryFn(
        {
          project,
          explorerId,
          config,
          expectedDraftVersion,
          expectedDraftDigest,
        },
        api,
      ) {
        if (explorerId === 'default') return repositoryReadOnlyError();
        const invalidConfig = configValidationError(
          config,
          project,
          explorerId,
        );
        if (invalidConfig) return invalidConfig;
        const result = await requestJson<ExplorerState>(
          `${explorerRoot(project)}/${encodeURIComponent(explorerId)}/draft`,
          {
            method: 'PUT',
            signal: api.signal,
            body: JSON.stringify({
              config,
              expectedDraftVersion,
              expectedDraftDigest,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        return result.error
          ? { error: result.error }
          : { data: normalizeExplorerState(result.data, project, explorerId) };
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
        { project, explorerId, config, output, limit, draftDigest },
        api,
      ) {
        const invalidConfig = configValidationError(
          config,
          project,
          explorerId,
        );
        if (invalidConfig) return invalidConfig;
        const scopedConfig = configForOutput(config, output);
        // Loom's REST preview compiler is an interactive, non-persisting
        // execution path even when the source packet is the read-only
        // repository default. Keep the repository packet untouched in the
        // Builder, but send the compiler the management envelope it accepts.
        const previewConfig: ExplorerConfigV2 =
          explorerId === 'default'
            ? {
                ...scopedConfig,
                explorer: {
                  ...scopedConfig.explorer,
                  id: 'default',
                  management: 'interactive',
                },
              }
            : scopedConfig;
        const result = await requestJson<ExplorerPreview>(
          `${explorerRoot(project)}/${encodeURIComponent(explorerId)}/preview`,
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              config: previewConfig,
              output,
              limit,
              ...(draftDigest ? { draftDigest } : {}),
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        return result.error
          ? { error: result.error }
          : { data: result.data as ExplorerPreview };
      },
    }),
    getExplorerAuthoringCatalog: builder.query<
      ExplorerAuthoringCatalogResponse,
      ExplorerAuthoringCatalogRequest
    >({
      async queryFn({ project, output, config, datasetGeneration }, api) {
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
          const rootResourceType = selectedOutput?.rootResourceType?.trim();
          if (!rootResourceType) {
            const diagnostics: ReadonlyArray<ExplorerDiagnostic> = [
              {
                severity: 'error',
                code: 'ROOT_RESOURCE_REQUIRED',
                message: `Choose a row resource before discovering the ${output} traversal.`,
              },
            ];
            const digest = await catalogDigest({
              project,
              output,
              resources: [],
              relationships: [],
              candidates: [],
              diagnostics,
            });
            return {
              data: {
                snapshotToken: `loom:${digest}`,
                catalogDigest: digest,
                complete: false,
                diagnostics,
                resources: [],
                relationships: [],
                candidates: [],
              },
            };
          }

          const traversalNodes = selectedOutput
            ? collectTraversalNodes(selectedOutput)
            : [];
          const diagnostics: ExplorerDiagnostic[] = [];
          const resourceHintsByType = new Map<
            string,
            {
              readonly fields: Map<
                string,
                {
                  readonly field: IntrospectionField;
                  readonly family: ExplorerAuthoringCandidate['family'];
                }
              >;
            }
          >();
          const resourcesByType = new Map<
            string,
            { readonly resourceType: string; readonly label: string }
          >();
          const relationshipsById = new Map<
            string,
            ExplorerAuthoringCatalogResponse['relationships'][number]
          >();
          // V2 authoring discovery is served by the REST catalog below. The
          // retired GraphQL Builder introspection contract is intentionally
          // never used as a fallback.
          const queued = new Set<string>();
          const queue: string[] = [];
          let authResourcePaths: ReadonlyArray<string> | undefined;
          let rootSucceeded = false;

          const addResource = (resourceType: string) => {
            if (!resourcesByType.has(resourceType))
              resourcesByType.set(resourceType, {
                resourceType,
                label: resourceType,
              });
            if (!resourceHintsByType.has(resourceType))
              resourceHintsByType.set(resourceType, { fields: new Map() });
          };
          const addFields = (
            resourceType: string,
            fields: ReadonlyArray<IntrospectionField> | undefined,
            family: ExplorerAuthoringCandidate['family'],
          ) => {
            if (!fields?.length) return;
            addResource(resourceType);
            const target = resourceHintsByType.get(resourceType);
            if (!target) return;
            for (const field of fields) {
              const path = field.path?.trim() || field.fieldRef?.trim();
              if (!path) {
                diagnostics.push({
                  severity: 'error',
                  code: 'INVALID_INTROSPECTION_FIELD',
                  message: `Loom returned a ${resourceType} field without a path or field reference.`,
                });
                continue;
              }
              target.fields.set(`${family}:${path}`, { field, family });
            }
          };
          const addRelationship = (
            source: string,
            relationship: IntrospectionTraversal,
          ) => {
            const target = relationship.toType?.trim();
            const label = relationship.label?.trim();
            if (
              !target ||
              !label ||
              (relationship.edgeCount !== undefined &&
                relationship.edgeCount <= 0)
            )
              return;
            addResource(source);
            addResource(target);
            const id = `${source}/${label}/${target}`;
            relationshipsById.set(id, {
              id,
              source,
              target,
              label,
              linkCount: relationship.edgeCount,
              direction: 'outbound',
            });
            if (!queued.has(target)) {
              queued.add(target);
              queue.push(target);
            }
          };

          while (queue.length > 0) {
            const resourceType = queue.shift() as string;
            let response: IntrospectionPayload;
            try {
              response = await fetchGraphQL<IntrospectionPayload>(
                {
                  query: introspectionQuery,
                  variables: {
                    input: {
                      project,
                      rootResourceType: resourceType,
                      includePivotOnlyFields: true,
                      ...(datasetGeneration?.trim()
                        ? { datasetGeneration: datasetGeneration.trim() }
                        : {}),
                      ...(authResourcePaths?.length
                        ? { authResourcePaths }
                        : {}),
                    },
                  },
                },
                { endpoint: graphEndpoint, signal: api.signal },
              );
            } catch (error) {
              const failure = errorFromUnknown(
                error,
                graphEndpoint,
                'INTROSPECTION_FAILED',
              );
              const message =
                failure.message ?? `Loom could not introspect ${resourceType}.`;
              if (resourceType === rootResourceType && !rootSucceeded)
                throw error;
              diagnostics.push({
                severity: 'error',
                code: failure.code ?? 'INTROSPECTION_FAILED',
                message,
                endpoint: failure.endpoint,
                requestId: failure.requestId,
                retryable: failure.retryable,
              });
              continue;
            }
            const introspection = response.dataframeBuilderIntrospection;
            if (!introspection?.root) {
              const error = new Error(
                `Loom returned no introspection root for ${resourceType}.`,
              );
              if (resourceType === rootResourceType && !rootSucceeded)
                throw error;
              diagnostics.push({
                severity: 'error',
                code: 'INTROSPECTION_ROOT_MISSING',
                message: error.message,
              });
              continue;
            }
            rootSucceeded = rootSucceeded || resourceType === rootResourceType;
            if (!authResourcePaths && introspection.authResourcePaths?.length)
              authResourcePaths = introspection.authResourcePaths;
            const resolvedType =
              introspection.rootResourceType?.trim() || resourceType;
            addResource(resolvedType);
            addFields(
              resolvedType,
              [
                ...(introspection.root.fields ?? []),
                ...(introspection.fields ?? []),
              ],
              'field',
            );
            addFields(
              resolvedType,
              [
                ...(introspection.root.pivotFields ?? []),
                ...(introspection.pivotFields ?? []),
              ],
              'pivot',
            );
            const traversals = [
              ...(introspection.root.traversals ?? []),
              ...(introspection.traversals ?? []),
            ];
            for (const relationship of traversals)
              addRelationship(
                relationship.fromType?.trim() || resolvedType,
                relationship,
              );
            for (const related of introspection.relatedResources ?? []) {
              const target = related.target?.resourceType?.trim();
              const label = related.viaLabel?.trim();
              if (!target || !label) continue;
              addResource(target);
              addFields(target, related.target?.fields, 'field');
              addFields(target, related.target?.pivotFields, 'pivot');
              addRelationship(resolvedType, {
                fromType: resolvedType,
                toType: target,
                label,
                edgeCount: related.edgeCount,
              });
            }
          }

          // Graph introspection describes topology and raw selectors. The
          // supported authoring catalog supplies the opaque selection IDs and
          // immutable snapshot token used by the REST compile endpoint.
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
          // The supported authoring catalog supplies the project-wide graph,
          // opaque selection IDs, and the immutable snapshot used by REST
          // compilation. Introspection above supplies raw selectors for the
          // currently reachable nodes.
          const supportedCatalog = await fetchExplorerAuthoringCatalog(
            project,
            requestedExplorerId || 'default',
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
            const introspectionFields = [
              ...(resourceHintsByType.get(node.resourceType)?.fields.values() ??
                []),
            ].map(({ field }) => field);
            for (const catalogNode of catalogNodes) {
              for (const column of catalogNode.columns ?? []) {
                const normalized = authoringCatalogColumnToCandidate(
                  column,
                  node.resourceType,
                  output,
                  node.nodePath,
                  introspectionFields,
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
            authResourcePaths,
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
            graphEndpoint,
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
    compileExplorerAuthoring: builder.mutation<
      ExplorerAuthoringCompileResponse,
      ExplorerAuthoringCompileRequest
    >({
      async queryFn(
        {
          project,
          explorerId,
          output,
          config,
          snapshotToken,
          selectedCandidateIdsByNode,
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
        const result = await requestJson<ExplorerAuthoringCompileResponse>(
          `${explorerRoot(project)}/${encodeURIComponent(explorerId)}/authoring/compile`,
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              output,
              config,
              snapshotToken,
              selectedCandidateIdsByNode,
              expectedDraftVersion,
              expectedDraftDigest,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        return result.error
          ? { error: result.error }
          : { data: result.data as ExplorerAuthoringCompileResponse };
      },
    }),
    publishExplorer: builder.mutation<
      ExplorerPublicationResult,
      PublishExplorerRequest
    >({
      async queryFn(
        { project, explorerId, expectedDraftVersion, expectedDraftDigest },
        api,
      ) {
        if (explorerId === 'default') return repositoryReadOnlyError();
        const result = await requestJson<ExplorerPublicationResult>(
          `${explorerRoot(project)}/${encodeURIComponent(explorerId)}/publish`,
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({ expectedDraftVersion, expectedDraftDigest }),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        const value = result.data as ExplorerPublicationResult;
        const normalized = normalizeExplorerState(value, project, explorerId);
        return {
          data: {
            ...normalized,
            activeUrl: value.activeUrl,
            publicationId: value.publicationId,
            shareUrl: value.shareUrl,
            materializationMappings: value.materializationMappings,
          },
        };
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER', id: `${args.project}:${args.explorerId}` },
        { type: 'LOOM_EXPLORER', id: args.project },
      ],
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
        return { data: result.data as RepositoryExplorerConfig };
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
          : { data: result.data as RepositoryExplorerConfig };
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
  useSaveExplorerDraftMutation,
  usePreviewExplorerDraftMutation,
  useGetExplorerAuthoringCatalogQuery,
  useCompileExplorerAuthoringMutation,
  usePublishExplorerMutation,
  useGetActiveExplorerQuery,
  useGetRepositoryExplorerConfigQuery,
} = loomExplorerApi;
