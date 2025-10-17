// api/explorerConfigApi.ts
import {
  createApi,
  BaseQueryFn,
  FetchArgs,
  fetchBaseQuery,
} from '@reduxjs/toolkit/query/react';
import { JSONObject } from '../../types';
import { CoreState } from '../../reducers';
import { selectCSRFToken } from '../user';
import { GEN3_API } from '../../constants';
import { getCookie } from 'cookies-next';
import type { Middleware, Reducer } from '@reduxjs/toolkit';

interface ConfigResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
}

export interface ConfiguratorAPI<H = JSONObject> {
  readonly data: H;
  readonly errors: Record<string, string>;
}

// Custom base query with state access for headers and cookies
const baseQuery: BaseQueryFn<FetchArgs, unknown, { error: string }> = async (
  args,
  api,
  extraOptions,
) => {
  // Get CSRF token from Redux state
  const csrfToken = selectCSRFToken(api.getState() as CoreState);

  // Get access token from cookies in development mode
  let accessToken: string | undefined;
  if (process.env.NODE_ENV === 'development') {
    accessToken = getCookie('credentials_token') as string | undefined;
  }

  // Define headers with conditional token inclusion
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
    ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
  };

  // Create base query with dynamic headers
  const baseQueryWithHeaders = fetchBaseQuery({
    baseUrl: `${GEN3_API}/ExplorerConfig`,
    prepareHeaders: (baseHeaders) => {
      Object.entries(headers).forEach(([key, value]) => {
        if (value) baseHeaders.set(key, value);
      });
      return baseHeaders;
    },
  });

  // Execute the query
  const result = await baseQueryWithHeaders(args, api, extraOptions);

  // Handle errors
  if (result.error) {
    return {
      error: {
        error: `Failed to fetch config: ${result.error.status}`,
      },
    };
  }

  return result;
};

/**
 * Creates an API slice for ExplorerConfig operations
 */
export const explorerConfigApi = createApi({
  reducerPath: 'explorerConfig',
  baseQuery, // Use the custom baseQuery with header/cookie handling
  refetchOnMountOrArgChange: true,
  endpoints: (builder) => ({
    getConfigList: builder.query<ConfigResponse, string>({
      query: () => ({
        url: '/list',
        method: 'GET',
      }),
      transformResponse: (response: ConfigResponse) => ({
        success: true,
        data: response,
      }),
      transformErrorResponse: (response) => ({
        success: false,
        error: response.error || 'Unknown error',
      }),
    }),
    getConfigContent: builder.query<ConfigResponse, string>({
      query: (name) => ({
        url: `/${name}`,
        method: 'GET',
      }),
      transformResponse: (response: ConfigResponse) => ({
        success: true,
        data: response,
      }),
      transformErrorResponse: (response) => ({
        success: false,
        error: response.error || 'Unknown error',
      }),
    }),

    updateConfigContent: builder.mutation<
      ApiResponse,
      { name: string; configData: JSONObject[] }
    >({
      query: ({ name, configData }) => ({
        url: `/${name}`,
        method: 'PUT',
        body: configData,
      }),
      transformResponse: () => ({
        success: true,
      }),
      transformErrorResponse: (response) => ({
        success: false,
        error: `Failed to post config: ${response.error}`,
      }),
    }),
  }),
});

// Export hooks for usage in components
export const {
  useGetConfigListQuery,
  useGetConfigContentQuery,
  useUpdateConfigContentMutation,
} = explorerConfigApi;

// Export reducer and middleware
export const explorerConfigReducer: Reducer =
  explorerConfigApi.reducer as Reducer;
export const explorerConfigMiddleware: Middleware =
  explorerConfigApi.middleware as Middleware;
export const explorerConfigReducerPath = explorerConfigApi.reducerPath;
