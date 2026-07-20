import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { createApi } from '@reduxjs/toolkit/query/react';
import { getCookie } from 'cookies-next';
import { GEN3_LOOM_API } from '../../constants';
import { selectCSRFToken } from '../user/userSliceRTK';
import type { CoreState } from '../../reducers';
import type { LoomApiError, LoomQueryArgs } from './types';

interface GraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: ReadonlyArray<{
    readonly message: string;
    readonly extensions?: { readonly code?: string };
  }>;
}

const loomBaseQuery: BaseQueryFn<
  LoomQueryArgs,
  unknown,
  LoomApiError
> = async ({ query, variables }, api) => {
  const csrfToken = selectCSRFToken(api.getState() as CoreState);
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  };
  if (process.env.NODE_ENV === 'development') {
    const accessToken = getCookie('credentials_token');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    const response = await fetch(`${GEN3_LOOM_API}/graphql/flat`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ query, variables }),
      signal: api.signal,
      cache: 'no-store',
    });
    const payload = (await response.json()) as GraphQLResponse<unknown>;
    if (!response.ok) {
      return {
        error: {
          status: response.status,
          data: payload,
          code: payload.errors?.[0]?.extensions?.code,
        },
      };
    }
    if (payload.errors?.length) {
      const first = payload.errors[0];
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: first.message,
          data: payload,
          code: first.extensions?.code,
        },
      };
    }
    return { data: payload.data };
  } catch (error: unknown) {
    return {
      error: {
        status: 'FETCH_ERROR',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
};

export const loomApi = createApi({
  reducerPath: 'loom',
  baseQuery: loomBaseQuery,
  tagTypes: ['LOOM_DATASET', 'LOOM_ROWS', 'LOOM_AGGREGATE'],
  endpoints: () => ({}),
});

export const loomApiSliceMiddleware = loomApi.middleware;
export const loomApiSliceReducerPath = loomApi.reducerPath;
export const loomApiReducer = loomApi.reducer;
