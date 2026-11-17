import {
  loomApi,
  loomBaseQuery,
  selectCSRFToken,
  type CoreState,
  type LoomApiError,
} from '@gen3/core';
import type { LoomClient } from '@calypr/loom-ui';
import type {
  DeleteProjectViewConfigArgs,
  ProjectViewBuilderArgs,
  SaveProjectViewConfigArgs,
  SaveProjectViewDefaultsArgs,
} from '@calypr/loom-ui/saved-views';
import type { TypedUseQuery } from '@reduxjs/toolkit/query/react';
import { createAuthenticatedLoomClient } from './authenticatedLoomClient';

export type ProjectViewBuilderState = Awaited<
  ReturnType<LoomClient['getProjectViewBuilder']>
>;

interface ProjectViewBuilderRequestError {
  readonly status: number | 'FETCH_ERROR' | 'CUSTOM_ERROR';
  readonly message: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable?: boolean;
}

const projectViewBuilderRequestError = (
  error: unknown,
): ProjectViewBuilderRequestError | undefined => {
  if (!(error instanceof Error) || !('status' in error)) return undefined;
  const status = error.status;
  if (
    typeof status !== 'number' &&
    status !== 'FETCH_ERROR' &&
    status !== 'CUSTOM_ERROR'
  ) {
    return undefined;
  }
  return {
    status,
    message: error.message,
    code: 'code' in error && typeof error.code === 'string' ? error.code : undefined,
    requestId:
      'requestId' in error && typeof error.requestId === 'string'
        ? error.requestId
        : undefined,
    retryable:
      'retryable' in error && typeof error.retryable === 'boolean'
        ? error.retryable
        : undefined,
  };
};

const requestError = (error: unknown): LoomApiError => {
  const requestError = projectViewBuilderRequestError(error);
  if (requestError) {
    return {
      status: requestError.status,
      error: requestError.message,
      code: requestError.code,
      requestId: requestError.requestId,
      retryable: requestError.retryable,
    };
  }
  return {
    status: 'CUSTOM_ERROR',
    error: error instanceof Error ? error.message : String(error),
    retryable: false,
  };
};

const projectViewBuilderApi = loomApi.injectEndpoints({
  endpoints: (builder) => ({
    getProjectViewBuilder: builder.query<
      ProjectViewBuilderState,
      ProjectViewBuilderArgs
    >({
      async queryFn(args, api) {
        const client = createAuthenticatedLoomClient(
          { current: selectCSRFToken(api.getState() as CoreState) },
        );
        try {
          return {
            data: await client.getProjectViewBuilder(args, {
              signal: api.signal,
              reload: true,
            }),
          };
        } catch (error: unknown) {
          return { error: requestError(error) };
        }
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
        const client = createAuthenticatedLoomClient(
          { current: selectCSRFToken(api.getState() as CoreState) },
        );
        try {
          return { data: await client.saveProjectViewConfig(args, api.signal) };
        } catch (error: unknown) {
          return { error: requestError(error) };
        }
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
        const client = createAuthenticatedLoomClient(
          { current: selectCSRFToken(api.getState() as CoreState) },
        );
        try {
          return {
            data: await client.deleteProjectViewConfig(args, api.signal),
          };
        } catch (error: unknown) {
          return { error: requestError(error) };
        }
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
        const client = createAuthenticatedLoomClient(
          { current: selectCSRFToken(api.getState() as CoreState) },
        );
        try {
          return { data: await client.saveProjectViewDefaults(args, api.signal) };
        } catch (error: unknown) {
          return { error: requestError(error) };
        }
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
        const client = createAuthenticatedLoomClient(
          { current: selectCSRFToken(api.getState() as CoreState) },
        );
        try {
          return {
            data: await client.adoptProjectViewBuilderCatalogs(args, api.signal),
          };
        } catch (error: unknown) {
          return { error: requestError(error) };
        }
      },
      invalidatesTags: (_result, _error, args) => [
        { type: 'LOOM_EXPLORER_AUTHORING', id: args.project },
      ],
    }),
  }),
});

export const useGetProjectViewBuilderQuery: TypedUseQuery<
  ProjectViewBuilderState,
  ProjectViewBuilderArgs,
  typeof loomBaseQuery
> =
  projectViewBuilderApi.useGetProjectViewBuilderQuery;

export const invalidateProjectViewBuilder = (
  project: string,
): ReturnType<typeof loomApi.util.invalidateTags> =>
  projectViewBuilderApi.util.invalidateTags([
    { type: 'LOOM_EXPLORER_AUTHORING', id: project },
  ]);
