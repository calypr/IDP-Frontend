import { GEN3_LOOM_API } from '../../constants';
import type { CoreState } from '../../reducers';
import { selectCSRFToken } from '../user/userSliceRTK';
import { handleUnauthorizedStatus } from '../user/unauthorized';
import { fetchLoomResponse, loomApi } from './loomApi';
import { encodeLoomProjectPath } from './projectId';
import { viewBuilderStateSchema } from './projectViewBuilder';
import type {
  ProjectViewBuilderState,
  SaveProjectViewConfigRequest,
  SaveProjectViewDefaultsRequest,
} from './projectViewBuilder';

export interface ProjectViewBuilderApiError {
  readonly status: number | 'FETCH_ERROR' | 'CUSTOM_ERROR';
  readonly code?: string;
  readonly message: string;
  readonly retryable?: boolean;
}

export interface ProjectViewBuilderArgs {
  readonly project: string;
}

export interface SaveProjectViewConfigArgs extends ProjectViewBuilderArgs {
  readonly configId: string;
  readonly request: SaveProjectViewConfigRequest;
}

export interface DeleteProjectViewConfigArgs extends ProjectViewBuilderArgs {
  readonly configId: string;
  readonly expectedRevisionId: string;
}

export interface SaveProjectViewDefaultsArgs extends ProjectViewBuilderArgs {
  readonly request: SaveProjectViewDefaultsRequest;
}

const viewBuilderPath = (project: string) =>
  `${GEN3_LOOM_API}/api/v1/projects/${encodeLoomProjectPath(project)}/view-builder`;

const parseResponse = async (response: Response): Promise<unknown> => {
  const body = await response.text();
  if (!body) return {};
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return { message: body };
  }
};

const requestViewBuilder = async (
  endpoint: string,
  init: RequestInit,
  csrfToken: string | undefined,
): Promise<
  | { readonly data: ProjectViewBuilderState; readonly error?: never }
  | { readonly error: ProjectViewBuilderApiError; readonly data?: never }
> => {
  try {
    const response = await fetchLoomResponse(endpoint, {
      ...init,
      headers: {
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        ...(init.headers ?? {}),
      },
    });
    handleUnauthorizedStatus(response.status);
    const payload = await parseResponse(response);
    if (!response.ok) {
      const errorRecord =
        typeof payload === 'object' && payload !== null && 'error' in payload
          ? payload.error
          : payload;
      const message =
        typeof errorRecord === 'object' &&
        errorRecord !== null &&
        'message' in errorRecord &&
        typeof errorRecord.message === 'string'
          ? errorRecord.message
          : typeof errorRecord === 'string'
            ? errorRecord
            : `Project View Builder request failed (${response.status}).`;
      const code =
        typeof errorRecord === 'object' &&
        errorRecord !== null &&
        'code' in errorRecord &&
        typeof errorRecord.code === 'string'
          ? errorRecord.code
          : undefined;
      return {
        error: {
          status: response.status,
          message,
          code,
          retryable:
            response.status >= 500 ||
            response.status === 408 ||
            response.status === 429,
        },
      };
    }
    return { data: viewBuilderStateSchema.parse(payload) };
  } catch (error) {
    return {
      error: {
        status: 'FETCH_ERROR',
        message:
          error instanceof Error
            ? error.message
            : 'Project View Builder request failed.',
        retryable: true,
      },
    };
  }
};

export const projectViewBuilderApi = loomApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjectViewBuilder: builder.query<
      ProjectViewBuilderState,
      ProjectViewBuilderArgs
    >({
      async queryFn(args, api) {
        return requestViewBuilder(
          viewBuilderPath(args.project),
          { method: 'GET', cache: 'no-store', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
      },
      providesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
    saveProjectViewConfig: builder.mutation<
      ProjectViewBuilderState,
      SaveProjectViewConfigArgs
    >({
      async queryFn(args, api) {
        return requestViewBuilder(
          `${viewBuilderPath(args.project)}/configs/${encodeURIComponent(args.configId)}`,
          {
            method: 'PUT',
            signal: api.signal,
            body: JSON.stringify(args.request),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
    deleteProjectViewConfig: builder.mutation<
      ProjectViewBuilderState,
      DeleteProjectViewConfigArgs
    >({
      async queryFn(args, api) {
        const query = new URLSearchParams({
          expectedRevisionId: args.expectedRevisionId,
        });
        return requestViewBuilder(
          `${viewBuilderPath(args.project)}/configs/${encodeURIComponent(args.configId)}?${query}`,
          { method: 'DELETE', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
    saveProjectViewDefaults: builder.mutation<
      ProjectViewBuilderState,
      SaveProjectViewDefaultsArgs
    >({
      async queryFn(args, api) {
        return requestViewBuilder(
          `${viewBuilderPath(args.project)}/defaults`,
          {
            method: 'PUT',
            signal: api.signal,
            body: JSON.stringify(args.request),
          },
          selectCSRFToken(api.getState() as CoreState),
        );
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
    adoptProjectViewBuilderCatalogs: builder.mutation<
      ProjectViewBuilderState,
      ProjectViewBuilderArgs
    >({
      async queryFn(args, api) {
        return requestViewBuilder(
          `${viewBuilderPath(args.project)}/adopt`,
          { method: 'POST', signal: api.signal },
          selectCSRFToken(api.getState() as CoreState),
        );
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetProjectViewBuilderQuery,
  useSaveProjectViewConfigMutation,
  useDeleteProjectViewConfigMutation,
  useSaveProjectViewDefaultsMutation,
  useAdoptProjectViewBuilderCatalogsMutation,
} = projectViewBuilderApi;
