import '@gen3/core';

declare module '@gen3/core' {
  export interface GeckoProjectRecord {
    readonly resourcePath: string;
    readonly configData?: GeckoProjectConfig;
    readonly organization?: string;
    readonly project?: string;
    readonly title?: string;
    readonly contact_email?: string;
    readonly description?: string;
    readonly thumbnail_url?: string;
  }

  export interface GeckoProjectSummaryRecord {
    readonly organization: string;
    readonly project: string;
    readonly title: string;
    readonly contact_email: string;
    readonly description: string;
    readonly thumbnail_url?: string;
  }

  export interface GeckoProjectConfig {
    readonly title: string;
    readonly contact_email: string;
    readonly src_repo: string;
    readonly org_title: string;
    readonly description: string;
    readonly project_title: string;
    readonly icon_name?: string;
  }

  export interface GeckoMutationResponse {
    readonly success: boolean;
    readonly configured?: boolean;
    readonly error?: string;
  }

  export interface GeckoProjectStorageIntent {
    readonly bucket: string;
    readonly provider: string;
    readonly endpoint?: string;
    readonly region?: string;
    readonly access_key?: string;
    readonly secret_key?: string;
    readonly organization: string;
    readonly project_id: string;
    readonly path?: string;
    readonly path_prefix?: string;
    readonly organization_sub_path?: string;
    readonly project_sub_path?: string;
  }

  export interface GeckoDeleteProjectMutationArgs {
    readonly organization: string;
    readonly project: string;
  }

  export interface GeckoUpdateProjectStorageMutationArgs {
    readonly organization: string;
    readonly project: string;
    readonly storage: GeckoProjectStorageIntent;
  }

  export interface GeckoProjectThumbnail {
    readonly data_url: string;
    readonly content_type: string;
  }

  export interface GeckoUploadProjectThumbnailMutationArgs {
    readonly organization: string;
    readonly project: string;
    readonly file: File;
  }

  export interface GeckoDeleteProjectThumbnailMutationArgs {
    readonly organization: string;
    readonly project: string;
  }

  export interface GeckoDeleteOrganizationMutationArgs {
    readonly organization: string;
  }

  export interface GeckoUpdateProjectMutationArgs {
    readonly organization: string;
    readonly project: string;
    readonly configData: GeckoProjectConfig;
  }

  export interface GeckoGitRepositoryIdentity {
    readonly host: string;
    readonly owner: string;
    readonly repo: string;
    readonly url: string;
  }

  export interface GeckoGitProjectStatus {
    readonly project_id: string;
    readonly organization: string;
    readonly project: string;
    readonly resource_path: string;
    readonly config: {
      readonly title: string;
      readonly contact_email: string;
      readonly src_repo: string;
      readonly org_title: string;
      readonly description: string;
      readonly project_title: string;
      readonly icon_name: string;
    };
    readonly repository: GeckoGitRepositoryIdentity;
    readonly installation_state: string;
    readonly installation_id?: number;
    readonly installation_target?: string;
    readonly installation_target_type?: string;
    readonly organization_app_installed: boolean;
    readonly organization_html_url?: string;
    readonly organization_repository_selection?: string;
    readonly sync_state: string;
    readonly default_branch?: string;
    readonly last_refreshed_at?: string;
    readonly last_error?: string;
    readonly mirror_ready: boolean;
  }

  export interface GeckoGitInstallationRepository {
    readonly id: number;
    readonly name: string;
    readonly full_name: string;
    readonly html_url: string;
    readonly clone_url: string;
  }

  export interface GeckoGitOrganizationConnectResponse {
    readonly mode: 'redirect' | 'select_repository';
    readonly redirect_url?: string;
    readonly installation_id?: number;
    readonly repositories?: Array<GeckoGitInstallationRepository>;
  }

  export interface GeckoGitRepositoryInstallationStatus {
    readonly installed: boolean;
    readonly installation_id?: number;
    readonly target?: string;
    readonly target_type?: string;
    readonly html_url?: string;
    readonly repository_selection?: string;
  }

  export interface GeckoGitOrganizationProjectStatus {
    readonly project_id: string;
    readonly project: string;
    readonly resource_path?: string;
    readonly repository: GeckoGitRepositoryIdentity;
    readonly configured: boolean;
    readonly accessible?: boolean;
    readonly can_manage_settings?: boolean;
    readonly request_access?: boolean;
    readonly request_access_resource_path?: string;
    readonly integrations?: {
      readonly github: {
        readonly pass: boolean;
        readonly reason?: string;
        readonly details?: string;
      };
      readonly storage: {
        readonly pass: boolean;
        readonly reason?: string;
        readonly details?: string;
      };
    };
    readonly installation: GeckoGitRepositoryInstallationStatus;
  }

  export interface GeckoGitOrganizationStatus {
    readonly organization: string;
    readonly connected: boolean;
    readonly app_installed: boolean;
    readonly can_access_settings?: boolean;
    readonly can_create_projects?: boolean;
    readonly can_manage_people?: boolean;
    readonly can_delete_org?: boolean;
    readonly installation_id?: number;
    readonly html_url?: string;
    readonly repository_selection?: string;
    readonly configuration_state: string;
    readonly connected_projects: number;
    readonly configured_projects: number;
    readonly total_projects: number;
    readonly projects: Array<GeckoGitOrganizationProjectStatus>;
  }

  export interface GeckoGitOrganizationsStatus {
    readonly connected: boolean;
    readonly app_installed: boolean;
    readonly connected_organizations: number;
    readonly installed_organizations: number;
    readonly total_organizations: number;
    readonly connected_projects: number;
    readonly configured_projects: number;
    readonly total_projects: number;
    readonly configuration_state: string;
    readonly organizations: Array<GeckoGitOrganizationStatus>;
  }

  export interface GeckoGitRef {
    readonly name: string;
    readonly type: string;
    readonly hash: string;
    readonly default: boolean;
  }

  export interface GeckoGitLFSPointerInfo {
    readonly version: string;
    readonly oid: string;
    readonly size: number;
  }

  export interface GeckoGitTreeEntry {
    readonly name: string;
    readonly path: string;
    readonly type: string;
    readonly hash: string;
    readonly size?: number;
    readonly last_modified_at?: string;
    readonly lfs_pointer?: GeckoGitLFSPointerInfo;
  }

  export interface GeckoGitTreeResponse {
    readonly project_id: string;
    readonly ref: string;
    readonly path: string;
    readonly entries: Array<GeckoGitTreeEntry>;
  }

  export interface GeckoGitFileResponse {
    readonly project_id: string;
    readonly ref: string;
    readonly path: string;
    readonly name: string;
    readonly hash: string;
    readonly size: number;
    readonly html_url?: string;
    readonly download_url?: string;
    readonly lfs_pointer?: GeckoGitLFSPointerInfo;
  }

  export interface GeckoGitUploadSessionFileManifest {
    readonly name: string;
    readonly size: number;
  }

  export interface GeckoGitUploadSessionCreateRequest {
    readonly base_branch: string;
    readonly target_subdirectory?: string;
    readonly files: Array<GeckoGitUploadSessionFileManifest>;
  }

  export interface GeckoGitUploadSessionFileAttachment {
    readonly file_name: string;
    readonly target_path: string;
    readonly checksum: string;
    readonly drs_object_id: string;
    readonly size: number;
  }

  export interface GeckoGitUploadSessionAttachFilesRequest {
    readonly files: Array<GeckoGitUploadSessionFileAttachment>;
  }

  export interface GeckoGitUploadSessionFinalizeRequest {
    readonly pr_title?: string;
    readonly pr_body?: string;
  }

  export interface GeckoGitUploadSessionFileStatus {
    readonly file_name: string;
    readonly target_path: string;
    readonly size: number;
    readonly checksum?: string;
    readonly drs_object_id?: string;
    readonly status: string;
    readonly error?: string;
    readonly collision: boolean;
  }

  export interface GeckoGitUploadSessionResponse {
    readonly session_id: string;
    readonly project_id: string;
    readonly base_branch: string;
    readonly target_subdirectory?: string;
    readonly branch_name: string;
    readonly pr_title: string;
    readonly pr_body: string;
    readonly status: string;
    readonly pull_request_url?: string;
    readonly commit_sha?: string;
    readonly files: Array<GeckoGitUploadSessionFileStatus>;
    readonly has_conflicts: boolean;
  }

  export function useGetGeckoProjectsQuery(): {
    data?: Array<GeckoProjectRecord>;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useGetGeckoProjectSummaryQuery(): {
    data?: Array<GeckoProjectSummaryRecord>;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useGetGeckoGitProjectsQuery(): {
    data?: Array<GeckoGitProjectStatus>;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useCreateGeckoProjectMutation(): [
    (args: {
      configData: GeckoProjectConfig;
      organization: string;
      project: string;
      storage?: GeckoProjectStorageIntent;
    }) => { unwrap: () => Promise<GeckoMutationResponse> },
    { isLoading: boolean },
  ];

  export function useUpdateGeckoProjectMutation(): [
    (args: GeckoUpdateProjectMutationArgs) => {
      unwrap: () => Promise<GeckoMutationResponse>;
    },
    { isLoading: boolean },
  ];

  export function useUpdateGeckoProjectStorageMutation(): [
    (args: GeckoUpdateProjectStorageMutationArgs) => {
      unwrap: () => Promise<GeckoMutationResponse>;
    },
    { isLoading: boolean },
  ];

  export function useGetGeckoProjectThumbnailQuery(
    args: { organization: string; project: string },
    options?: { skip?: boolean },
  ): {
    data?: GeckoProjectThumbnail | null;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useUploadGeckoProjectThumbnailMutation(): [
    (args: GeckoUploadProjectThumbnailMutationArgs) => {
      unwrap: () => Promise<GeckoMutationResponse>;
    },
    { isLoading: boolean },
  ];

  export function useDeleteGeckoProjectThumbnailMutation(): [
    (args: GeckoDeleteProjectThumbnailMutationArgs) => {
      unwrap: () => Promise<GeckoMutationResponse>;
    },
    { isLoading: boolean },
  ];

  export function useDeleteGeckoProjectMutation(): [
    (args: GeckoDeleteProjectMutationArgs) => {
      unwrap: () => Promise<GeckoMutationResponse>;
    },
    { isLoading: boolean },
  ];

  export function useDeleteGeckoOrganizationMutation(): [
    (args: GeckoDeleteOrganizationMutationArgs) => {
      unwrap: () => Promise<GeckoMutationResponse>;
    },
    { isLoading: boolean },
  ];

  export function useGetGeckoGitProjectStatusQuery(
    args: { organization: string; project: string },
    options?: { skip?: boolean },
  ): {
    data?: GeckoGitProjectStatus;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useGetGeckoGitOrganizationStatusQuery(
    args: { organization: string },
    options?: { skip?: boolean },
  ): {
    data?: GeckoGitOrganizationStatus;
    isLoading: boolean;
  };

  export function useGetGeckoGitOrganizationsStatusQuery(
    args?: void,
    options?: { skip?: boolean },
  ): {
    data?: GeckoGitOrganizationsStatus;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useReconcileGeckoGitOrganizationsMutation(): [
    () => { unwrap: () => Promise<unknown> },
    { isLoading: boolean },
  ];

  export function useReconcileGeckoGitOrganizationMutation(): [
    (args: { organization: string }) => { unwrap: () => Promise<unknown> },
    { isLoading: boolean },
  ];

  export function useGetGeckoGitProjectRefsQuery(
    args: { organization: string; project: string },
    options?: { skip?: boolean },
  ): {
    data?: { default_branch?: string; refs: Array<GeckoGitRef> };
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useGetGeckoGitProjectTreeQuery(
    args: {
      organization: string;
      project: string;
      path?: string;
      ref?: string;
    },
    options?: { skip?: boolean },
  ): {
    data?: GeckoGitTreeResponse;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useGetGeckoGitProjectFileQuery(
    args: {
      organization: string;
      project: string;
      path: string;
      ref?: string;
    },
    options?: { skip?: boolean },
  ): {
    data?: GeckoGitFileResponse;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useLazyGetGeckoGitProjectFileQuery(): [
    (args: {
      organization: string;
      project: string;
      path: string;
      ref?: string;
    }) => { unwrap: () => Promise<GeckoGitFileResponse> },
    { isLoading: boolean },
  ];

  export function useCreateGeckoGitUploadSessionMutation(): [
    (args: {
      organization: string;
      project: string;
      body: GeckoGitUploadSessionCreateRequest;
    }) => { unwrap: () => Promise<GeckoGitUploadSessionResponse> },
    { isLoading: boolean },
  ];

  export function useGetGeckoGitUploadSessionQuery(
    args: {
      organization: string;
      project: string;
      sessionID: string;
    },
    options?: { skip?: boolean },
  ): {
    data?: GeckoGitUploadSessionResponse;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };

  export function useAttachGeckoGitUploadSessionFilesMutation(): [
    (args: {
      organization: string;
      project: string;
      sessionID: string;
      body: GeckoGitUploadSessionAttachFilesRequest;
    }) => { unwrap: () => Promise<GeckoGitUploadSessionResponse> },
    { isLoading: boolean },
  ];

  export function useFinalizeGeckoGitUploadSessionMutation(): [
    (args: {
      organization: string;
      project: string;
      sessionID: string;
      body: GeckoGitUploadSessionFinalizeRequest;
    }) => { unwrap: () => Promise<GeckoGitUploadSessionResponse> },
    { isLoading: boolean },
  ];

  export function useRefreshGeckoGitProjectMutation(): [
    (args: { organization: string; project: string }) => {
      unwrap: () => Promise<unknown>;
    },
    { isLoading: boolean },
  ];
}
