import { GEN3_LOOM_API } from '../../constants';
import { selectCSRFToken } from '../user/userSliceRTK';
import { handleUnauthorizedStatus } from '../user/unauthorized';
import type { CoreState } from '../../reducers';
import { fetchLoomResponse, loomApi } from './loomApi';
import { canonicalLoomProjectId, encodeLoomProjectPath } from './projectId';
import type {
  ExplorerAuthoringDiagnosticV1,
  ExplorerBuilderStateV1,
  LoomBuilderDocument,
  LoomAuthoringBundle,
  ExplorerStateV1,
} from './explorerAuthoring';

export { canonicalLoomProjectId, encodeLoomProjectPath } from './projectId';

export interface ExplorerAuthoringApiError {
  readonly status: number | 'FETCH_ERROR' | 'CUSTOM_ERROR';
  readonly code?: string;
  readonly message: string;
  readonly diagnostics?: ReadonlyArray<ExplorerAuthoringDiagnosticV1>;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly retryable?: boolean;
}
export interface ExplorerSummaryV1 {
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly management: string;
  readonly activeRevisionId?: string;
  readonly updatedAt: string;
}
export interface ExplorerAuthoringStateArgs { readonly project: string; readonly explorerId: string }
export interface ExplorerAuthoringProjectArgs { readonly project: string }
export interface PreviewArgs extends ExplorerAuthoringStateArgs { readonly bundle: LoomAuthoringBundle; readonly snapshotToken: string; readonly outputId: string; readonly limit: number; readonly requestId?: string }
export interface CompileArgs extends ExplorerAuthoringStateArgs { readonly document: LoomBuilderDocument; readonly snapshotToken: string; readonly scope: 'DOCUMENT'; readonly intentDigest?: string; readonly requestId?: string }
export interface CompileResult { readonly receiptId?: string; readonly intentDigest?: string; readonly documentDigest?: string; readonly snapshotToken: string; readonly normalizedDocument?: LoomBuilderDocument; readonly outputs: ReadonlyArray<Record<string, unknown>>; readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnosticV1>; readonly complete?: boolean }
export interface PublishArgs extends ExplorerAuthoringStateArgs { readonly bundle: LoomAuthoringBundle; readonly snapshotToken: string; readonly requestId?: string }
export interface IdentityArgs extends ExplorerAuthoringProjectArgs { readonly name: string; readonly title?: string; readonly requestId?: string }
export interface CreateArgs extends ExplorerAuthoringProjectArgs { readonly name: string; readonly title?: string; readonly requestId?: string }
export interface PreviewResult { readonly outputId: string; readonly columns: ReadonlyArray<Record<string, unknown>>; readonly rows: ReadonlyArray<Record<string, unknown>>; readonly rowCount: number; readonly snapshotToken: string; readonly generation?: string; readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnosticV1> }
export interface CapabilitiesV1 { readonly apiVersion: string; readonly kind: string; readonly operations: ReadonlyArray<string>; readonly publication?: string }
export interface IdentityV1 { readonly apiVersion: string; readonly kind: 'ExplorerIdentity'; readonly explorerId: string; readonly title: string }

const root = (project: string) => `${GEN3_LOOM_API}/api/v1/projects/${encodeLoomProjectPath(project)}/explorers`;
const authoringRoot = (args: ExplorerAuthoringStateArgs) => `${root(args.project)}/${encodeURIComponent(args.explorerId)}/authoring/v1`;
const requestIdFrom = (response: Response) => response.headers.get('x-request-id') ?? response.headers.get('request-id') ?? undefined;
const parseJSON = async (response: Response): Promise<unknown> => { const text = await response.text(); if (!text) return {}; try { return JSON.parse(text) as unknown } catch { return { message: text } } };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const diagnosticsFrom = (value: unknown): ReadonlyArray<ExplorerAuthoringDiagnosticV1> => Array.isArray(value) ? value as ReadonlyArray<ExplorerAuthoringDiagnosticV1> : [];
const unwrapData = (value: unknown): unknown => {
  if (!isRecord(value) || !('data' in value)) return value;
  return value.data;
};
const summaryListFrom = (value: unknown): ReadonlyArray<ExplorerSummaryV1> => {
  const payload = unwrapData(value);
  if (Array.isArray(payload)) return payload as ReadonlyArray<ExplorerSummaryV1>;
  if (isRecord(payload) && Array.isArray(payload.explorers)) {
    return payload.explorers as ReadonlyArray<ExplorerSummaryV1>;
  }
  return [];
};
const errorFrom = async (response: Response): Promise<ExplorerAuthoringApiError> => {
  const payload = await parseJSON(response);
  const record = isRecord(payload) ? payload : {};
  const nested = isRecord(record.error) ? record.error : {};
  const diagnostics = diagnosticsFrom(record.diagnostics ?? nested.diagnostics);
  const requestId = requestIdFrom(response) ?? (typeof nested.requestId === 'string' ? nested.requestId : typeof record.requestId === 'string' ? record.requestId : diagnostics.find((diagnostic) => typeof diagnostic.requestId === 'string')?.requestId);
  return {
    status: response.status,
    code: typeof nested.code === 'string' ? nested.code : typeof record.code === 'string' ? record.code : undefined,
    message: typeof nested.message === 'string' ? nested.message : typeof record.message === 'string' ? record.message : `Loom authoring request failed (${response.status}).`,
    diagnostics,
    requestId,
    details: isRecord(nested.details) ? nested.details : isRecord(record.details) ? record.details : undefined,
    retryable: response.status >= 500 || response.status === 429,
  };
};
const request = async <T>(endpoint: string, init: RequestInit, csrfToken: string | undefined, requestId?: string): Promise<{ data?: T; error?: ExplorerAuthoringApiError }> => {
  try {
    const response = await fetchLoomResponse(endpoint, { ...init, headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(requestId ? { 'X-Request-ID': requestId } : {}), ...(init.headers ?? {}) } });
    handleUnauthorizedStatus(response.status);
    if (!response.ok) return { error: await errorFrom(response) };
    return { data: (await parseJSON(response)) as T };
  } catch (error) {
    return { error: { status: 'FETCH_ERROR', message: error instanceof Error ? error.message : String(error), retryable: true } };
  }
};
const assertBuilderState = (value: unknown): ExplorerBuilderStateV1 => {
  if (!isRecord(value) || value.kind !== 'ExplorerBuilderState' || !isRecord(value.bundle) || !isRecord(value.catalog) || !Array.isArray(value.bindings)) throw new Error('Loom returned an invalid ExplorerBuilderStateV1 response.');
  const bundle = value.bundle;
  const catalog = value.catalog;
  const normalizeDocument = (candidate: unknown): LoomBuilderDocument | undefined => {
    if (!isRecord(candidate)) return undefined;
    return {
      ...(candidate as unknown as LoomBuilderDocument),
      routeEdgeIds: Array.isArray(candidate.routeEdgeIds) ? candidate.routeEdgeIds.filter((item): item is string => typeof item === 'string') : [],
      routeOccurrences: Array.isArray(candidate.routeOccurrences) ? candidate.routeOccurrences as LoomBuilderDocument['routeOccurrences'] : [],
      candidateIds: Array.isArray(candidate.candidateIds) ? candidate.candidateIds.filter((item): item is string => typeof item === 'string') : [],
      candidateOccurrences: Array.isArray(candidate.candidateOccurrences) ? candidate.candidateOccurrences as LoomBuilderDocument['candidateOccurrences'] : [],
      presentation: isRecord(candidate.presentation) ? candidate.presentation as LoomBuilderDocument['presentation'] : {},
    };
  };
  const documents = Array.isArray(bundle.documents)
    ? bundle.documents.flatMap((candidate) => {
        const document = normalizeDocument(candidate);
        return document ? [document] : [];
      })
    : [];
  const document = normalizeDocument(bundle.document);
  const nodes = (Array.isArray(catalog.nodes) ? catalog.nodes : []).filter(isRecord);
  const edges = (Array.isArray(catalog.edges)
    ? catalog.edges
    : Array.isArray(catalog.routeEdges)
      ? catalog.routeEdges
      : []).filter(isRecord);
  const candidates = (Array.isArray(catalog.candidates) ? catalog.candidates : []).filter(isRecord).map((candidate) => ({
    ...candidate,
    label:
      (typeof candidate.label === 'string' && candidate.label.trim()) ||
      (typeof candidate.path === 'string' && candidate.path.trim()) ||
      (typeof candidate.fieldRef === 'string' && candidate.fieldRef.trim()) ||
      (typeof candidate.candidateId === 'string' && candidate.candidateId.trim()) ||
      '',
  }));
  const bindings = value.bindings.filter(isRecord).map((binding) => ({
    ...binding,
    routeOccurrences: Array.isArray(binding.routeOccurrences) ? binding.routeOccurrences : [],
    candidateEmissions: Array.isArray(binding.candidateEmissions) ? binding.candidateEmissions : [],
  }));
  return {
    ...(value as unknown as ExplorerBuilderStateV1),
    bundle: {
      ...(bundle as unknown as ExplorerBuilderStateV1['bundle']),
      ...(document ? { document } : {}),
      documents,
      tabs: Array.isArray(bundle.tabs) ? bundle.tabs as ExplorerBuilderStateV1['bundle']['tabs'] : [],
    },
    catalog: {
      ...(catalog as unknown as ExplorerBuilderStateV1['catalog']),
      nodes: nodes as unknown as ExplorerBuilderStateV1['catalog']['nodes'],
      edges: edges as unknown as ExplorerBuilderStateV1['catalog']['edges'],
      candidates: candidates as unknown as ExplorerBuilderStateV1['catalog']['candidates'],
    },
    bindings: bindings as unknown as ExplorerBuilderStateV1['bindings'],
    diagnostics: Array.isArray(value.diagnostics) ? value.diagnostics as ExplorerBuilderStateV1['diagnostics'] : [],
  };
};

export const explorerAuthoringApi = loomApi.injectEndpoints({
  endpoints: (builder) => ({
    getExplorerAuthoringExplorersV1: builder.query<ReadonlyArray<ExplorerSummaryV1>, ExplorerAuthoringProjectArgs>({
      async queryFn(args, api) { const result = await request<unknown>(root(args.project), { method: 'GET', signal: api.signal }, selectCSRFToken(api.getState() as CoreState)); return result.error ? { error: result.error } : { data: summaryListFrom(result.data) }; },
      providesTags: (_result, _error, args) => [{ type: 'LOOM_EXPLORER_AUTHORING', id: args.project }],
    }),
    getExplorerBuilderStateV1: builder.query<ExplorerBuilderStateV1, ExplorerAuthoringStateArgs>({
      async queryFn(args, api) { const result = await request<unknown>(`${authoringRoot(args)}/builder`, { method: 'GET', cache: 'no-store', signal: api.signal }, selectCSRFToken(api.getState() as CoreState)); if (result.error) return { error: result.error }; try { return { data: assertBuilderState(unwrapData(result.data)) }; } catch (error) { return { error: { status: 502, code: 'INVALID_EXPLORER_BUILDER_STATE', message: error instanceof Error ? error.message : String(error), retryable: false } }; } },
      providesTags: (_result, _error, args) => [{ type: 'LOOM_EXPLORER_AUTHORING', id: `${args.project}:${args.explorerId}` }],
    }),
    // Runtime/viewer consumers retain the lightweight selected Explorer
    // projection. Authoring hydration always uses the combined Builder query
    // above, so this endpoint never carries editable bundle state.
    getExplorerStateV1: builder.query<ExplorerStateV1, ExplorerAuthoringStateArgs>({
      async queryFn(args, api) {
        const result = await request<ExplorerStateV1>(`${root(args.project)}/${encodeURIComponent(args.explorerId)}`, { method: 'GET', signal: api.signal }, selectCSRFToken(api.getState() as CoreState));
        return result.error ? { error: result.error } : { data: unwrapData(result.data) as ExplorerStateV1 };
      },
      providesTags: (_result, _error, args) => [{ type: 'LOOM_EXPLORER', id: `${args.project}:${args.explorerId}` }],
    }),
    getExplorerAuthoringCapabilitiesV1: builder.query<CapabilitiesV1, ExplorerAuthoringStateArgs>({
      async queryFn(args, api) { const result = await request<CapabilitiesV1>(`${authoringRoot(args)}/capabilities`, { method: 'GET', signal: api.signal }, selectCSRFToken(api.getState() as CoreState)); return result.error ? { error: result.error } : { data: result.data as CapabilitiesV1 }; },
    }),
    compileExplorerAuthoringV1: builder.mutation<CompileResult, CompileArgs>({
      async queryFn(args, api) {
        const result = await request<CompileResult>(`${authoringRoot(args)}/compile`, { method: 'POST', signal: api.signal, body: JSON.stringify({ document: args.document, snapshotToken: args.snapshotToken, scope: args.scope, ...(args.intentDigest ? { intentDigest: args.intentDigest } : {}) }) }, selectCSRFToken(api.getState() as CoreState), args.requestId);
        return result.error ? { error: result.error } : { data: { ...(result.data as CompileResult), snapshotToken: result.data?.snapshotToken ?? args.snapshotToken, outputs: result.data?.outputs ?? [], diagnostics: diagnosticsFrom(result.data?.diagnostics) } };
      },
    }),
    previewExplorerAuthoringV1: builder.mutation<PreviewResult, PreviewArgs>({
      async queryFn(args, api) { const result = await request<PreviewResult>(`${authoringRoot(args)}/preview`, { method: 'POST', signal: api.signal, body: JSON.stringify({ bundle: args.bundle, snapshotToken: args.snapshotToken, outputId: args.outputId, limit: args.limit }) }, selectCSRFToken(api.getState() as CoreState), args.requestId); return result.error ? { error: result.error } : { data: result.data as PreviewResult }; },
    }),
    publishExplorerAuthoringV1: builder.mutation<ExplorerBuilderStateV1, PublishArgs>({
      async queryFn(args, api) { const result = await request<unknown>(`${authoringRoot(args)}/publish`, { method: 'POST', signal: api.signal, body: JSON.stringify({ bundle: args.bundle, snapshotToken: args.snapshotToken }) }, selectCSRFToken(api.getState() as CoreState), args.requestId); if (result.error) return { error: result.error }; try { return { data: assertBuilderState(unwrapData(result.data)) }; } catch (error) { return { error: { status: 502, code: 'INVALID_EXPLORER_BUILDER_STATE', message: error instanceof Error ? error.message : String(error), retryable: false } }; } },
      invalidatesTags: (_result, _error, args) => {
        const project = canonicalLoomProjectId(args.project);
        return [
          { type: 'LOOM_EXPLORER_AUTHORING', id: `${args.project}:${args.explorerId}` },
          { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
          { type: 'LOOM_EXPLORER', id: `${project}:${args.explorerId}` },
          { type: 'LOOM_EXPLORER', id: project },
        ];
      },
    }),
    createExplorerAuthoringIdentityV1: builder.mutation<IdentityV1, IdentityArgs>({
      async queryFn(args, api) { const result = await request<IdentityV1>(`${root(args.project)}/authoring/v1/identity`, { method: 'POST', signal: api.signal, body: JSON.stringify({ name: args.name, ...(args.title ? { title: args.title } : {}) }) }, selectCSRFToken(api.getState() as CoreState), args.requestId); return result.error ? { error: result.error } : { data: result.data as IdentityV1 }; },
    }),
    createExplorerAuthoringV1: builder.mutation<ExplorerSummaryV1, CreateArgs>({
      async queryFn(args, api) { const result = await request<ExplorerSummaryV1>(root(args.project), { method: 'POST', signal: api.signal, body: JSON.stringify({ name: args.name, ...(args.title ? { title: args.title } : {}) }) }, selectCSRFToken(api.getState() as CoreState), args.requestId); return result.error ? { error: result.error } : { data: result.data as ExplorerSummaryV1 }; },
      invalidatesTags: (_result, _error, args) => [{ type: 'LOOM_EXPLORER_AUTHORING', id: args.project }],
    }),
  }),
  overrideExisting: false,
});

export const { useGetExplorerAuthoringExplorersV1Query, useGetExplorerBuilderStateV1Query, useGetExplorerStateV1Query, useGetExplorerAuthoringCapabilitiesV1Query, useCompileExplorerAuthoringV1Mutation, usePreviewExplorerAuthoringV1Mutation, usePublishExplorerAuthoringV1Mutation, useCreateExplorerAuthoringIdentityV1Mutation, useCreateExplorerAuthoringV1Mutation } = explorerAuthoringApi;

export const downloadExplorerAuthoringBundle = async ({ project, explorerId, requestId }: ExplorerAuthoringStateArgs & { readonly requestId?: string }): Promise<{ readonly blob: Blob; readonly filename: string; readonly etag?: string }> => {
  const response = await fetchLoomResponse(`${authoringRoot({ project, explorerId })}/bundle/active`, { method: 'GET', headers: requestId ? { 'X-Request-ID': requestId } : {} });
  handleUnauthorizedStatus(response.status);
  if (!response.ok) throw await errorFrom(response);
  const disposition = response.headers.get('content-disposition') ?? '';
  return { blob: await response.blob(), filename: /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? `${explorerId}-active.json`, etag: response.headers.get('etag') ?? undefined };
};
