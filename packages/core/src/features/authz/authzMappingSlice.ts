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
  CreateAuthzOwnedDescendantRequest,
  DeleteAuthzResourceRequest,
} from './types';
import { GEN3_AUTHZ_API } from '../../constants';

const TAGS = 'authz';

export const authzTags = gen3Api.enhanceEndpoints({
  addTagTypes: [TAGS],
});

/**
 * Creates the authzApi for checking arborist permissions for a selected user
 * @see https://petstore.swagger.io/?url=https://raw.githubusercontent.com/uc-cdis/arborist/master/docs/openapi.yaml#/auth/get_auth_mapping
 * @see https://github.com/uc-cdis/arborist/blob/master/docs/relationships.simplified.png
 * @returns: An arborist response dict of user permissions {method, service} for each resource path.
 */
export const authzApi = authzTags.injectEndpoints({
  endpoints: (builder) => ({
    getAuthzMappings: builder.query<AuthzMapping, void>({
      query: () => `${GEN3_AUTHZ_API}/mapping`,
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
    createAuthzOwnedDescendant: builder.mutation<
      AuthzOwnershipResponse,
      CreateAuthzOwnedDescendantRequest
    >({
      invalidatesTags: (_result, error) => (error ? [] : [TAGS]),
      query: (request) => ({
        body: request,
        method: 'POST',
        url: `${GEN3_AUTHZ_API}/ownership/descendant`,
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
  useCreateAuthzOwnedDescendantMutation,
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
