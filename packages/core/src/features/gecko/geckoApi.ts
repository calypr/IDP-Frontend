import type { Middleware, Reducer } from '@reduxjs/toolkit';
import { CALYPR_EXPLORER_CONFIG_API } from '../../constants';
import { resourcePathFromProjectID } from '../submission/authMappingUtils';
import { gen3Api } from '../gen3';

export interface GeckoProjectRecord {
  readonly resourcePath: string;
}

export interface GeckoProjectConfig {
  readonly title: string;
  readonly contact_email: string;
  readonly src_repo: string;
  readonly org_title: string;
  readonly description: string;
  readonly project_title: string;
  readonly icon_name: string;
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

export interface GeckoCreateProjectMutationArgs {
  readonly configData: GeckoProjectConfig;
  readonly organization: string;
  readonly project: string;
  readonly pendingRepoID?: string;
  readonly storage?: GeckoProjectStorageIntent;
}

export interface GeckoDeleteProjectMutationArgs {
  readonly organization: string;
  readonly project: string;
}

const geckoErrorMessage = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object') {
    return typeof data === 'string' ? data : undefined;
  }
  const error = (data as { error?: unknown }).error;
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') {
      return message;
    }
  }
  const message = (data as { message?: unknown }).message;
  return typeof message === 'string' ? message : undefined;
};

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
  readonly config: GeckoProjectConfig;
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

export interface GeckoGitOrganizationConnectResponse {
  readonly redirect_url: string;
  readonly setup_session_id?: string;
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

export interface GeckoGitPendingRepository {
  readonly id: string;
  readonly installation_id: number;
  readonly setup_session_id?: string;
  readonly created_by_user_id?: string;
  readonly organization: string;
  readonly repo_id: number;
  readonly repo_name: string;
  readonly repo_full_name: string;
  readonly repo_html_url?: string;
  readonly repo_clone_url?: string;
  readonly repo_host: string;
  readonly repo_owner: string;
  readonly repo_path: string;
  readonly added_at: string;
}

export interface GeckoGitPendingRepositoriesResponse {
  readonly installation_id?: number;
  readonly setup_session_id?: string;
  readonly pending: Array<GeckoGitPendingRepository>;
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

export interface GeckoGitRefreshResponse {
  readonly success: boolean;
  readonly project_id: string;
  readonly sync_state: string;
  readonly default_branch?: string;
  readonly last_fetched_ref?: string;
  readonly error?: string;
}

export type GeckoGitOrganizationsReconcileResponse =
  GeckoGitOrganizationsStatus;

export type GeckoGitOrganizationReconcileResponse = GeckoGitOrganizationStatus;

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

export interface GeckoGitRefsResponse {
  readonly project_id: string;
  readonly default_branch?: string;
  readonly refs: Array<GeckoGitRef>;
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

const buildOrganizationProjectResourcePath = (
  organization: string,
  project: string,
): string => `/programs/${organization}/projects/${project}`;

const buildGitProjectApiPath = (
  organization: string,
  project: string,
  suffix = '',
): string => {
  const base = `/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}`;
  return suffix ? `${base}${suffix}` : base;
};

const toProjectScopedResourcePath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const parsedUrl = new URL(trimmed);
    const pathSegments = parsedUrl.pathname
      .split('/')
      .map((segment) => decodeURIComponent(segment).trim())
      .filter(Boolean);

    if (
      pathSegments.length >= 4 &&
      pathSegments[0] === 'programs' &&
      pathSegments[2] === 'projects'
    ) {
      return buildOrganizationProjectResourcePath(
        pathSegments[1],
        pathSegments[3].replace(/\.git$/i, ''),
      );
    }
  } catch {
    // Fall through to the non-URL shapes below.
  }

  const slashSeparated = trimmed
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (slashSeparated.length === 2) {
    return buildOrganizationProjectResourcePath(
      slashSeparated[0],
      slashSeparated[1],
    );
  }

  return resourcePathFromProjectID(trimmed);
};

export const normalizeGeckoProjectRecord = (
  value: unknown,
): GeckoProjectRecord | null => {
  if (typeof value === 'string') {
    const resourcePath = toProjectScopedResourcePath(value);
    return resourcePath ? { resourcePath } : null;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    id?: unknown;
    projectId?: unknown;
    resourcePath?: unknown;
  };

  if (typeof candidate.resourcePath === 'string' && candidate.resourcePath) {
    const resourcePath = toProjectScopedResourcePath(candidate.resourcePath);
    return resourcePath ? { resourcePath } : null;
  }

  if (typeof candidate.projectId === 'string' && candidate.projectId) {
    const resourcePath = toProjectScopedResourcePath(candidate.projectId);
    return resourcePath ? { resourcePath } : null;
  }

  if (typeof candidate.id === 'string' && candidate.id) {
    const resourcePath = toProjectScopedResourcePath(candidate.id);
    return resourcePath ? { resourcePath } : null;
  }

  return null;
};

const geckoTaggedApi = gen3Api.enhanceEndpoints({
  addTagTypes: ['GeckoProjects', 'GeckoGitProjects'],
});

export const geckoApi = geckoTaggedApi.injectEndpoints({
  endpoints: (builder) => ({
    getGeckoProjects: builder.query<Array<GeckoProjectRecord>, void>({
      providesTags: ['GeckoProjects'],
      query: () => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/projects/list`,
        method: 'GET',
        credentials: 'include',
      }),
      transformResponse: (response: Array<unknown>) =>
        Array.isArray(response)
          ? response
              .map(normalizeGeckoProjectRecord)
              .filter(
                (record): record is GeckoProjectRecord => record !== null,
              )
          : [],
    }),
    createGeckoProject: builder.mutation<
      GeckoMutationResponse,
      GeckoCreateProjectMutationArgs
    >({
      query: ({ configData, organization, project, pendingRepoID, storage }) => ({
        url: `/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/setup`,
        method: 'PUT',
        body: {
          config: configData,
          pending_repo_id: pendingRepoID,
          storage,
        },
        credentials: 'include',
      }),
      transformResponse: (response: { configured?: boolean; readiness?: { git?: { details?: string; reason?: string }; syfon?: { details?: string; reason?: string }; config?: { details?: string; reason?: string } } }) => {
        const configured = response?.configured === true;
        let error: string | undefined;
        if (!configured) {
          const reasons = [
            response?.readiness?.config?.details || response?.readiness?.config?.reason,
            response?.readiness?.git?.details || response?.readiness?.git?.reason,
            response?.readiness?.syfon?.details || response?.readiness?.syfon?.reason,
          ]
            .filter((value): value is string => Boolean(value))
            .filter((value, index, all) => all.indexOf(value) === index);
          error = reasons.length > 0 ? reasons.join(' | ') : 'Project setup incomplete';
        }
        return {
          success: configured,
          configured,
          error,
        };
      },
      transformErrorResponse: (response) => {
        return {
          success: false,
          error:
            geckoErrorMessage(response.data) ||
            `Failed to create project (Status: ${response.status})`,
        };
      },
    }),
    deleteGeckoProject: builder.mutation<
      GeckoMutationResponse,
      GeckoDeleteProjectMutationArgs
    >({
      invalidatesTags: ['GeckoProjects', 'GeckoGitProjects'],
      query: ({ organization, project }) => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}`,
        method: 'DELETE',
        credentials: 'include',
      }),
      transformResponse: () => ({
        success: true,
      }),
      transformErrorResponse: (response) => {
        return {
          success: false,
          error:
            geckoErrorMessage(response.data) ||
            `Failed to delete project (Status: ${response.status})`,
        };
      },
    }),
    deleteGeckoOrganization: builder.mutation<
      GeckoMutationResponse,
      { organization: string }
    >({
      invalidatesTags: ['GeckoProjects', 'GeckoGitProjects'],
      query: ({ organization }) => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/projects/${encodeURIComponent(organization)}`,
        method: 'DELETE',
        credentials: 'include',
      }),
      transformResponse: () => ({
        success: true,
      }),
      transformErrorResponse: (response) => {
        return {
          success: false,
          error:
            geckoErrorMessage(response.data) ||
            `Failed to delete organization (Status: ${response.status})`,
        };
      },
    }),
    getGeckoGitProjects: builder.query<Array<GeckoGitProjectStatus>, void>({
      providesTags: ['GeckoGitProjects'],
      query: () => ({
        url: '/gecko/git/projects',
        method: 'GET',
        credentials: 'include',
      }),
    }),
    getGeckoGitOrganizationStatus: builder.query<
      GeckoGitOrganizationStatus,
      { organization: string }
    >({
      query: ({ organization }) => ({
        url: `/gecko/git/organizations/${encodeURIComponent(organization)}/status`,
        method: 'GET',
        credentials: 'include',
      }),
    }),
    getGeckoGitOrganizationsStatus: builder.query<
      GeckoGitOrganizationsStatus,
      void
    >({
      query: () => ({
        url: '/gecko/git/organizations/status',
        method: 'GET',
        credentials: 'include',
      }),
    }),
    getGeckoGitPendingRepositories: builder.query<
      GeckoGitPendingRepositoriesResponse,
      { installationID?: number; setupSessionID?: string } | void
    >({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.installationID) {
          params.set('installation_id', String(args.installationID));
        }
        if (args?.setupSessionID) {
          params.set('setup_session_id', args.setupSessionID);
        }
        return {
          url: `/gecko/git/pending${params.toString() ? `?${params.toString()}` : ''}`,
          method: 'GET',
          credentials: 'include',
        };
      },
    }),
    reconcileGeckoGitPendingRepositories: builder.mutation<
      GeckoGitPendingRepositoriesResponse,
      { installationID: number; setupSessionID?: string }
    >({
      query: ({ installationID, setupSessionID }) => ({
        url: '/gecko/git/pending/reconcile',
        method: 'POST',
        body: {
          installation_id: installationID,
          setup_session_id: setupSessionID,
        },
        credentials: 'include',
      }),
    }),
    reconcileGeckoGitOrganizations: builder.mutation<
      GeckoGitOrganizationsReconcileResponse,
      void
    >({
      query: () => ({
        url: '/gecko/git/organizations/reconcile',
        method: 'POST',
        credentials: 'include',
      }),
    }),
    reconcileGeckoGitOrganization: builder.mutation<
      GeckoGitOrganizationReconcileResponse,
      { organization: string }
    >({
      query: ({ organization }) => ({
        url: `/gecko/git/organizations/${encodeURIComponent(organization)}/reconcile`,
        method: 'POST',
        credentials: 'include',
      }),
    }),
    getGeckoGitProjectStatus: builder.query<
      GeckoGitProjectStatus,
      { organization: string; project: string }
    >({
      query: ({ organization, project }) => ({
        url: buildGitProjectApiPath(organization, project),
        method: 'GET',
        credentials: 'include',
      }),
    }),
    connectGeckoGitOrganization: builder.mutation<
      GeckoGitOrganizationConnectResponse,
      { organization: string; redirectPath?: string }
    >({
      query: ({ organization, redirectPath }) => ({
        url: `/gecko/git/organizations/${encodeURIComponent(organization)}/connect`,
        method: 'POST',
        body: redirectPath ? { redirect_path: redirectPath } : undefined,
        credentials: 'include',
      }),
    }),
    refreshGeckoGitProject: builder.mutation<
      GeckoGitRefreshResponse,
      { organization: string; project: string }
    >({
      query: ({ organization, project }) => ({
        url: buildGitProjectApiPath(organization, project, '/update'),
        method: 'POST',
        credentials: 'include',
      }),
    }),
    getGeckoGitProjectRefs: builder.query<
      GeckoGitRefsResponse,
      { organization: string; project: string }
    >({
      query: ({ organization, project }) => ({
        url: buildGitProjectApiPath(organization, project, '/refs'),
        method: 'GET',
        credentials: 'include',
      }),
    }),
    getGeckoGitProjectTree: builder.query<
      GeckoGitTreeResponse,
      {
        organization: string;
        project: string;
        path?: string;
        ref?: string;
      }
    >({
      query: ({ organization, project, path, ref }) => {
        const normalizedPath = path?.trim().replace(/^\/+|\/+$/g, '');
        const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
        const suffix = normalizedPath
          ? `/tree/${normalizedPath
              .split('/')
              .map((segment) => encodeURIComponent(segment))
              .join('/')}${query}`
          : `/tree${query}`;

        return {
          url: buildGitProjectApiPath(organization, project, suffix),
          method: 'GET',
          credentials: 'include',
        };
      },
    }),
    getGeckoGitProjectFile: builder.query<
      GeckoGitFileResponse,
      {
        organization: string;
        project: string;
        path: string;
        ref?: string;
      }
    >({
      query: ({ organization, project, path, ref }) => {
        const normalizedPath = path.trim().replace(/^\/+|\/+$/g, '');
        const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';
        return {
          url: buildGitProjectApiPath(
            organization,
            project,
            `/file/${normalizedPath
              .split('/')
              .map((segment) => encodeURIComponent(segment))
              .join('/')}${query}`,
          ),
          method: 'GET',
          credentials: 'include',
        };
      },
    }),
    createGeckoGitUploadSession: builder.mutation<
      GeckoGitUploadSessionResponse,
      {
        organization: string;
        project: string;
        body: GeckoGitUploadSessionCreateRequest;
      }
    >({
      query: ({ organization, project, body }) => ({
        url: buildGitProjectApiPath(organization, project, '/uploads/session'),
        method: 'POST',
        body,
        credentials: 'include',
      }),
    }),
    getGeckoGitUploadSession: builder.query<
      GeckoGitUploadSessionResponse,
      {
        organization: string;
        project: string;
        sessionID: string;
      }
    >({
      query: ({ organization, project, sessionID }) => ({
        url: buildGitProjectApiPath(
          organization,
          project,
          `/uploads/session/${encodeURIComponent(sessionID)}`,
        ),
        method: 'GET',
        credentials: 'include',
      }),
    }),
    attachGeckoGitUploadSessionFiles: builder.mutation<
      GeckoGitUploadSessionResponse,
      {
        organization: string;
        project: string;
        sessionID: string;
        body: GeckoGitUploadSessionAttachFilesRequest;
      }
    >({
      query: ({ organization, project, sessionID, body }) => ({
        url: buildGitProjectApiPath(
          organization,
          project,
          `/uploads/session/${encodeURIComponent(sessionID)}/files`,
        ),
        method: 'POST',
        body,
        credentials: 'include',
      }),
    }),
    finalizeGeckoGitUploadSession: builder.mutation<
      GeckoGitUploadSessionResponse,
      {
        organization: string;
        project: string;
        sessionID: string;
        body: GeckoGitUploadSessionFinalizeRequest;
      }
    >({
      query: ({ organization, project, sessionID, body }) => ({
        url: buildGitProjectApiPath(
          organization,
          project,
          `/uploads/session/${encodeURIComponent(sessionID)}/finalize`,
        ),
        method: 'POST',
        body,
        credentials: 'include',
      }),
    }),
  }),
});

export const {
  useConnectGeckoGitOrganizationMutation,
  useCreateGeckoGitUploadSessionMutation,
  useCreateGeckoProjectMutation,
  useDeleteGeckoOrganizationMutation,
  useDeleteGeckoProjectMutation,
  useFinalizeGeckoGitUploadSessionMutation,
  useGetGeckoGitOrganizationStatusQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoGitPendingRepositoriesQuery,
  useLazyGetGeckoGitPendingRepositoriesQuery,
  useLazyGetGeckoGitProjectFileQuery,
  useGetGeckoGitUploadSessionQuery,
  useAttachGeckoGitUploadSessionFilesMutation,
  useGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectRefsQuery,
  useGetGeckoGitProjectStatusQuery,
  useGetGeckoGitProjectTreeQuery,
  useGetGeckoGitProjectsQuery,
  useGetGeckoProjectsQuery,
  useReconcileGeckoGitPendingRepositoriesMutation,
  useReconcileGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationsMutation,
  useRefreshGeckoGitProjectMutation,
} = geckoApi;

export const geckoReducerPath = geckoApi.reducerPath;
export const geckoReducer: Reducer = geckoApi.reducer as Reducer;
export const geckoMiddleware: Middleware = geckoApi.middleware as Middleware;
