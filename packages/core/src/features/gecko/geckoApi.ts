import type { Middleware, Reducer } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { CALYPR_EXPLORER_CONFIG_API, GEN3_API } from '../../constants';
import { CoreState } from '../../reducers';
import { resourcePathFromProjectID } from '../submission/authMappingUtils';
import { gen3Api } from '../gen3';
import { selectCSRFToken } from '../user/userSliceRTK';
import { getCookie } from 'cookies-next';

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

export interface GeckoIntegrationCheck {
  readonly pass: boolean;
  readonly reason?: string;
  readonly details?: string;
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
  readonly storage?: GeckoProjectStorageIntent;
}

export interface GeckoUpdateProjectStorageMutationArgs {
  readonly organization: string;
  readonly project: string;
  readonly storage: GeckoProjectStorageIntent;
}

export interface GeckoUpdateProjectMutationArgs {
  readonly organization: string;
  readonly project: string;
  readonly configData: GeckoProjectConfig;
}

export interface GeckoDeleteProjectMutationArgs {
  readonly organization: string;
  readonly project: string;
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
  readonly mode?: 'redirect' | 'connected';
  readonly redirect_url?: string;
  readonly installation_id?: number;
  readonly state?: string;
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
    readonly github: GeckoIntegrationCheck;
    readonly storage: GeckoIntegrationCheck;
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

const geckoRequestHeaders = (getState: () => unknown): Headers => {
  const headers = new Headers();
  const csrfToken = selectCSRFToken(getState() as CoreState);
  if (csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  if (process.env.NODE_ENV === 'development') {
    const accessToken = getCookie('credentials_token');
    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }
  }
  return headers;
};

const blobToDataURL = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error('Failed to read thumbnail blob.'));
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(blob);
  });

const responseErrorMessage = async (response: Response): Promise<string> => {
  const text = await response.text();
  return (
    geckoErrorMessage(text) ||
    text ||
    `Request failed with status ${response.status}`
  );
};

const geckoFetchBaseQueryError = (
  status: number,
  message: string,
): FetchBaseQueryError => ({
  data: { error: message },
  status,
});

const normalizeThumbnailURL = (
  thumbnailURL: string | undefined,
  organization?: string,
  project?: string,
): string | undefined => {
  if (!thumbnailURL) {
    return undefined;
  }

  if (organization && project) {
    return `/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/thumbnail`;
  }

  const normalizedSource = (() => {
    try {
      const url = new URL(thumbnailURL);
      return url.pathname;
    } catch {
      return thumbnailURL;
    }
  })();

  const match = normalizedSource.match(
    /^\/gecko\/git\/projects\/([^/]+)\/([^/]+)\/thumbnail$/,
  );
  if (!match) {
    return thumbnailURL;
  }

  return `/gecko/git/projects/${encodeURIComponent(decodeURIComponent(match[1]))}/${encodeURIComponent(decodeURIComponent(match[2]))}/thumbnail`;
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
    contact_email?: unknown;
    configData?: unknown;
    description?: unknown;
    id?: unknown;
    organization?: unknown;
    project?: unknown;
    projectId?: unknown;
    resourcePath?: unknown;
    thumbnail_url?: unknown;
    title?: unknown;
  };

  const configData =
    candidate.configData && typeof candidate.configData === 'object'
      ? (candidate.configData as GeckoProjectConfig)
      : undefined;

  const metadata = {
    contact_email:
      typeof candidate.contact_email === 'string'
        ? candidate.contact_email
        : undefined,
    description:
      typeof candidate.description === 'string'
        ? candidate.description
        : undefined,
    organization:
      typeof candidate.organization === 'string'
        ? candidate.organization
        : undefined,
    project:
      typeof candidate.project === 'string' ? candidate.project : undefined,
    thumbnail_url:
      typeof candidate.thumbnail_url === 'string'
        ? candidate.thumbnail_url
        : undefined,
    title: typeof candidate.title === 'string' ? candidate.title : undefined,
  };

  const normalizedMetadata = {
    ...metadata,
    thumbnail_url: normalizeThumbnailURL(
      metadata.thumbnail_url,
      metadata.organization,
      metadata.project,
    ),
  };

  if (typeof candidate.resourcePath === 'string' && candidate.resourcePath) {
    const resourcePath = toProjectScopedResourcePath(candidate.resourcePath);
    return resourcePath ? { resourcePath, configData, ...normalizedMetadata } : null;
  }

  if (typeof candidate.projectId === 'string' && candidate.projectId) {
    const resourcePath = toProjectScopedResourcePath(candidate.projectId);
    return resourcePath ? { resourcePath, configData, ...normalizedMetadata } : null;
  }

  if (typeof candidate.id === 'string' && candidate.id) {
    const resourcePath = toProjectScopedResourcePath(candidate.id);
    return resourcePath ? { resourcePath, configData, ...normalizedMetadata } : null;
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
              .filter((record): record is GeckoProjectRecord => record !== null)
          : [],
    }),
    getGeckoProjectSummary: builder.query<
      Array<GeckoProjectSummaryRecord>,
      void
    >({
      query: () => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/projects/summary`,
        method: 'GET',
        credentials: 'include',
      }),
      transformResponse: (response: Array<unknown>) =>
        Array.isArray(response)
          ? response.filter((record): record is GeckoProjectSummaryRecord =>
              Boolean(
                record &&
                typeof record === 'object' &&
                typeof (record as GeckoProjectSummaryRecord).organization ===
                  'string' &&
                typeof (record as GeckoProjectSummaryRecord).project ===
                  'string',
              ),
            ).map((record) => ({
              ...record,
              thumbnail_url: normalizeThumbnailURL(
                record.thumbnail_url,
                record.organization,
                record.project,
              ),
            }))
          : [],
    }),
    createGeckoProject: builder.mutation<
      GeckoMutationResponse,
      GeckoCreateProjectMutationArgs
    >({
      invalidatesTags: ['GeckoProjects', 'GeckoGitProjects'],
      query: ({ configData, organization, project, storage }) => ({
        url: `/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/setup`,
        method: 'PUT',
        body: {
          config: configData,
          storage,
        },
        credentials: 'include',
      }),
      transformResponse: () => {
        return {
          success: true,
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
    updateGeckoProjectStorage: builder.mutation<
      GeckoMutationResponse,
      GeckoUpdateProjectStorageMutationArgs
    >({
      invalidatesTags: ['GeckoGitProjects'],
      query: ({ organization, project, storage }) => ({
        url: `/gecko/git/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/storage`,
        method: 'PUT',
        body: { storage },
        credentials: 'include',
      }),
      transformResponse: () => ({
        success: true,
      }),
      transformErrorResponse: (response) => ({
        success: false,
        error:
          geckoErrorMessage(response.data) ||
          `Failed to update project storage (Status: ${response.status})`,
      }),
    }),
    updateGeckoProject: builder.mutation<
      GeckoMutationResponse,
      GeckoUpdateProjectMutationArgs
    >({
      invalidatesTags: ['GeckoProjects', 'GeckoGitProjects'],
      query: ({ organization, project, configData }) => ({
        url: `${CALYPR_EXPLORER_CONFIG_API}/projects/${encodeURIComponent(organization)}/${encodeURIComponent(project)}`,
        method: 'PUT',
        body: configData,
        credentials: 'include',
      }),
      transformResponse: () => ({
        success: true,
      }),
      transformErrorResponse: (response) => ({
        success: false,
        error:
          geckoErrorMessage(response.data) ||
          `Failed to update project (Status: ${response.status})`,
      }),
    }),
    getGeckoProjectThumbnail: builder.query<
      GeckoProjectThumbnail | null,
      { organization: string; project: string }
    >({
      async queryFn({ organization, project }, { getState }) {
        const response = await fetch(
          `${GEN3_API}${buildGitProjectApiPath(organization, project, '/thumbnail')}`,
          {
            credentials: 'include',
            headers: geckoRequestHeaders(getState),
            method: 'GET',
          },
        );
        if (response.status === 404) {
          return { data: null };
        }
        if (!response.ok) {
          return {
            error: geckoFetchBaseQueryError(
              response.status,
              await responseErrorMessage(response),
            ),
          };
        }
        const blob = await response.blob();
        return {
          data: {
            content_type:
              response.headers.get('content-type') || blob.type || 'image/*',
            data_url: await blobToDataURL(blob),
          },
        };
      },
      providesTags: (_result, _error, { organization, project }) => [
        {
          type: 'GeckoGitProjects',
          id: `thumbnail:${organization}/${project}`,
        },
      ],
    }),
    uploadGeckoProjectThumbnail: builder.mutation<
      GeckoMutationResponse,
      GeckoUploadProjectThumbnailMutationArgs
    >({
      async queryFn({ organization, project, file }, { getState }) {
        const formData = new FormData();
        formData.append('thumbnail', file);
        const response = await fetch(
          `${GEN3_API}${buildGitProjectApiPath(organization, project, '/thumbnail')}`,
          {
            body: formData,
            credentials: 'include',
            headers: geckoRequestHeaders(getState),
            method: 'PUT',
          },
        );
        if (!response.ok) {
          return {
            error: geckoFetchBaseQueryError(
              response.status,
              await responseErrorMessage(response),
            ),
          };
        }
        return { data: { success: true } };
      },
      invalidatesTags: (_result, _error, { organization, project }) => [
        'GeckoGitProjects',
        {
          type: 'GeckoGitProjects',
          id: `thumbnail:${organization}/${project}`,
        },
      ],
    }),
    deleteGeckoProjectThumbnail: builder.mutation<
      GeckoMutationResponse,
      GeckoDeleteProjectThumbnailMutationArgs
    >({
      async queryFn({ organization, project }, { getState }) {
        const response = await fetch(
          `${GEN3_API}${buildGitProjectApiPath(organization, project, '/thumbnail')}`,
          {
            credentials: 'include',
            headers: geckoRequestHeaders(getState),
            method: 'DELETE',
          },
        );
        if (!response.ok) {
          return {
            error: geckoFetchBaseQueryError(
              response.status,
              await responseErrorMessage(response),
            ),
          };
        }
        return { data: { success: true } };
      },
      invalidatesTags: (_result, _error, { organization, project }) => [
        'GeckoGitProjects',
        {
          type: 'GeckoGitProjects',
          id: `thumbnail:${organization}/${project}`,
        },
      ],
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
    initConnectGeckoGitOrganization: builder.mutation<
      GeckoGitOrganizationConnectResponse,
      {
        organization: string;
        project: string;
        repositoryFullName: string;
        redirectPath?: string;
      }
    >({
      query: ({ organization, project, repositoryFullName, redirectPath }) => ({
        url: `/gecko/git/organizations/${encodeURIComponent(organization)}/init-connect`,
        method: 'POST',
        body: {
          project,
          repository_full_name: repositoryFullName,
          ...(redirectPath ? { redirect_path: redirectPath } : {}),
        },
        credentials: 'include',
      }),
    }),

    connectGeckoGitOrganization: builder.mutation<
      GeckoGitOrganizationConnectResponse,
      {
        installationId: number;
        state: string;
      }
    >({
      query: ({ installationId, state }) => ({
        url: '/gecko/git/connect',
        method: 'POST',
        body: {
          installation_id: installationId,
          state,
        },
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
    getGeckoGitOrganizationRepositories: builder.query<
      Array<GeckoGitRepositoryIdentity>,
      { organization: string; installationId: number }
    >({
      query: ({ organization, installationId }) => ({
        url: `/gecko/git/organizations/${encodeURIComponent(organization)}/connect`,
        method: 'POST',
        body: {
          installation_id: installationId,
        },
        credentials: 'include',
      }),
      transformResponse: (response: {
        repositories?: Array<{
          id: number;
          name: string;
          full_name: string;
          html_url: string;
          clone_url: string;
        }>;
      }) =>
        (response.repositories ?? []).map((repo) => {
          const parts = repo.full_name.split('/');
          return {
            host: 'github.com',
            owner: parts[0] || '',
            repo: parts[1] || repo.name || '',
            url: repo.html_url,
          };
        }),
    }),
  }),
});

export const {
  useConnectGeckoGitOrganizationMutation,
  useInitConnectGeckoGitOrganizationMutation,
  useCreateGeckoGitUploadSessionMutation,
  useCreateGeckoProjectMutation,
  useDeleteGeckoProjectThumbnailMutation,
  useDeleteGeckoOrganizationMutation,
  useDeleteGeckoProjectMutation,
  useFinalizeGeckoGitUploadSessionMutation,
  useGetGeckoGitOrganizationStatusQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectThumbnailQuery,
  useLazyGetGeckoGitProjectFileQuery,
  useGetGeckoGitUploadSessionQuery,
  useAttachGeckoGitUploadSessionFilesMutation,
  useGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectRefsQuery,
  useGetGeckoGitProjectStatusQuery,
  useGetGeckoGitProjectTreeQuery,
  useGetGeckoGitProjectsQuery,
  useGetGeckoProjectsQuery,
  useUpdateGeckoProjectMutation,
  useUpdateGeckoProjectStorageMutation,
  useUploadGeckoProjectThumbnailMutation,
  useReconcileGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationsMutation,
  useRefreshGeckoGitProjectMutation,
  useGetGeckoGitOrganizationRepositoriesQuery,
  useLazyGetGeckoGitOrganizationRepositoriesQuery,
} = geckoApi;

export const geckoReducerPath = geckoApi.reducerPath;
export const geckoReducer: Reducer = geckoApi.reducer as Reducer;
export const geckoMiddleware: Middleware = geckoApi.middleware as Middleware;
