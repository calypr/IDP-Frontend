import { gen3Api } from '../gen3';
import { createSelector } from '@reduxjs/toolkit';
import {
  type AuthzMapping,
  AuthzOwnerMutationRequest,
  AuthzOwnershipResourceRequest,
  AuthzOwnershipResourceResponse,
  AuthzOwnershipResponse,
  AuthzResourceResponse,
  AuthzUserAccessMutationResponse,
  AuthzUserAccessMutationRequest,
  CreateAuthzResourceRequest,
  CreateAuthzResourceResponse,
  DeleteAuthzResourceRequest,
  type ServiceAndMethod,
} from './types';
import { GEN3_AUTHZ_API, GEN3_FENCE_API } from '../../constants';
import { userAuthApi, selectUserDetailsFromState } from '../user/userSliceRTK';
import type { CoreState } from '../../reducers';

const TAGS = 'authz';

interface FenceUserAuthzResponse {
  readonly authz?: AuthzMapping;
  readonly project_access?: Record<string, Array<string | ServiceAndMethod>>;
}

const isServiceAndMethod = (value: unknown): value is ServiceAndMethod => {
  if (typeof value !== 'object' || value === null) return false;

  const action = value as Partial<ServiceAndMethod>;
  return (
    typeof action.method === 'string' && typeof action.service === 'string'
  );
};

const normalizeFenceAuthzMapping = (
  mapping:
    | AuthzMapping
    | Record<string, Array<string | ServiceAndMethod>>
    | undefined,
): AuthzMapping => {
  if (!mapping) return {};

  return Object.fromEntries(
    Object.entries(mapping).map(([resourcePath, actions]) => [
      resourcePath,
      Array.isArray(actions)
        ? actions.flatMap((action) => {
            if (typeof action === 'string')
              return [{ method: action, service: '*' }];
            if (isServiceAndMethod(action)) return [action];
            return [];
          })
        : [],
    ]),
  );
};

export const authzTags = gen3Api.enhanceEndpoints({
  addTagTypes: [TAGS],
});

/**
 * Creates the authzApi for ownership mutations and checking Fence authz snapshots.
 * Read-side authz mappings intentionally come from Fence /user/user so consumers
 * use Fence's invalidation-aware cache instead of calling Arborist directly.
 * @see https://github.com/uc-cdis/arborist/blob/master/docs/relationships.simplified.png
 * @returns: A response dict of user permissions {method, service} for each resource path.
 */
export const authzApi = authzTags.injectEndpoints({
  endpoints: (builder) => ({
    getAuthzMappings: builder.query<AuthzMapping, void>({
      providesTags: [TAGS],
      async queryFn(_arg, api, _extraOptions, baseQuery) {
        const userDetailsState = selectUserDetailsFromState(
          api.getState() as CoreState,
        );

        const cachedUser = userDetailsState?.data?.data;
        if (cachedUser) {
          return {
            data: normalizeFenceAuthzMapping(
              cachedUser.authz ?? cachedUser.project_access,
            ),
          };
        }

        const userResult = await api.dispatch(
          userAuthApi.endpoints.fetchUserDetails.initiate(undefined, {
            forceRefetch: false,
          }),
        );

        try {
          if ('data' in userResult && userResult.data?.data) {
            return {
              data: normalizeFenceAuthzMapping(
                userResult.data.data.authz ??
                  userResult.data.data.project_access,
              ),
            };
          }
        } finally {
          const unsubscribe =
            'unsubscribe' in userResult ? userResult.unsubscribe : undefined;
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        }

        const response = await baseQuery({
          url: `${GEN3_FENCE_API}/user`,
          method: 'GET',
          credentials: 'include',
        });

        if (response.error) {
          return { error: response.error };
        }

        const fenceResponse = response.data as FenceUserAuthzResponse;
        return {
          data: normalizeFenceAuthzMapping(
            fenceResponse.authz ?? fenceResponse.project_access,
          ),
        };
      },
    }),
    getAuthzResources: builder.query<AuthzResourceResponse, void>({
      query: () => ({
        url: `${GEN3_AUTHZ_API}/resources`,
        method: 'GET',
      }),
    }),
    getAuthzOwnershipResource: builder.query<
      AuthzOwnershipResourceResponse,
      AuthzOwnershipResourceRequest
    >({
      providesTags: [TAGS],
      query: ({
        resource_path,
        include_children = false,
        include_admins,
      }) => ({
        url: `${GEN3_AUTHZ_API}/ownership/resource`,
        method: 'GET',
        params: {
          resource_path,
          include_children,
          ...(include_admins === undefined ? {} : { include_admins }),
        },
      }),
    }),
    createAuthzResource: builder.mutation<
      CreateAuthzResourceResponse,
      CreateAuthzResourceRequest
    >({
      query: (request) => ({
        // url: `${GEN3_AUTHZ_API}/resources/${request.resourcePath}${request?.path ? `&p=${request.path}` : ''}`,
        url: `${GEN3_AUTHZ_API}/resources`,
        method: 'POST',
        body: request.data,
      }),
      invalidatesTags: [TAGS],
    }),
    deleteAuthzResource: builder.mutation<void, DeleteAuthzResourceRequest>({
      invalidatesTags: [TAGS],
      query: ({ resource_path }) => ({
        method: 'DELETE',
        params: { resource_path },
        url: `${GEN3_AUTHZ_API}/ownership/resource`,
      }),
    }),
    addAuthzOwner: builder.mutation<
      AuthzOwnershipResponse,
      AuthzOwnerMutationRequest
    >({
      invalidatesTags: (_result, error) => (error ? [] : [TAGS]),
      query: (request) => ({
        body: request,
        method: 'POST',
        url: `${GEN3_AUTHZ_API}/ownership/owner`,
      }),
    }),
    removeAuthzOwner: builder.mutation<void, AuthzOwnerMutationRequest>({
      invalidatesTags: (_result, error) => (error ? [] : [TAGS]),
      query: (request) => ({
        body: request,
        method: 'DELETE',
        url: `${GEN3_AUTHZ_API}/ownership/owner`,
      }),
    }),
    addAuthzOwnershipUserAccess: builder.mutation<
      AuthzOwnershipResponse,
      AuthzUserAccessMutationRequest
    >({
      invalidatesTags: (_result, error) => (error ? [] : [TAGS]),
      query: (request) => ({
        body: request,
        method: 'POST',
        url: `${GEN3_AUTHZ_API}/ownership/user`,
      }),
    }),
    removeAuthzOwnershipUserAccess: builder.mutation<
      void,
      AuthzUserAccessMutationRequest
    >({
      invalidatesTags: (_result, error) => (error ? [] : [TAGS]),
      query: (request) => ({
        body: request,
        method: 'DELETE',
        url: `${GEN3_AUTHZ_API}/ownership/user`,
      }),
    }),
    addAuthzUserAccess: builder.mutation<
      AuthzUserAccessMutationResponse,
      AuthzUserAccessMutationRequest
    >({
      invalidatesTags: [TAGS],
      query: (request) => ({
        body: request,
        method: 'POST',
        url: `${GEN3_AUTHZ_API}/access/user`,
      }),
    }),
    removeAuthzUserAccess: builder.mutation<
      AuthzUserAccessMutationResponse,
      AuthzUserAccessMutationRequest
    >({
      invalidatesTags: [TAGS],
      query: (request) => ({
        body: request,
        method: 'DELETE',
        url: `${GEN3_AUTHZ_API}/access/user`,
      }),
    }),
  }),
});

export const {
  useGetAuthzMappingsQuery,
  useLazyGetAuthzMappingsQuery,
  useGetAuthzResourcesQuery,
  useGetAuthzOwnershipResourceQuery,
  useLazyGetAuthzResourcesQuery,
  useCreateAuthzResourceMutation,
  useDeleteAuthzResourceMutation,
  useAddAuthzOwnerMutation,
  useRemoveAuthzOwnerMutation,
  useAddAuthzOwnershipUserAccessMutation,
  useRemoveAuthzOwnershipUserAccessMutation,
  useAddAuthzUserAccessMutation,
  useRemoveAuthzUserAccessMutation,
} = authzApi;

export const selectAuthzMapping = authzApi.endpoints.getAuthzMappings.select();

export const selectAuthzMappingData = createSelector(
  selectAuthzMapping,
  (authzMapping) => authzMapping?.data ?? { mappings: [] },
);
