import type { BaseQueryFn } from '@reduxjs/toolkit/query';
import { createApi } from '@reduxjs/toolkit/query/react';
import { getCookie } from 'cookies-next';
import { GEN3_LOOM_API } from '../../constants';
import { selectCSRFToken } from '../user/userSliceRTK';
import { LoomGraphQLRequestError } from './types';
import type { CoreState } from '../../reducers';
import type {
  LoomApiError,
  LoomGraphQLResponse,
  LoomGraphQLError,
  LoomQueryArgs,
  LoomRequestMeta,
  LoomRequestOptions,
} from './types';

type LoomRequestError = Error &
  Partial<Pick<LoomGraphQLRequestError, 'status' | 'data' | 'code'>> & {
    readonly requestId?: string;
    readonly retryable?: boolean;
    readonly fieldPath?: string | null;
    readonly httpStatus?: number;
    readonly meta?: LoomRequestMeta;
  };

interface GraphQLExecutionResult<T> {
  readonly data: T;
  readonly meta: LoomRequestMeta;
}

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

const getResponseRequestId = (response: Response): string | undefined =>
  response.headers.get('x-request-id') ??
  response.headers.get('x-requestid') ??
  response.headers.get('request-id') ??
  undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isAbortError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'AbortError';

const isRetryableHttpStatus = (status: number): boolean =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const getFirstGraphQLError = (
  errors: unknown,
): LoomGraphQLError | undefined => {
  if (!Array.isArray(errors)) return undefined;
  const error = errors[0];
  if (!isRecord(error)) return undefined;

  return {
    message:
      typeof error.message === 'string'
        ? error.message
        : 'GraphQL request failed',
    locations: Array.isArray(error.locations)
      ? (error.locations as LoomGraphQLError['locations'])
      : undefined,
    path: Array.isArray(error.path)
      ? (error.path as LoomGraphQLError['path'])
      : undefined,
    extensions: isRecord(error.extensions)
      ? (error.extensions as LoomGraphQLError['extensions'])
      : undefined,
  };
};

const getGraphQLErrorRequestId = (
  error: LoomGraphQLError | undefined,
  responseRequestId: string | undefined,
): string | undefined =>
  typeof error?.extensions?.requestId === 'string'
    ? error.extensions.requestId
    : responseRequestId;

const getGraphQLErrorFieldPath = (
  error: LoomGraphQLError | undefined,
): string | null | undefined => {
  const fieldPath = error?.extensions?.fieldPath;
  if (typeof fieldPath === 'string' || fieldPath === null) return fieldPath;
  return error?.path?.length ? error.path.join('.') : undefined;
};

const createGraphQLError = ({
  response,
  endpoint,
  payload,
  responseRequestId,
}: {
  response: Response;
  endpoint: string;
  payload?: unknown;
  responseRequestId?: string;
}): LoomGraphQLRequestError => {
  const firstError = getFirstGraphQLError(
    isRecord(payload) ? payload.errors : undefined,
  );
  const extensions = firstError?.extensions;
  const requestId = getGraphQLErrorRequestId(firstError, responseRequestId);
  const status = response.ok ? 'CUSTOM_ERROR' : response.status;
  const retryable =
    typeof extensions?.retryable === 'boolean'
      ? extensions.retryable
      : isRetryableHttpStatus(response.status);

  return new LoomGraphQLRequestError({
    status,
    httpStatus: response.status,
    message:
      firstError?.message ??
      `Loom GraphQL request failed with HTTP ${response.status}`,
    data: payload,
    code: typeof extensions?.code === 'string' ? extensions.code : undefined,
    requestId,
    retryable,
    fieldPath: getGraphQLErrorFieldPath(firstError),
    meta: {
      endpoint,
      status: response.status,
      requestId,
    },
  });
};

const executeGraphQL = async <T>(
  { query, variables }: LoomQueryArgs,
  options: LoomRequestOptions = {},
): Promise<GraphQLExecutionResult<T>> => {
  const endpoint = options.endpoint ?? `${GEN3_LOOM_API}/graphql/flat`;
  let response: Response;

  try {
    response = await fetchLoomResponse(endpoint, {
      method: 'POST',
      headers: options.headers,
      body: JSON.stringify({ query, variables }),
      signal: options.signal,
      cache: 'no-store',
    });
  } catch (error: unknown) {
    if (isAbortError(error)) throw error;
    console.error('[Loom] Transport failed', {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new LoomGraphQLRequestError({
      status: 'FETCH_ERROR',
      message: error instanceof Error ? error.message : String(error),
      retryable: true,
      meta: { endpoint },
      cause: error,
    });
  }

  const responseRequestId = getResponseRequestId(response);
  const responseText = await response.text();
  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(responseText) as unknown;
  } catch {
    throw new LoomGraphQLRequestError({
      status: response.status,
      httpStatus: response.status,
      message: `Loom GraphQL returned non-JSON HTTP ${response.status}`,
      data: responseText,
      requestId: responseRequestId,
      retryable: isRetryableHttpStatus(response.status),
      meta: {
        endpoint,
        status: response.status,
        requestId: responseRequestId,
      },
    });
  }

  if (!isRecord(parsedPayload)) {
    throw new LoomGraphQLRequestError({
      status: response.ok ? 'CUSTOM_ERROR' : response.status,
      httpStatus: response.status,
      message: 'Loom GraphQL response did not contain a valid payload',
      data: parsedPayload,
      requestId: responseRequestId,
      retryable: isRetryableHttpStatus(response.status),
      meta: {
        endpoint,
        status: response.status,
        requestId: responseRequestId,
      },
    });
  }

  const payload = parsedPayload as LoomGraphQLResponse<T>;

  if (payload.errors?.length) {
    console.error('[Loom] GraphQL errors', payload.errors);
  }

  if (!response.ok || payload.errors?.length) {
    throw createGraphQLError({
      response,
      endpoint,
      payload,
      responseRequestId,
    });
  }
  if (payload.data === undefined) {
    throw new LoomGraphQLRequestError({
      status: 'CUSTOM_ERROR',
      httpStatus: response.status,
      message: 'Loom GraphQL response did not contain data',
      data: payload,
      requestId: responseRequestId,
      meta: {
        endpoint,
        status: response.status,
        requestId: responseRequestId,
      },
    });
  }

  return {
    data: payload.data,
    meta: {
      endpoint,
      status: response.status,
      requestId: responseRequestId,
    },
  };
};

export const fetchGraphQL = async <T>(
  request: LoomQueryArgs,
  options: LoomRequestOptions = {},
): Promise<T> => (await executeGraphQL<T>(request, options)).data;

export const fetchLoomGraphQL = async <T>(
  request: LoomQueryArgs,
  options: LoomRequestOptions = {},
): Promise<T> => fetchGraphQL<T>(request, options);

export const loomBaseQuery: BaseQueryFn<
  LoomQueryArgs,
  unknown,
  LoomApiError,
  // RTK uses {} as the default extra-options type for existing endpoints.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  {},
  LoomRequestMeta
> = async ({ query, variables }, api) => {
  const csrfToken = selectCSRFToken(api.getState() as CoreState);
  const endpoint = `${GEN3_LOOM_API}/graphql/flat`;
  try {
    const result = await executeGraphQL<unknown>(
      { query, variables },
      {
        endpoint,
        signal: api.signal,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      },
    );
    return {
      data: result.data,
      meta: result.meta,
    };
  } catch (error: unknown) {
    const requestError = error as LoomRequestError;
    const errorStatus = requestError.status ?? 'FETCH_ERROR';
    const retryable = requestError.retryable ?? !isAbortError(error);
    const meta = requestError.meta ?? {
      endpoint,
      status: requestError.httpStatus,
      requestId: requestError.requestId,
    };
    console.error('[Loom] Query failed', {
      operation:
        query.match(/\b(?:query|mutation)\s+([A-Za-z_][A-Za-z0-9_]*)/)?.[1] ??
        'anonymous',
      status: errorStatus,
      httpStatus: requestError.httpStatus,
      code: requestError.code,
      requestId: requestError.requestId,
      retryable,
      fieldPath: requestError.fieldPath,
      error: error instanceof Error ? error.message : String(error),
      data: requestError.data,
    });
    return {
      error: {
        status: errorStatus,
        httpStatus: requestError.httpStatus,
        data: requestError.data,
        code: requestError.code,
        requestId: requestError.requestId,
        retryable,
        fieldPath: requestError.fieldPath,
        error: error instanceof Error ? error.message : String(error),
      },
      meta,
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
