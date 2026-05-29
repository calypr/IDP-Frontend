import '@gen3/core';

declare module '@gen3/core' {
  export interface CreateAuthzOwnedDescendantRequest {
    parent_path: string;
    name: string;
    template: string;
  }

  export interface DeleteAuthzResourceRequest {
    readonly resource_path: string;
  }

  export interface AuthzOwnershipBinding {
    readonly policy?: string;
    readonly resource?: string;
    readonly user?: string;
    readonly provenance?: Record<string, unknown>;
  }

  export interface AuthzOwnershipResponse {
    readonly created?: boolean;
    readonly resource_path?: string;
    readonly owner_policy?: string;
    readonly bindings?: Array<AuthzOwnershipBinding>;
  }

  export interface AuthzOwnerMutationRequest {
    readonly resource_path: string;
    readonly username: string;
  }

  export interface AuthzUserAccessMutationRequest {
    readonly resource_path: string;
    readonly username: string;
    readonly role_id?: string;
  }

  export interface AuthzAccessMutationEntry {
    readonly kind: string;
    readonly policy_id?: string;
    readonly role_id: string;
    readonly reason?: string;
  }

  export interface AuthzUserAccessMutationResponse {
    readonly resource_path: string;
    readonly username: string;
    readonly role_id: string;
    readonly granted?: Array<AuthzAccessMutationEntry>;
    readonly removed?: Array<AuthzAccessMutationEntry>;
    readonly not_removed?: Array<AuthzAccessMutationEntry>;
  }

  export interface AuthzOwnershipResourceRequest {
    readonly resource_path: string;
    readonly include_children?: boolean;
    readonly include_admins?: boolean;
  }

  export interface AuthzOwnershipResourceBinding {
    readonly resource_path: string;
    readonly subject_type: string;
    readonly subject_name: string;
    readonly kind: string;
    readonly role_id: string;
    readonly policy_id: string;
    readonly protected: boolean;
    readonly template_name: string;
    readonly created_by: string;
    readonly provenance?: Record<string, unknown>;
  }

  export interface AuthzOwnershipResourceResponse {
    readonly resource_path: string;
    readonly include_children: boolean;
    readonly include_admins?: boolean;
    readonly bindings: Array<AuthzOwnershipResourceBinding>;
  }

  export function useCreateAuthzOwnedDescendantMutation(): [
    (
      args: CreateAuthzOwnedDescendantRequest,
    ) => { unwrap: () => Promise<AuthzOwnershipResponse> },
    { isLoading: boolean },
  ];

  export function useDeleteAuthzResourceMutation(): [
    (args: DeleteAuthzResourceRequest) => { unwrap: () => Promise<void> },
  ];

  export function useGetAuthzOwnershipResourceQuery(
    args: AuthzOwnershipResourceRequest,
    options?: { skip?: boolean },
  ): {
    data?: AuthzOwnershipResourceResponse;
    error?: unknown;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useAddAuthzOwnerMutation(): [
    (
      args: AuthzOwnerMutationRequest,
    ) => { unwrap: () => Promise<AuthzOwnershipResponse> },
  ];

  export function useRemoveAuthzOwnerMutation(): [
    (
      args: AuthzOwnerMutationRequest,
    ) => { unwrap: () => Promise<void> },
  ];

  export function useAddAuthzUserAccessMutation(): [
    (
      args: AuthzUserAccessMutationRequest,
    ) => { unwrap: () => Promise<AuthzUserAccessMutationResponse> },
  ];

  export function useRemoveAuthzUserAccessMutation(): [
    (
      args: AuthzUserAccessMutationRequest,
    ) => { unwrap: () => Promise<AuthzUserAccessMutationResponse> },
  ];
}

export {};
