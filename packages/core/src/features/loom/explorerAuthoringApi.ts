import { GEN3_LOOM_API } from '../../constants';
import type { CoreState } from '../../reducers';
import { selectCSRFToken } from '../user/userSliceRTK';
import { handleUnauthorizedStatus } from '../user/unauthorized';
import { fetchLoomResponse, loomApi } from './loomApi';
import { canonicalLoomProjectId, encodeLoomProjectPath } from './projectId';
import {
  assertExplorerBuilderCompileResult,
  assertExplorerBuilderPreviewResult,
  assertExplorerBuilderPublishResult,
  assertExplorerBuilderState,
  assertExplorerStateV1,
  explorerAuthoringCapabilitiesSchema,
  explorerBuilderSuggestionsResultSchema,
} from './explorerAuthoring';
import type {
  ExplorerAuthoringCapabilities,
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCompileResult,
  ExplorerBuilderPreviewResult,
  ExplorerBuilderPublishResult,
  ExplorerBuilderState,
  ExplorerBuilderSuggestionsResult,
  ExplorerBuilderWorkspace,
  ExplorerStateV1,
} from './explorerAuthoring';

export { canonicalLoomProjectId, encodeLoomProjectPath } from './projectId';

export interface ExplorerAuthoringApiError {
  readonly status: number | 'FETCH_ERROR' | 'CUSTOM_ERROR';
  readonly code?: string;
  readonly message: string;
  readonly diagnostics?: ReadonlyArray<ExplorerAuthoringDiagnostic>;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly retryable?: boolean;
}
export interface ExplorerSummary {
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly management: string;
  readonly activeRevisionId?: string;
  readonly updatedAt: string;
}
export interface ExplorerAuthoringStateArgs {
  readonly project: string;
  readonly explorerId: string;
  readonly authResourcePath?: string;
}
export interface ExplorerAuthoringProjectArgs {
  readonly project: string;
  readonly authResourcePath?: string;
}
export interface CompileExplorerBuilderArgs extends ExplorerAuthoringStateArgs {
  readonly workspace: ExplorerBuilderWorkspace;
  readonly snapshotToken: string;
  readonly requestId?: string;
}
export interface PreviewExplorerBuilderArgs extends ExplorerAuthoringStateArgs {
  readonly receiptId: string;
  readonly outputId: string;
  readonly limit?: number;
  readonly requestId?: string;
}
export interface PublishExplorerBuilderArgs extends ExplorerAuthoringStateArgs {
  readonly receiptId: string;
  readonly requestId?: string;
}
export interface ExplorerCandidateSuggestionsArgs
  extends ExplorerAuthoringStateArgs {
  readonly snapshotToken: string;
  readonly nodeId: string;
  readonly query?: string;
  readonly requestId?: string;
}
export interface CreateExplorerArgs extends ExplorerAuthoringProjectArgs {
  readonly name: string;
  readonly title?: string;
  readonly requestId?: string;
}

const root = (project: string) =>
  `${GEN3_LOOM_API}/api/v1/projects/${encodeLoomProjectPath(project)}/explorers`;
const withAuthResourcePath = (endpoint: string, authResourcePath?: string) => {
  const path = authResourcePath?.trim();
  if (!path) return endpoint;
  const separator = endpoint.includes('?') ? '&' : '?';
  return `${endpoint}${separator}auth_resource_path=${encodeURIComponent(path)}`;
};
const authoringRoot = (args: ExplorerAuthoringStateArgs, suffix = '') =>
  withAuthResourcePath(
    `${root(args.project)}/${encodeURIComponent(args.explorerId)}/authoring/v2${suffix}`,
    args.authResourcePath,
  );
const requestIdFrom = (response: Response) =>
  response.headers.get('x-request-id') ??
  response.headers.get('request-id') ??
  undefined;
const parseJSON = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const diagnosticsFrom = (
  value: unknown,
): ReadonlyArray<ExplorerAuthoringDiagnostic> =>
  Array.isArray(value)
    ? (value as ReadonlyArray<ExplorerAuthoringDiagnostic>)
    : [];
const errorFrom = async (
  response: Response,
): Promise<ExplorerAuthoringApiError> => {
  const payload = await parseJSON(response);
  const record = isRecord(payload) ? payload : {};
  const nested = isRecord(record.error) ? record.error : record;
  const diagnostics = diagnosticsFrom(nested.diagnostics);
  const requestId =
    requestIdFrom(response) ??
    (typeof nested.requestId === 'string' ? nested.requestId : undefined) ??
    diagnostics.find((diagnostic) => diagnostic.requestId)?.requestId;
  return {
    status: response.status,
    code: typeof nested.code === 'string' ? nested.code : undefined,
    message:
      typeof nested.message === 'string'
        ? nested.message
        : `Loom authoring request failed (${response.status}).`,
    diagnostics,
    requestId,
    details: isRecord(nested.details) ? nested.details : undefined,
    retryable:
      response.status >= 500 || response.status === 408 || response.status === 429,
  };
};
const request = async (
  endpoint: string,
  init: RequestInit,
  csrfToken: string | undefined,
  requestId?: string,
): Promise<
  | { data: unknown; error?: never }
  | { error: ExplorerAuthoringApiError; data?: never }
> => {
  try {
    const response = await fetchLoomResponse(endpoint, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(requestId ? { 'X-Request-ID': requestId } : {}),
        ...(init.headers ?? {}),
      },
    });
    handleUnauthorizedStatus(response.status);
    if (!response.ok) return { error: await errorFrom(response) };
    return { data: await parseJSON(response) };
  } catch (error) {
    if (init.signal?.aborted) {
      return {
        error: {
          status: 'CUSTOM_ERROR',
          code: 'CLIENT_CANCELLED',
          message: 'The obsolete authoring request was cancelled.',
          retryable: false,
        },
      };
    }
    return {
      error: {
        status: 'FETCH_ERROR',
        message: error instanceof Error ? error.message : String(error),
        retryable: true,
      },
    };
  }
};
const decode = <T>(
  value: unknown,
  parser: (value: unknown) => T,
  code: string,
):
  | { data: T; error?: never }
  | { error: ExplorerAuthoringApiError; data?: never } => {
  try {
    return { data: parser(value) };
  } catch (error) {
    return {
      error: {
        status: 502,
        code,
        message: error instanceof Error ? error.message : String(error),
        retryable: false,
      },
    };
  }
};

export const explorerAuthoringApi = loomApi.injectEndpoints({
  endpoints: (builder) => ({
    getExplorerAuthoringExplorers: builder.query<
      ReadonlyArray<ExplorerSummary>,
      ExplorerAuthoringProjectArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          withAuthResourcePath(root(args.project), args.authResourcePath),
          { method: 'GET', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        if (!Array.isArray(result.data)) {
          return {
            error: {
              status: 502,
              code: 'INVALID_EXPLORER_LIST',
              message: 'Loom returned a non-canonical Explorer list.',
              retryable: false,
            },
          };
        }
        return { data: result.data as ReadonlyArray<ExplorerSummary> };
      },
      providesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
    getExplorerBuilderStateV2: builder.query<
      ExplorerBuilderState,
      ExplorerAuthoringStateArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/builder'),
          { method: 'GET', cache: 'no-store', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          assertExplorerBuilderState,
          'INVALID_EXPLORER_BUILDER_STATE',
        );
      },
      providesTags: (_result, _error, args) => [
        {
          type: 'LOOM_EXPLORER_AUTHORING',
          id: `${args.project}:${args.explorerId}`,
        },
      ],
    }),
    getExplorerStateV1: builder.query<
      ExplorerStateV1,
      ExplorerAuthoringStateArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          withAuthResourcePath(
            `${root(args.project)}/${encodeURIComponent(args.explorerId)}`,
            args.authResourcePath,
          ),
          { method: 'GET', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          assertExplorerStateV1,
          'INVALID_EXPLORER_STATE',
        );
      },
      providesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER', id: `${args.project}:${args.explorerId}` },
      ],
    }),
    getExplorerAuthoringCapabilityV2: builder.query<
      ExplorerAuthoringCapabilities,
      ExplorerAuthoringStateArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/capability'),
          { method: 'GET', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          (value) => explorerAuthoringCapabilitiesSchema.parse(value),
          'INVALID_EXPLORER_AUTHORING_CAPABILITY',
        );
      },
    }),
    compileExplorerBuilderV2: builder.mutation<
      ExplorerBuilderCompileResult,
      CompileExplorerBuilderArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/builder'),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              workspace: args.workspace,
              snapshotToken: args.snapshotToken,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
          args.requestId,
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          assertExplorerBuilderCompileResult,
          'INVALID_EXPLORER_BUILDER_RECEIPT',
        );
      },
    }),
    compileExplorerBuilderAliasV2: builder.mutation<
      ExplorerBuilderCompileResult,
      CompileExplorerBuilderArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/compile'),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              workspace: args.workspace,
              snapshotToken: args.snapshotToken,
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
          args.requestId,
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          assertExplorerBuilderCompileResult,
          'INVALID_EXPLORER_BUILDER_RECEIPT',
        );
      },
    }),
    getExplorerCandidateSuggestionsV2: builder.mutation<
      ExplorerBuilderSuggestionsResult,
      ExplorerCandidateSuggestionsArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/suggestions'),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              snapshotToken: args.snapshotToken,
              nodeId: args.nodeId,
              ...(args.query ? { query: args.query } : {}),
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
          args.requestId,
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          (value) => explorerBuilderSuggestionsResultSchema.parse(value),
          'INVALID_EXPLORER_CANDIDATE_SUGGESTIONS',
        );
      },
    }),
    previewExplorerAuthoringV2: builder.mutation<
      ExplorerBuilderPreviewResult,
      PreviewExplorerBuilderArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/preview'),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              receiptId: args.receiptId,
              outputId: args.outputId,
              ...(args.limit === undefined ? {} : { limit: args.limit }),
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
          args.requestId,
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          assertExplorerBuilderPreviewResult,
          'INVALID_EXPLORER_PREVIEW',
        );
      },
    }),
    publishExplorerAuthoringV2: builder.mutation<
      ExplorerBuilderPublishResult,
      PublishExplorerBuilderArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          authoringRoot(args, '/publish'),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({ receiptId: args.receiptId }),
          },
          selectCSRFToken(api.getState() as CoreState),
          args.requestId,
        );
        if (result.error) return { error: result.error };
        return decode(
          result.data,
          assertExplorerBuilderPublishResult,
          'INVALID_EXPLORER_PUBLICATION',
        );
      },
      invalidatesTags: (_result, _error, args) => {
        const project = canonicalLoomProjectId(args.project);
        return [
          {
            type: 'LOOM_EXPLORER_AUTHORING',
            id: `${args.project}:${args.explorerId}`,
          },
          { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
          { type: 'LOOM_EXPLORER', id: `${project}:${args.explorerId}` },
          { type: 'LOOM_EXPLORER', id: project },
        ];
      },
    }),
    createExplorerAuthoring: builder.mutation<
      ExplorerSummary,
      CreateExplorerArgs
    >({
      async queryFn(args, api) {
        const result = await request(
          withAuthResourcePath(root(args.project), args.authResourcePath),
          {
            method: 'POST',
            signal: api.signal,
            body: JSON.stringify({
              name: args.name,
              ...(args.title ? { title: args.title } : {}),
            }),
          },
          selectCSRFToken(api.getState() as CoreState),
          args.requestId,
        );
        return result.error
          ? { error: result.error }
          : { data: result.data as ExplorerSummary };
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetExplorerAuthoringExplorersQuery,
  useGetExplorerBuilderStateV2Query,
  useGetExplorerStateV1Query,
  useGetExplorerAuthoringCapabilityV2Query,
  useCompileExplorerBuilderV2Mutation,
  useCompileExplorerBuilderAliasV2Mutation,
  useGetExplorerCandidateSuggestionsV2Mutation,
  usePreviewExplorerAuthoringV2Mutation,
  usePublishExplorerAuthoringV2Mutation,
  useCreateExplorerAuthoringMutation,
} = explorerAuthoringApi;
