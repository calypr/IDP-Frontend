import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { createApi } from '@reduxjs/toolkit/query/react';
import { getCookie } from 'cookies-next';
import { GEN3_LOOM_API } from '../../constants';
import { selectCSRFToken } from '../user/userSliceRTK';
import type { CoreState } from '../../reducers';
import type {
  LoomApiError,
  LoomGraphQLResponse,
  LoomQueryArgs,
  LoomRequestOptions,
} from './types';

type LoomRequestError = Error & {
  readonly status?: number | 'CUSTOM_ERROR';
  readonly data?: unknown;
  readonly code?: string;
};

const authSummary = (headers: Record<string, string>) => {
  const cookie = headers.Cookie ?? headers.cookie;
  const authorization = headers.Authorization ?? headers.authorization;
  return {
    hasCookie: Boolean(cookie),
    cookieNames: cookie
      ?.split(';')
      .map((part) => part.trim().split('=', 1)[0])
      .filter(Boolean),
    hasAuthorization: Boolean(authorization),
    authorizationScheme: authorization?.split(' ', 1)[0],
  };
};

export const fetchLoomResponse = async (
  endpoint: string,
  init: RequestInit = {},
): Promise<Response> => {
  const headers = new Headers(init.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (process.env.NODE_ENV === 'development' && !headers.has('Authorization')) {
    const accessToken = getCookie('credentials_token');
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  }

  console.info('[Loom] Request', {
    endpoint,
    method: init.method ?? 'GET',
    ...(typeof window === 'undefined'
      ? {
          auth: authSummary({
            Cookie: headers.get('Cookie') ?? '',
            Authorization: headers.get('Authorization') ?? '',
          }),
        }
      : {}),
  });

  const response = await fetch(endpoint, {
    ...init,
    credentials: 'include',
    headers,
  });

  console.info('[Loom] Response', {
    status: response.status,
    requestId: response.headers.get('x-request-id') ?? 'none',
  });
  return response;
};

export const fetchLoomGraphQL = async <T>(
  { query, variables }: LoomQueryArgs,
  options: LoomRequestOptions = {},
): Promise<T> => {
  const endpoint = options.endpoint ?? `${GEN3_LOOM_API}/graphql/flat`;
  const response = await fetchLoomResponse(endpoint, {
    method: 'POST',
    headers: options.headers,
    body: JSON.stringify({ query, variables }),
    signal: options.signal,
    cache: 'no-store',
  });
  const responseText = await response.text();
  let payload: LoomGraphQLResponse<T>;
  try {
    payload = JSON.parse(responseText) as LoomGraphQLResponse<T>;
  } catch {
    throw Object.assign(
      new Error(`Loom GraphQL returned non-JSON HTTP ${response.status}`),
      { status: response.status },
    );
  }
  if (payload.errors?.length) {
    console.error('[Loom] GraphQL errors', payload.errors);
  }

  if (!response.ok || payload.errors?.length) {
    const status: number | 'CUSTOM_ERROR' = response.ok
      ? 'CUSTOM_ERROR'
      : response.status;
    const error: LoomRequestError = Object.assign(
      new Error(
        payload.errors?.[0]?.message ??
          `Loom GraphQL request failed with HTTP ${response.status}`,
      ),
      {
        status,
        data: payload,
        code: payload.errors?.[0]?.extensions?.code,
      },
    );
    throw error;
  }
  if (payload.data === undefined) {
    throw new Error('Loom GraphQL response did not contain data');
  }
  return payload.data;
};

const loomBaseQuery: BaseQueryFn<LoomQueryArgs, unknown, LoomApiError> = async (
  { query, variables },
  api,
) => {
  const csrfToken = selectCSRFToken(api.getState() as CoreState);
  try {
    return {
      data: await fetchLoomGraphQL<unknown>(
        { query, variables },
        {
          signal: api.signal,
          headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
        },
      ),
    };
  } catch (error: unknown) {
    const requestError = error as LoomRequestError;
    console.error('[Loom] Query failed', {
      operation:
        query.match(/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1] ??
        'anonymous',
      status: requestError.status ?? 'FETCH_ERROR',
      error: error instanceof Error ? error.message : String(error),
      data: requestError.data,
    });
    return {
      error: {
        status: requestError.status ?? 'FETCH_ERROR',
        data: requestError.data,
        code: requestError.code,
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
