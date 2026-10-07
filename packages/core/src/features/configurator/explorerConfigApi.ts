import { JSONObject } from '../../types';
import type { Middleware, Reducer } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { gen3Api } from '../gen3';
import { CALYPR_EXPLORER_CONFIG_API } from '../../constants';

interface ConfigResponse {
  success: boolean;
  data: any; // Relaxed to handle ["test"] or other structures
  error?: string;
}

export interface ApiResponse {
  success: boolean;
  error?: string;
}

const taggedExplorerApi = gen3Api.enhanceEndpoints({
  addTagTypes: ['ExplorerConfigs'],
});

export const explorerConfigApi = taggedExplorerApi.injectEndpoints({
  endpoints: (builder) => ({
    getConfigList: builder.query<ConfigResponse, void>({
      providesTags: [{ type: 'ExplorerConfigs', id: 'LIST' }],
      query: () => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/explorer/list`,
        method: 'GET',
      }),
      transformResponse: (response: string[]) => ({
        success: true,
        data: response, // Directly use the array ["test"]
      }),
      transformErrorResponse: (response: FetchBaseQueryError) => {
        const errorData = response.data as { error?: string } | undefined;
        return {
          success: false,
          error:
            errorData?.error || `Unknown error (Status: ${response.status})`,
        };
      },
    }),
    getConfigContent: builder.query<ConfigResponse, string>({
      providesTags: (_result, _error, name) => [
        { type: 'ExplorerConfigs', id: name },
      ],
      query: (name) => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/explorer/${name}`,
        method: 'GET',
      }),
      transformResponse: (response: any) => ({
        success: true,
        data: response,
      }),
      transformErrorResponse: (response: FetchBaseQueryError) => {
        const errorData = response.data as { error?: string } | undefined;
        return {
          success: false,
          error:
            errorData?.error || `Unknown error (Status: ${response.status})`,
        };
      },
    }),
    updateConfigContent: builder.mutation<
      ApiResponse,
      { name: string; configData: JSONObject }
    >({
      invalidatesTags: (_result, _error, { name }) => [
        { type: 'ExplorerConfigs', id: 'LIST' },
        { type: 'ExplorerConfigs', id: name },
      ],
      query: ({ name, configData }) => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/explorer/${name}`,
        method: 'PUT',
        body: configData,
      }),
      transformResponse: () => ({
        success: true,
      }),
      transformErrorResponse: (response: FetchBaseQueryError) => {
        const errorData = response.data as { error?: string } | undefined;
        return {
          success: false,
          error: `Failed to post config: ${errorData?.error || `Status: ${response.status}`}`,
        };
      },
    }),
  }),
});

export const {
  useGetConfigListQuery,
  useGetConfigContentQuery,
  useUpdateConfigContentMutation,
} = explorerConfigApi;

export const explorerConfigReducerPath = explorerConfigApi.reducerPath;
export const explorerConfigReducer: Reducer =
  explorerConfigApi.reducer as Reducer;
export const explorerConfigMiddleware: Middleware =
  explorerConfigApi.middleware as Middleware;
