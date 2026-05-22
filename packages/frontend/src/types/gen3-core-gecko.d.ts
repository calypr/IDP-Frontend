import '@gen3/core';

declare module '@gen3/core' {
  export interface GeckoProjectRecord {
    readonly resourcePath: string;
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

  export interface GeckoGitRepositoryInstallationStatus {
    readonly installed: boolean;
    readonly installation_id?: number;
    readonly target?: string;
    readonly target_type?: string;
    readonly html_url?: string;
  }

  export interface GeckoGitOrganizationProjectStatus {
    readonly project_id: string;
    readonly project: string;
    readonly repository: GeckoGitRepositoryIdentity;
    readonly configured: boolean;
    readonly installation: GeckoGitRepositoryInstallationStatus;
  }

  export interface GeckoGitOrganizationStatus {
    readonly organization: string;
    readonly connected: boolean;
    readonly app_installed: boolean;
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

  export function useGetGeckoProjectsQuery(): {
    data?: Array<GeckoProjectRecord>;
    isLoading: boolean;
  };

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

  export function useRefreshGeckoGitProjectMutation(): [
    (args: {
      organization: string;
      project: string;
    }) => { unwrap: () => Promise<unknown> },
    { isLoading: boolean },
  ];
}
