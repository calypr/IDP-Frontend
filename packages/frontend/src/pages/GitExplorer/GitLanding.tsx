import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Autocomplete,
  Badge,
  Button,
  Collapse,
  Container,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Popover,
  Select,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
  Tooltip,
} from '@mantine/core';
import {
  IconBrandGit,
  IconBrandGithub,
  IconBuildingBank,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconSettings,
  IconX,
} from '@tabler/icons-react';
import type {
  GeckoGitOrganizationStatus,
  GeckoProjectConfig,
  GeckoProjectRecord,
  GeckoGitOrganizationProjectStatus,
} from '@gen3/core';
import {
  useConnectGeckoGitOrganizationMutation,
  useCreateGeckoProjectMutation,
  useDeleteGeckoProjectThumbnailMutation,
  useEditConnectGeckoGitProjectMutation,
  useGetAuthzMappingsQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectsQuery,
  useInitConnectGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationsMutation,
  useUpdateGeckoProjectMutation,
  useUpdateGeckoProjectStorageMutation,
  useUploadGeckoProjectThumbnailMutation,
} from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
import { useSession } from '../../lib/session/session';
import type {
  AccessibleOrganizationProject,
  OrganizationGroup,
} from '../OrganizationExplorer/types';
import {
  extractProjectsFromResourcePaths,
  groupProjectsByOrganization,
} from '../OrganizationExplorer/utils';
import {
  clearPendingProjectConnect,
  gitHubOwnerFromRepositoryFullName,
  loadPendingProjectConnect,
  normalizeRepositoryFullName,
  organizationFromGitHubState,
  repositoryFullNamesEqual,
} from './githubConnectState';
import type { GitExplorerPageProps } from './types';

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const actionButtonClassName =
  'border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900';

const toSlug = (value: string): string =>
  value
    .trim()
    .replace(/\.git$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const bucketProviderOptions = [{ label: 'Amazon S3', value: 's3' }];

const bucketRegionOptions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
].map((region) => ({ label: region, value: region }));

interface CreateProjectFormState {
  readonly bucket: string;
  readonly bucket_access_key: string;
  readonly bucket_endpoint_url: string;
  readonly bucket_org_path: string;
  readonly bucket_project_path: string;
  readonly bucket_provider: string;
  readonly bucket_region: string;
  readonly bucket_secret_key: string;
  readonly contact_email: string;
  readonly description: string;
  readonly icon_name: string;
  readonly org_title: string;
  readonly project_name: string;
  readonly project_title: string;
}

interface ProjectManagementFormState extends CreateProjectFormState {
  readonly src_repo: string;
}

type CreateProjectField =
  | 'org_title'
  | 'project_name'
  | 'project_title'
  | 'contact_email'
  | 'description';

type CreateProjectFieldErrors = Partial<Record<CreateProjectField, string>>;

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());

const thumbnailAccept = 'image/png,image/jpeg';
const maxThumbnailBytes = 1 << 20;
const minThumbnailPixels = 100;
const maxThumbnailPixels = 3000;

const readFileAsDataURL = async (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(reader.error || new Error('Failed to read thumbnail image.'));
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.readAsDataURL(file);
  });

const extractThumbnailPreviewFromImage = (
  image: HTMLImageElement,
): string | null => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
};

const readImageDimensions = async (
  file: File,
): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read thumbnail image dimensions.'));
    };
    image.onload = () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    image.src = url;
  });

const validateThumbnailFile = async (file: File): Promise<void> => {
  const contentType = file.type.trim().toLowerCase();
  if (contentType !== 'image/png' && contentType !== 'image/jpeg') {
    throw new Error('Thumbnail must be a PNG or JPG image.');
  }
  if (file.size > maxThumbnailBytes) {
    throw new Error('Thumbnail must be under 1MB.');
  }
  const { width, height } = await readImageDimensions(file);
  if (width < minThumbnailPixels || height < minThumbnailPixels) {
    throw new Error(
      `Thumbnail must be at least ${minThumbnailPixels}x${minThumbnailPixels}px.`,
    );
  }
  if (width > maxThumbnailPixels || height > maxThumbnailPixels) {
    throw new Error(
      `Thumbnail must be no larger than ${maxThumbnailPixels}x${maxThumbnailPixels}px.`,
    );
  }
};

const apiErrorMessage = (error: unknown): string | undefined => {
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (!trimmed) {
      return undefined;
    }
    try {
      return apiErrorMessage(JSON.parse(trimmed)) ?? trimmed;
    } catch {
      return trimmed;
    }
  }
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const record = error as {
    readonly data?: unknown;
    readonly error?: unknown;
    readonly message?: unknown;
  };
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message;
  }
  if (typeof record.error === 'string' && record.error.trim()) {
    return record.error;
  }
  if (record.error && typeof record.error === 'object') {
    const nestedMessage = apiErrorMessage(record.error);
    if (nestedMessage) {
      return nestedMessage;
    }
  }
  if (record.data !== undefined) {
    const dataMessage = apiErrorMessage(record.data);
    if (dataMessage) {
      return dataMessage;
    }
  }
  return undefined;
};

const setupErrorMessage = (
  error: unknown,
  organization: string,
  project: string,
): string | undefined => {
  const message = apiErrorMessage(error);
  if (!message) {
    return undefined;
  }

  const createProjectMatch = message.match(
    /user is not allowed to create descendants under (\/programs\/[^/]+\/projects)/,
  );
  if (createProjectMatch) {
    return `Organization "${organization}" already exists, but you do not have permission to create project "${project}" in it.`;
  }

  const createOrganizationMatch = message.match(
    /user is not allowed to create descendants under \/programs\b/,
  );
  if (createOrganizationMatch) {
    return `Organization "${organization}" does not appear to exist yet, and you do not have permission to create new organizations. Ask an administrator to create it or grant organization creation access.`;
  }

  if (message.includes('resource already exists:')) {
    return `A Calypr resource for "${organization}/${project}" already exists. Refresh the Git page; if it still does not appear, the existing Arborist resource is stale and needs cleanup.`;
  }

  return message;
};

const isOrganizationMembershipResource = (
  resourcePath: string,
): { organization: string } | null => {
  const parts = resourcePath.split('/').filter(Boolean);
  if (parts[0] !== 'programs' || !parts[1]) {
    return null;
  }

  if (parts.length === 2) {
    return { organization: parts[1] };
  }

  if (parts.length === 3 && parts[2] === 'projects') {
    return { organization: parts[1] };
  }

  return null;
};

const isOrganizationMemberOrOwnerAction = (action: {
  readonly method: string;
  readonly service: string;
}): boolean =>
  action.service === 'arborist' &&
  (action.method === 'create-descendant' || action.method === 'manage-owners');

const actionMatches = (
  action: { readonly method: string; readonly service: string },
  service: string,
  method: string,
): boolean =>
  (action.service === service || action.service === '*') &&
  (action.method === method || action.method === '*');

const canManageOrganizationSettings = (
  authzMapping: Record<string, Array<{ method: string; service: string }>>,
  organization: string,
  gitStatus?: GeckoGitOrganizationStatus,
  isAdmin = false,
): boolean => {
  if (isAdmin) {
    return true;
  }
  if (typeof gitStatus?.can_access_settings === 'boolean') {
    return gitStatus.can_access_settings;
  }
  const candidatePaths = [`/programs/${organization}`, '/programs', '/', '*'];
  return candidatePaths.some((path) =>
    (authzMapping[path] ?? []).some((action) =>
      actionMatches(action, 'arborist', 'manage-owners'),
    ),
  );
};

const canCreateProjectsInOrganization = (
  authzMapping: Record<string, Array<{ method: string; service: string }>>,
  organization: string,
  gitStatus?: GeckoGitOrganizationStatus,
  isAdmin = false,
): boolean => {
  if (isAdmin) {
    return true;
  }
  if (typeof gitStatus?.can_create_projects === 'boolean') {
    return gitStatus.can_create_projects;
  }
  if (
    canManageOrganizationSettings(
      authzMapping,
      organization,
      gitStatus,
      isAdmin,
    )
  ) {
    return true;
  }
  const candidatePaths = [
    `/programs/${organization}/projects`,
    `/programs/${organization}`,
    '/programs',
    '/',
    '*',
  ];
  return candidatePaths.some((path) =>
    (authzMapping[path] ?? []).some((action) =>
      actionMatches(action, 'arborist', 'create-descendant'),
    ),
  );
};

const defaultProjectConfig = (
  organization: string,
): CreateProjectFormState => ({
  bucket: '',
  bucket_access_key: '',
  bucket_endpoint_url: '',
  bucket_org_path: '',
  bucket_project_path: '',
  bucket_provider: 's3',
  bucket_region: 'us-east-1',
  bucket_secret_key: '',
  contact_email: '',
  description: '',
  icon_name: 'binoculars',
  org_title: organization,
  project_name: '',
  project_title: '',
});

const defaultIntegrationCheck = (
  details: string,
): {
  readonly pass: boolean;
  readonly details: string;
} => ({
  pass: false,
  details,
});

const normalizeRepositoryURL = (value?: string | null): string => {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    return '';
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    return '';
  }
  return '';
};

const repositoryFullNameFromSrcRepo = (value?: string | null): string => {
  const trimmed = value?.trim() || '';
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    const segments = url.pathname
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.git$/i, '')
      .split('/')
      .filter(Boolean);
    if (segments.length >= 2) {
      return `${segments[0]}/${segments[1]}`;
    }
  } catch {
    const normalized = trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^git@/i, '')
      .replace(/^[^:]+:/, '')
      .replace(/^\/+|\/+$/g, '')
      .replace(/\.git$/i, '');
    const segments = normalized.split('/').filter(Boolean);
    if (segments.length >= 3) {
      return `${segments[1]}/${segments[2]}`;
    }
    if (segments.length >= 2) {
      return `${segments[segments.length - 2]}/${segments[segments.length - 1]}`;
    }
  }

  return '';
};

const isValidRepositoryFullName = (value: string): boolean =>
  /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value.trim());

const repositoryPresentInInstallation = (
  repositories: Array<{ full_name: string }>,
  repositoryFullName?: string | null,
): boolean => {
  const normalizedTarget = normalizeRepositoryFullName(repositoryFullName);
  if (!normalizedTarget) {
    return false;
  }
  return repositories.some((repository) =>
    repositoryFullNamesEqual(repository.full_name, normalizedTarget),
  );
};

const projectIntegrations = (status?: GeckoGitOrganizationProjectStatus) => ({
  github:
    status?.integrations?.github ??
    defaultIntegrationCheck('GitHub connection status is unavailable.'),
  storage:
    status?.integrations?.storage ??
    defaultIntegrationCheck('Storage status is unavailable.'),
});

const integrationIssuesForProject = (
  status?: GeckoGitOrganizationProjectStatus,
): Array<{ key: 'github' | 'storage'; label: string; details?: string }> => {
  if (!status) {
    return [
      {
        key: 'github',
        label: 'GitHub connection status unavailable',
      },
      {
        key: 'storage',
        label: 'Storage status unavailable',
      },
    ];
  }
  const issues: Array<{
    key: 'github' | 'storage';
    label: string;
    details?: string;
  }> = [];
  const integrations = projectIntegrations(status);
  if (!integrations.github.pass) {
    issues.push({
      key: 'github',
      label: 'GitHub unconnected',
      details: integrations.github.details,
    });
  }
  if (!integrations.storage.pass) {
    issues.push({
      key: 'storage',
      label: 'Storage unconnected',
      details: integrations.storage.details,
    });
  }
  return issues;
};

const projectConnectionBadge = (
  status?: GeckoGitOrganizationProjectStatus,
  isRefreshing = false,
): Array<{
  color: 'gray' | 'green' | 'red' | 'yellow';
  icon?: React.ReactNode;
  label: string;
}> => {
  if (isRefreshing) {
    return [{ color: 'gray', label: 'Refreshing...' }];
  }
  const integrations = projectIntegrations(status);
  const badges: Array<{
    color: 'gray' | 'green' | 'red' | 'yellow';
    icon?: React.ReactNode;
    label: string;
  }> = [];
  if (!integrations.github.pass) {
    badges.push({ color: 'red', icon: <IconX size={12} />, label: 'GitHub' });
  }
  if (!integrations.storage.pass) {
    badges.push({ color: 'red', icon: <IconX size={12} />, label: 'Storage' });
  }
  if (badges.length > 0) {
    return badges;
  }
  return [{ color: 'green', label: 'Ready' }];
};

const ThumbnailField = ({
  configured = false,
  error,
  fileName,
  onFileSelected,
  onRemove,
  previewURL,
}: {
  configured?: boolean;
  error?: string | null;
  fileName?: string;
  onFileSelected: (file: File | null) => void;
  onRemove: () => void;
  previewURL?: string;
}) => (
  <Stack gap="xs">
    <Text fw={600} size="sm">
      Project thumbnail
    </Text>
    <Text c="dimmed" size="sm">
      Optional. PNG or JPG only, between 100x100 and 3000x3000 pixels, and under
      1MB. Stored by Gecko on persistent project storage and served separately
      from the project config.
    </Text>
    <Group align="flex-start" gap="md" wrap="nowrap">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
        {previewURL ? (
          <img
            alt="Project thumbnail preview"
            className="h-full w-full object-contain p-1"
            src={previewURL}
          />
        ) : (
          <Text c="dimmed" size="xs">
            {configured ? 'Configured' : 'No thumbnail'}
          </Text>
        )}
      </div>
      <Stack gap="xs" style={{ flex: 1 }}>
        <input
          accept={thumbnailAccept}
          onChange={(event) =>
            onFileSelected(event.currentTarget.files?.[0] || null)
          }
          type="file"
        />
        {fileName ? (
          <Text c="dimmed" size="sm">
            Selected: {fileName}
          </Text>
        ) : configured ? (
          <Text c="dimmed" size="sm">
            A thumbnail is already configured for this project.
          </Text>
        ) : null}
        <Group gap="xs">
          <Button
            color="gray"
            onClick={onRemove}
            size="compact-sm"
            variant="subtle"
          >
            Remove thumbnail
          </Button>
        </Group>
        {error ? (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </Group>
  </Stack>
);

const ThumbnailSummary = ({
  configured = false,
  error,
  onEdit,
  previewURL,
}: {
  configured?: boolean;
  error?: string | null;
  onEdit: () => void;
  previewURL?: string;
}) => (
  <section className="border-t border-slate-200 pt-6">
    <SectionHeader
      body={
        <button
          aria-label="Edit project thumbnail"
          className="group flex w-full items-center gap-4 rounded-md border border-slate-200 bg-white px-4 py-4 text-left shadow-none transition hover:border-sky-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          onClick={onEdit}
          type="button"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition group-hover:border-sky-200 group-hover:bg-white">
            {previewURL ? (
              <img
                alt="Project thumbnail preview"
                className="h-full w-full object-contain p-1"
                src={previewURL}
              />
            ) : (
              <Text c="dimmed" size="xs">
                {configured ? 'Set' : 'None'}
              </Text>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Text fw={600} size="sm">
              {previewURL || configured
                ? 'Thumbnail configured'
                : 'No thumbnail yet'}
            </Text>
            <Text c="dimmed" size="sm">
              {previewURL || configured
                ? 'Click anywhere to change the image.'
                : 'Click anywhere to add a project image.'}
            </Text>
          </div>
          <IconChevronRight
            className="shrink-0 text-slate-400 transition group-hover:text-sky-600"
            size={16}
          />
        </button>
      }
      title="Project thumbnail"
    />
    {error ? (
      <Alert className="mt-4" color="red" variant="light">
        {error}
      </Alert>
    ) : null}
  </section>
);

const StatusPill = ({
  color,
  icon,
  label,
}: {
  color: 'gray' | 'green' | 'red' | 'sky' | 'yellow';
  icon?: React.ReactNode;
  label: string;
}) => (
  <span
    className={[
      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold uppercase leading-none tracking-[0.04em]',
      color === 'green'
        ? 'bg-emerald-50 text-emerald-700'
        : color === 'red'
          ? 'bg-rose-50 text-rose-700'
          : color === 'yellow'
            ? 'bg-amber-50 text-amber-700'
            : color === 'sky'
              ? 'bg-sky-50 text-sky-700'
              : 'bg-slate-100 text-slate-600',
    ].join(' ')}
  >
    {icon ? (
      <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center self-center translate-y-px [&_svg]:block">
        {icon}
      </span>
    ) : null}
    {label}
  </span>
);

const SectionHeader = ({
  action,
  body,
  title,
}: {
  action?: React.ReactNode;
  body?: React.ReactNode;
  title: string;
}) => (
  <div className="flex items-start justify-between gap-6">
    <div className="min-w-0">
      <Text fw={700} size="lg">
        {title}
      </Text>
      {body ? <div className="mt-2">{body}</div> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
);

const StorageFields = ({
  formState,
  onUpdateField,
}: {
  formState: CreateProjectFormState;
  onUpdateField: (field: keyof CreateProjectFormState, value: string) => void;
}) => (
  <Stack gap="sm">
    <div className="grid gap-3 md:grid-cols-2">
      <TextInput
        label="Bucket"
        onChange={(event) => onUpdateField('bucket', event.currentTarget.value)}
        value={formState.bucket}
      />
      <TextInput
        label="Endpoint URL"
        onChange={(event) =>
          onUpdateField('bucket_endpoint_url', event.currentTarget.value)
        }
        value={formState.bucket_endpoint_url}
      />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <PasswordInput
        label="Access key"
        onChange={(event) =>
          onUpdateField('bucket_access_key', event.currentTarget.value)
        }
        value={formState.bucket_access_key}
      />
      <PasswordInput
        label="Secret key"
        onChange={(event) =>
          onUpdateField('bucket_secret_key', event.currentTarget.value)
        }
        value={formState.bucket_secret_key}
      />
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      <Select
        data={bucketProviderOptions}
        label="Provider"
        onChange={(value) => onUpdateField('bucket_provider', value || 's3')}
        value={formState.bucket_provider}
      />
      <Select
        data={bucketRegionOptions}
        label="Region"
        onChange={(value) => onUpdateField('bucket_region', value || '')}
        searchable
        value={formState.bucket_region}
      />
    </div>
  </Stack>
);

export const CreateProjectModal = ({
  allowDismiss = true,
  existingOrganizations = [],
  initialFormState,
  onClose,
  onCreated,
  opened,
  organization,
  renderInline = false,
}: {
  allowDismiss?: boolean;
  existingOrganizations?: Array<string>;
  initialFormState?: CreateProjectFormState;
  onClose: () => void;
  onCreated: () => void;
  opened: boolean;
  organization: string;
  renderInline?: boolean;
}) => {
  const [activeTab, setActiveTab] = useState<string | null>('details');
  const [thumbnailEditorOpen, setThumbnailEditorOpen] = useState(false);
  const [formState, setFormState] = useState(
    () => initialFormState || defaultProjectConfig(organization),
  );
  const [fieldErrors, setFieldErrors] = useState<CreateProjectFieldErrors>({});
  const [createdProjectKey, setCreatedProjectKey] = useState<string | null>(
    null,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [createGeckoProject, { isLoading }] = useCreateGeckoProjectMutation();
  const [uploadThumbnail, { isLoading: isUploadingThumbnail }] =
    useUploadGeckoProjectThumbnailMutation();

  const resetForm = () => {
    setActiveTab('details');
    setThumbnailEditorOpen(false);
    setFormState(initialFormState || defaultProjectConfig(organization));
    setFieldErrors({});
    setCreatedProjectKey(null);
    setSubmitError(null);
    setThumbnailError(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
  };

  useEffect(() => {
    setActiveTab('details');
    setThumbnailEditorOpen(false);
    setFormState(initialFormState || defaultProjectConfig(organization));
    setFieldErrors({});
    setCreatedProjectKey(null);
    setSubmitError(null);
    setThumbnailError(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
  }, [initialFormState, organization, opened]);

  const handleClose = () => {
    const shouldRefreshProjects = Boolean(createdProjectKey);
    resetForm();
    if (shouldRefreshProjects) {
      onCreated();
    }
    onClose();
  };

  const updateField = (field: keyof typeof formState, value: string): void => {
    if (
      field === 'org_title' ||
      field === 'project_name' ||
      field === 'project_title' ||
      field === 'contact_email' ||
      field === 'description'
    ) {
      setFieldErrors((current) => {
        if (!current[field]) {
          return current;
        }
        const next = { ...current };
        delete next[field];
        return next;
      });
    }
    setFormState((currentState) => {
      const nextState = {
        ...currentState,
        [field]: value,
      };

      if (field === 'project_title') {
        return nextState;
      }

      return nextState;
    });
  };

  const submittedOrganization =
    toSlug(formState.org_title) || formState.org_title.trim();
  const submittedProject = toSlug(formState.project_name);
  const submittedResourceKey = `${submittedOrganization}/${submittedProject}`;
  const isSubmitting = isLoading || isUploadingThumbnail;
  const isRetryingThumbnailUpload = Boolean(createdProjectKey && thumbnailFile);
  const hasStorageInput = Boolean(
    formState.bucket.trim() ||
    formState.bucket_endpoint_url.trim() ||
    formState.bucket_access_key.trim() ||
    formState.bucket_secret_key.trim() ||
    formState.bucket_org_path.trim() ||
    formState.bucket_project_path.trim(),
  );

  const updateThumbnailFile = async (file: File | null): Promise<void> => {
    if (!file) {
      setThumbnailFile(null);
      setThumbnailPreview('');
      setThumbnailError(null);
      return;
    }
    try {
      await validateThumbnailFile(file);
      const preview = await readFileAsDataURL(file);
      setThumbnailFile(file);
      setThumbnailPreview(preview);
      setThumbnailError(null);
    } catch (error) {
      setThumbnailError(
        apiErrorMessage(error) || 'Failed to preview thumbnail image.',
      );
    }
  };

  const handleSubmit = async () => {
    if (createdProjectKey) {
      if (!thumbnailFile) {
        handleClose();
        return;
      }

      setSubmitError(null);
      setThumbnailError(null);

      try {
        const thumbnailResponse = await uploadThumbnail({
          file: thumbnailFile,
          organization: submittedOrganization,
          project: submittedProject,
        }).unwrap();
        if (!thumbnailResponse.success) {
          setThumbnailError(
            thumbnailResponse.error || 'Failed to upload thumbnail image.',
          );
          return;
        }
      } catch (error) {
        setThumbnailError(
          apiErrorMessage(error) || 'Failed to upload thumbnail image.',
        );
        return;
      }

      resetForm();
      onCreated();
      onClose();
      return;
    }
    const trimmedOrganization =
      toSlug(formState.org_title) || formState.org_title.trim();
    const trimmedProjectKey = toSlug(formState.project_name);
    const configData: GeckoProjectConfig = {
      contact_email: formState.contact_email.trim(),
      description: formState.description.trim(),
      org_title: trimmedOrganization,
      project_title: formState.project_title.trim(),
      src_repo: '',
      title: formState.project_title.trim(),
    };

    const nextFieldErrors: CreateProjectFieldErrors = {};
    if (!trimmedOrganization) {
      nextFieldErrors.org_title = 'Organization is required.';
    }
    if (!trimmedProjectKey) {
      nextFieldErrors.project_name = 'Project ID is required.';
    }
    if (!configData.project_title) {
      nextFieldErrors.project_title = 'Project title is required.';
    }
    if (!configData.contact_email) {
      nextFieldErrors.contact_email = 'Contact email is required.';
    } else if (!isValidEmail(configData.contact_email)) {
      nextFieldErrors.contact_email = 'Enter a valid contact email address.';
    }
    if (!configData.description) {
      nextFieldErrors.description = 'Description is required.';
    }
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setSubmitError('Fill in the highlighted required fields.');
      return;
    }

    setSubmitError(null);
    setThumbnailError(null);

    try {
      let storage:
        | {
            access_key?: string;
            bucket: string;
            endpoint?: string;
            organization: string;
            organization_sub_path?: string;
            project_id: string;
            project_sub_path?: string;
            provider: string;
            region?: string;
            secret_key?: string;
          }
        | undefined;

      if (hasStorageInput) {
        if (!formState.bucket.trim() || !formState.bucket_provider.trim()) {
          setSubmitError(
            'Storage bucket name and provider are required if you want to configure storage now.',
          );
          setActiveTab('storage');
          return;
        }
        if (
          formState.bucket_provider.trim().toLowerCase() === 's3' &&
          (!formState.bucket_access_key.trim() ||
            !formState.bucket_secret_key.trim())
        ) {
          setSubmitError(
            'S3 access key and secret key are required if you want to configure storage now.',
          );
          setActiveTab('storage');
          return;
        }
        storage = {
          access_key: formState.bucket_access_key.trim() || undefined,
          bucket: formState.bucket.trim(),
          endpoint: formState.bucket_endpoint_url.trim() || undefined,
          organization: trimmedOrganization,
          organization_sub_path: formState.bucket_org_path.trim() || undefined,
          project_id: trimmedProjectKey,
          project_sub_path: formState.bucket_project_path.trim() || undefined,
          provider: formState.bucket_provider.trim(),
          region: formState.bucket_region.trim() || undefined,
          secret_key: formState.bucket_secret_key.trim() || undefined,
        };
      }

      const response = await createGeckoProject({
        configData,
        organization: trimmedOrganization,
        project: trimmedProjectKey,
        storage,
      }).unwrap();

      if (!response.success) {
        setSubmitError(response.error || 'Failed to create project.');
        return;
      }

      if (thumbnailFile) {
        try {
          const thumbnailResponse = await uploadThumbnail({
            file: thumbnailFile,
            organization: trimmedOrganization,
            project: trimmedProjectKey,
          }).unwrap();
          if (!thumbnailResponse.success) {
            setCreatedProjectKey(submittedResourceKey);
            setThumbnailError(
              `Project was created, but the thumbnail upload failed: ${
                thumbnailResponse.error || 'Failed to upload thumbnail image.'
              }`,
            );
            return;
          }
        } catch (error) {
          setCreatedProjectKey(submittedResourceKey);
          setThumbnailError(
            `Project was created, but the thumbnail upload failed: ${
              apiErrorMessage(error) || 'Failed to upload thumbnail image.'
            }`,
          );
          return;
        }
      }

      resetForm();
      onCreated();
      onClose();
    } catch (error) {
      const errorMessage =
        setupErrorMessage(error, trimmedOrganization, trimmedProjectKey) ??
        'Failed to finish creating this project. Please check the fields and try again.';
      setSubmitError(errorMessage);
    }
  };

  const formContent = (
    <Stack gap="lg">
      {renderInline ? (
        <div>
          <Text fw={700} size="xl">
            Create project
          </Text>
          {organization ? (
            <Text c="dimmed" size="sm">
              Organization: {organization}
            </Text>
          ) : null}
        </div>
      ) : null}
      <Tabs onChange={setActiveTab} value={activeTab}>
        <Tabs.List>
          <Tabs.Tab value="details">Project details</Tabs.Tab>
          <Tabs.Tab value="storage">Storage</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel pt="md" value="details">
          <Stack gap="xl">
            <section>
              <Text c="dimmed" size="sm">
                Start with the project metadata. Storage can be configured now
                or later.
              </Text>
              <div className="mt-4">
                <Stack gap="xs">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Autocomplete
                      data-autofocus
                      data={existingOrganizations}
                      error={fieldErrors.org_title}
                      label="Calypr organization"
                      onChange={(value) => updateField('org_title', value)}
                      placeholder="Existing org or new org"
                      value={formState.org_title}
                    />
                    <TextInput
                      error={fieldErrors.project_name}
                      label="Calypr project ID"
                      onChange={(event) =>
                        updateField('project_name', event.currentTarget.value)
                      }
                      placeholder="example_project"
                      value={formState.project_name}
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <TextInput
                      error={fieldErrors.project_title}
                      label="Project title"
                      onChange={(event) =>
                        updateField('project_title', event.currentTarget.value)
                      }
                      placeholder="Human-readable project label"
                      value={formState.project_title}
                    />
                    <TextInput
                      error={fieldErrors.contact_email}
                      label="Contact email"
                      onChange={(event) =>
                        updateField('contact_email', event.currentTarget.value)
                      }
                      placeholder="name@example.org"
                      value={formState.contact_email}
                    />
                  </div>
                  <Textarea
                    autosize
                    error={fieldErrors.description}
                    label="Description"
                    minRows={2}
                    onChange={(event) =>
                      updateField('description', event.currentTarget.value)
                    }
                    placeholder="Project description"
                    value={formState.description}
                  />
                </Stack>
              </div>
            </section>

            <ThumbnailSummary
              error={thumbnailError}
              onEdit={() => setThumbnailEditorOpen(true)}
              previewURL={thumbnailPreview}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel pt="md" value="storage">
          <Stack gap="md">
            <Text c="dimmed" size="sm">
              Configure storage now if you want the project ready for uploads
              immediately. You can come back and add this later.
            </Text>
            <StorageFields formState={formState} onUpdateField={updateField} />
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <Group
        className="border-t border-slate-200 pt-4"
        justify="space-between"
        align="flex-start"
      >
        {submitError ? (
          <Alert className="max-w-2xl flex-1" color="red" variant="light">
            {submitError}
          </Alert>
        ) : (
          <div />
        )}
        <Group justify="flex-end">
          {allowDismiss ? (
            <Button color="gray" onClick={handleClose} variant="subtle">
              Cancel
            </Button>
          ) : null}
          <Button
            className={actionButtonClassName}
            color="sky"
            leftSection={<IconPlus size={16} />}
            loading={isSubmitting}
            onClick={handleSubmit}
            variant="light"
          >
            {isRetryingThumbnailUpload
              ? 'Retry thumbnail upload'
              : createdProjectKey
                ? 'Done'
                : 'Create project'}
          </Button>
        </Group>
      </Group>
    </Stack>
  );

  const thumbnailEditor = (
    <Modal
      onClose={() => setThumbnailEditorOpen(false)}
      opened={thumbnailEditorOpen}
      size="md"
      title="Project thumbnail"
    >
      <Stack gap="md">
        <ThumbnailField
          error={thumbnailError}
          fileName={thumbnailFile?.name}
          onFileSelected={(file) => {
            void updateThumbnailFile(file);
          }}
          onRemove={() => {
            void updateThumbnailFile(null);
          }}
          previewURL={thumbnailPreview}
        />
        <Group justify="flex-end">
          <Button
            color="gray"
            onClick={() => setThumbnailEditorOpen(false)}
            variant="subtle"
          >
            Done
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  if (renderInline) {
    return (
      <>
        <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
          {formContent}
        </div>
        {thumbnailEditor}
      </>
    );
  }

  return (
    <Modal
      onClose={allowDismiss ? handleClose : () => undefined}
      opened={opened}
      size="lg"
      title={
        <div>
          <Text fw={700} size="xl">
            Create project
          </Text>
          {organization ? (
            <Text c="dimmed" size="sm">
              Organization: {organization}
            </Text>
          ) : null}
        </div>
      }
    >
      {formContent}
      {thumbnailEditor}
    </Modal>
  );
};

export const ProjectManagementModal = ({
  config,
  onClose,
  onProjectSaved,
  onStorageSaved,
  opened,
  organization,
  project,
  repositoryLabel,
  repositoryURL,
  status,
  thumbnailPreviewData,
  thumbnailURL,
  onThumbnailPreviewChange,
  onThumbnailRemoved,
}: {
  config?: GeckoProjectConfig;
  onClose: () => void;
  onProjectSaved: () => void;
  onStorageSaved: () => void;
  opened: boolean;
  organization: string;
  project: string;
  repositoryLabel?: string;
  repositoryURL?: string;
  status?: GeckoGitOrganizationProjectStatus;
  thumbnailPreviewData?: string;
  thumbnailURL?: string;
  onThumbnailPreviewChange?: (
    thumbnailURL: string,
    previewData: string,
  ) => void;
  onThumbnailRemoved?: (thumbnailURL: string) => void;
}) => {
  const [activeTab, setActiveTab] = useState<string | null>('details');
  const [thumbnailEditorOpen, setThumbnailEditorOpen] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false);
  const [formState, setFormState] = useState<ProjectManagementFormState>(
    () => ({
      ...defaultProjectConfig(organization),
      src_repo: '',
    }),
  );
  const [updateProject, { isLoading: isSavingProject }] =
    useUpdateGeckoProjectMutation();
  const [uploadThumbnail, { isLoading: isUploadingThumbnail }] =
    useUploadGeckoProjectThumbnailMutation();
  const [deleteThumbnail, { isLoading: isDeletingThumbnail }] =
    useDeleteGeckoProjectThumbnailMutation();
  const [updateStorage, { isLoading: isSavingStorage }] =
    useUpdateGeckoProjectStorageMutation();
  const integrations = projectIntegrations(status);
  const readinessBadges = projectConnectionBadge(status);

  useEffect(() => {
    setActiveTab('details');
    setThumbnailEditorOpen(false);
    setOverviewError(null);
    setStorageError(null);
    setThumbnailError(null);
    setThumbnailFile(null);
    setThumbnailPreview(thumbnailPreviewData || '');
    setThumbnailRemoved(false);
    setFormState({
      ...defaultProjectConfig(organization),
      contact_email: config?.contact_email || '',
      description: config?.description || '',
      icon_name: config?.icon_name || 'binoculars',
      org_title: config?.org_title || organization,
      project_name: project,
      project_title: config?.project_title || project,
      src_repo:
        normalizeRepositoryURL(config?.src_repo) ||
        normalizeRepositoryURL(repositoryURL),
    });
  }, [
    config,
    opened,
    organization,
    project,
    repositoryLabel,
    repositoryURL,
    thumbnailPreviewData,
    thumbnailURL,
  ]);

  const issues = integrationIssuesForProject(status);
  const hasPendingThumbnailChanges = Boolean(thumbnailFile) || thumbnailRemoved;
  const hasExistingThumbnail = Boolean(thumbnailURL) && !thumbnailRemoved;
  const isSavingThumbnail = isUploadingThumbnail || isDeletingThumbnail;

  const updateThumbnailFile = async (file: File | null): Promise<void> => {
    if (!file) {
      setThumbnailFile(null);
      setThumbnailPreview(thumbnailRemoved ? '' : thumbnailPreviewData || '');
      setThumbnailError(null);
      return;
    }
    try {
      await validateThumbnailFile(file);
      const preview = await readFileAsDataURL(file);
      setThumbnailFile(file);
      setThumbnailPreview(preview);
      setThumbnailRemoved(false);
      setThumbnailError(null);
    } catch (error) {
      setThumbnailError(
        apiErrorMessage(error) || 'Failed to preview thumbnail image.',
      );
    }
  };

  const saveThumbnailChanges = async () => {
    if (!hasPendingThumbnailChanges) {
      setThumbnailEditorOpen(false);
      return;
    }

    setThumbnailError(null);
    try {
      if (thumbnailRemoved && hasExistingThumbnail) {
        const deleteResponse = await deleteThumbnail({
          organization,
          project,
        }).unwrap();
        if (!deleteResponse.success) {
          setThumbnailError(
            deleteResponse.error || 'Failed to remove project thumbnail.',
          );
          return;
        }
      } else if (thumbnailFile) {
        const uploadResponse = await uploadThumbnail({
          file: thumbnailFile,
          organization,
          project,
        }).unwrap();
        if (!uploadResponse.success) {
          setThumbnailError(
            uploadResponse.error || 'Failed to upload project thumbnail.',
          );
          return;
        }
      }

      if (thumbnailRemoved && thumbnailURL) {
        onThumbnailRemoved?.(thumbnailURL);
      }
      if (thumbnailFile && thumbnailPreview && thumbnailURL) {
        onThumbnailPreviewChange?.(thumbnailURL, thumbnailPreview);
      }
      setThumbnailFile(null);
      setThumbnailRemoved(false);
      if (thumbnailRemoved) {
        setThumbnailPreview('');
      }
      setThumbnailEditorOpen(false);
      onProjectSaved();
    } catch (error) {
      setThumbnailError(
        apiErrorMessage(error) || 'Failed to save project thumbnail changes.',
      );
    }
  };

  const saveOverview = async () => {
    const nextConfig: GeckoProjectConfig = {
      contact_email: formState.contact_email.trim(),
      description: formState.description.trim(),
      org_title: organization,
      project_title: formState.project_title.trim(),
      src_repo: normalizeRepositoryURL(formState.src_repo),
      title: formState.project_title.trim(),
    };

    if (
      !nextConfig.contact_email ||
      !nextConfig.description ||
      !nextConfig.project_title
    ) {
      setOverviewError(
        'Project title, contact email, and description are required.',
      );
      return;
    }
    if (!isValidEmail(nextConfig.contact_email)) {
      setOverviewError('Enter a valid contact email address.');
      return;
    }

    setOverviewError(null);
    setThumbnailError(null);
    try {
      const response = await updateProject({
        organization,
        project,
        configData: nextConfig,
      }).unwrap();
      if (!response.success) {
        setOverviewError(response.error || 'Failed to save project settings.');
        return;
      }
      onProjectSaved();
      onClose();
    } catch (error) {
      setOverviewError(
        apiErrorMessage(error) || 'Failed to save project settings.',
      );
    }
  };

  const saveStorage = async () => {
    if (!formState.bucket.trim() || !formState.bucket_provider.trim()) {
      setStorageError('Provider and bucket name are required.');
      return;
    }
    if (
      formState.bucket_provider.trim().toLowerCase() === 's3' &&
      (!formState.bucket_access_key.trim() ||
        !formState.bucket_secret_key.trim())
    ) {
      setStorageError('S3 access key and secret key are required.');
      return;
    }
    setStorageError(null);
    try {
      const response = await updateStorage({
        organization,
        project,
        storage: {
          access_key: formState.bucket_access_key.trim() || undefined,
          bucket: formState.bucket.trim(),
          endpoint: formState.bucket_endpoint_url.trim() || undefined,
          organization,
          organization_sub_path: formState.bucket_org_path.trim() || undefined,
          project_id: project,
          project_sub_path: formState.bucket_project_path.trim() || undefined,
          provider: formState.bucket_provider.trim(),
          region: formState.bucket_region.trim() || undefined,
          secret_key: formState.bucket_secret_key.trim() || undefined,
        },
      }).unwrap();
      if (!response.success) {
        setStorageError(
          response.error || 'Failed to save storage configuration.',
        );
        return;
      }
      onStorageSaved();
    } catch (error) {
      setStorageError(
        apiErrorMessage(error) || 'Failed to save storage configuration.',
      );
    }
  };

  return (
    <Modal
      onClose={onClose}
      opened={opened}
      size="lg"
      title={
        <div>
          <Text fw={700} size="xl">
            Edit project
          </Text>
          <Text c="dimmed" size="sm">
            {organization}/{project}
          </Text>
        </div>
      }
    >
      <Stack gap="lg">
        <div className="border-b border-slate-200 pb-4">
          <Group gap="sm" wrap="wrap">
            {readinessBadges.map((badge) => (
              <StatusPill
                key={badge.label}
                color={badge.color}
                icon={badge.icon}
                label={badge.label}
              />
            ))}
            {issues.length > 0 ? (
              <Text c="dimmed" size="sm">
                Missing:{' '}
                {issues
                  .map((issue) =>
                    issue.label
                      .replace('GitHub unconnected', 'GitHub')
                      .replace('Storage unconnected', 'Storage'),
                  )
                  .join(', ')}
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                GitHub and storage are connected for this project.
              </Text>
            )}
          </Group>
        </div>

        <Tabs onChange={setActiveTab} value={activeTab}>
          <Tabs.List>
            <Tabs.Tab value="details">Project details</Tabs.Tab>
            <Tabs.Tab value="storage">Storage</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel pt="md" value="details">
            <Stack gap="xl">
              <section>
                <div className="mt-1">
                  <Stack gap="xs">
                    <div className="grid gap-3 md:grid-cols-2">
                      <TextInput
                        label="Project title"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setFormState((current) => ({
                            ...current,
                            project_title: value,
                          }));
                        }}
                        value={formState.project_title}
                      />
                      <TextInput
                        label="Contact email"
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setFormState((current) => ({
                            ...current,
                            contact_email: value,
                          }));
                        }}
                        value={formState.contact_email}
                      />
                    </div>
                    <Textarea
                      autosize
                      label="Description"
                      minRows={2}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setFormState((current) => ({
                          ...current,
                          description: value,
                        }));
                      }}
                      value={formState.description}
                    />
                    {overviewError ? (
                      <Alert color="red" variant="light">
                        {overviewError}
                      </Alert>
                    ) : null}
                  </Stack>
                </div>
              </section>

              <ThumbnailSummary
                configured={hasExistingThumbnail}
                error={thumbnailError}
                onEdit={() => setThumbnailEditorOpen(true)}
                previewURL={thumbnailPreview}
              />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel pt="md" value="storage">
            <Stack gap="md">
              <Group gap="sm" wrap="wrap">
                <StatusPill
                  color={integrations.storage.pass ? 'green' : 'red'}
                  label={integrations.storage.pass ? 'Ready' : 'Unconnected'}
                />
                <Text c="dimmed" size="sm">
                  {integrations.storage.pass
                    ? 'Uploads are ready for this project.'
                    : 'Storage is not connected for this project.'}
                </Text>
              </Group>
              {integrations.storage.details ? (
                <Text c="dimmed" size="sm">
                  {integrations.storage.details}
                </Text>
              ) : null}
              <StorageFields
                formState={formState}
                onUpdateField={(field, value) =>
                  setFormState((current) => ({
                    ...current,
                    [field]: value,
                  }))
                }
              />
              {storageError ? (
                <Alert color="red" variant="light">
                  {storageError}
                </Alert>
              ) : null}
              <Group justify="flex-end">
                <Button
                  loading={isSavingStorage}
                  onClick={() => void saveStorage()}
                >
                  Save storage
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group className="border-t border-slate-200 pt-4" justify="flex-end">
          <Button
            className={actionButtonClassName}
            color="sky"
            loading={isSavingProject}
            onClick={() => void saveOverview()}
            variant="light"
          >
            Save project
          </Button>
        </Group>
      </Stack>
      <Modal
        onClose={() => setThumbnailEditorOpen(false)}
        opened={thumbnailEditorOpen}
        size="md"
        title="Project thumbnail"
      >
        <Stack gap="md">
          <ThumbnailField
            configured={hasExistingThumbnail}
            error={thumbnailError}
            fileName={thumbnailFile?.name}
            onFileSelected={(file) => {
              void updateThumbnailFile(file);
            }}
            onRemove={() => {
              setThumbnailFile(null);
              setThumbnailError(null);
              setThumbnailPreview('');
              setThumbnailRemoved(Boolean(thumbnailURL));
            }}
            previewURL={thumbnailPreview}
          />
          <Group justify="flex-end">
            <Button
              color="gray"
              onClick={() => setThumbnailEditorOpen(false)}
              variant="subtle"
            >
              Cancel
            </Button>
            <Button
              loading={isSavingThumbnail}
              onClick={() => void saveThumbnailChanges()}
            >
              {hasPendingThumbnailChanges ? 'Save thumbnail' : 'Done'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Modal>
  );
};

const CompactProjectRow = ({
  onThumbnailPreviewAvailable,
  status,
  organization,
  project,
  repositoryURL,
  repositoryLabel,
  thumbnail_url,
  isRefreshingConnections = false,
}: AccessibleOrganizationProject & {
  onThumbnailPreviewAvailable?: (
    thumbnailURL: string,
    previewData: string,
  ) => void;
  status?: GeckoGitOrganizationProjectStatus;
  repositoryLabel?: string;
  repositoryURL?: string;
  isRefreshingConnections?: boolean;
}) => {
  const router = useRouter();
  const localProjectHref = `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`;
  const badges = projectConnectionBadge(status, isRefreshingConnections);

  return (
    <div
      className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-slate-100 px-6 py-2.5 text-sm transition hover:bg-slate-50/80"
      onClick={() => {
        void router.push(localProjectHref);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          void router.push(localProjectHref);
        }
      }}
      role="link"
      tabIndex={0}
    >
      <div className="min-w-0">
        <Group gap="xs" wrap="nowrap">
          {thumbnail_url ? (
            <img
              alt={`${project} thumbnail`}
              className="h-5 w-5 shrink-0 rounded object-contain"
              onLoad={(event) => {
                const preview = extractThumbnailPreviewFromImage(
                  event.currentTarget,
                );
                if (preview) {
                  onThumbnailPreviewAvailable?.(thumbnail_url, preview);
                }
              }}
              src={thumbnail_url}
            />
          ) : (
            <img
              alt="Calypr"
              className="h-4 w-4 shrink-0"
              src="/icons/calypr-mark-mono.svg"
            />
          )}
          <a
            className="min-w-0 truncate font-semibold text-slate-900 transition hover:text-slate-700 hover:underline"
            href={localProjectHref}
            onClick={(event) => event.stopPropagation()}
          >
            {project}
          </a>
          <Group gap={6} wrap="wrap">
            {badges.map((badge) => (
              <Badge key={badge.label} color={badge.color} size="sm" variant="light">
                <span className="inline-flex items-center gap-1">
                  {badge.icon}
                  <span>{badge.label}</span>
                </span>
              </Badge>
            ))}
          </Group>
        </Group>
        {repositoryURL ? (
          <a
            className="inline-flex max-w-full items-center gap-1 truncate text-xs text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-slate-700"
            href={repositoryURL}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            <IconBrandGithub className="shrink-0" size={13} />
            {repositoryLabel || repositoryURL}
          </a>
        ) : null}
      </div>
      <Group gap="xs" wrap="nowrap">
        <Button
          component="a"
          href={localProjectHref}
          onClick={(event) => event.stopPropagation()}
          size="compact-sm"
          variant="subtle"
        >
          Open
        </Button>
      </Group>
    </div>
  );
};

const OrganizationRow = ({
  group,
  gitStatus,
  canManageSettings = false,
  canCreateProjects = false,
  initiallyOpen = false,
  hideCollapse = false,
  onThumbnailPreviewAvailable,
  isRefreshingConnections = false,
}: {
  group: OrganizationGroup;
  gitStatus?: GeckoGitOrganizationStatus;
  canManageSettings?: boolean;
  canCreateProjects?: boolean;
  initiallyOpen?: boolean;
  hideCollapse?: boolean;
  onThumbnailPreviewAvailable?: (
    thumbnailURL: string,
    previewData: string,
  ) => void;
  isRefreshingConnections?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const isExpanded = hideCollapse ? true : isOpen;
  const projectStatusByProject = new Map(
    (gitStatus?.projects ?? []).map((projectStatus) => [
      projectStatus.project,
      projectStatus,
    ]),
  );
  const repositoryDetailsByProject = new Map(
    (gitStatus?.projects ?? []).map((projectStatus) => {
      const hasRepository =
        Boolean(projectStatus.repository?.owner) &&
        Boolean(projectStatus.repository?.repo);
      return [
        projectStatus.project,
        {
          label: hasRepository
            ? `${projectStatus.repository.owner}/${projectStatus.repository.repo}`
            : undefined,
          url: hasRepository ? projectStatus.repository?.url : undefined,
        },
      ];
    }),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {hideCollapse ? (
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-slate-50 px-6 py-4">
          <Link href="/git" legacyBehavior>
            <a className="inline-flex w-fit items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-900">
              <IconChevronLeft size={16} />
              Organizations
            </a>
          </Link>
          <div className="min-w-0 text-center">
            <Text fw={700} size="lg" truncate>
              {group.organization}
            </Text>
          </div>
          {canManageSettings ? (
            <Link
              href={`/git/${encodeURIComponent(group.organization)}/settings`}
              legacyBehavior
            >
              <a
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium ${actionButtonClassName}`}
              >
                <IconSettings size={15} />
                Settings
              </a>
            </Link>
          ) : (
            <div />
          )}
        </div>
      ) : (
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 bg-slate-50 px-6 py-4 transition hover:bg-slate-100/80">
          <button
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${group.organization}`}
            className="inline-flex items-center justify-center border border-transparent p-1 transition hover:border-slate-200 hover:bg-white hover:shadow-sm focus-visible:border-slate-300 focus-visible:bg-white focus-visible:shadow-sm"
            onClick={() => setIsOpen((open) => !open)}
            type="button"
          >
            {isOpen ? (
              <IconChevronDown className="text-slate-500" size={18} />
            ) : (
              <IconChevronRight className="text-slate-500" size={18} />
            )}
          </button>
          <div className="min-w-0">
            <Tooltip label={`Visit ${group.organization} page`}>
              <Link
                href={`/git/${encodeURIComponent(group.organization)}`}
                legacyBehavior
              >
                <a className="inline-flex max-w-full text-left decoration-slate-400 underline-offset-4 transition hover:text-slate-700 hover:underline focus-visible:underline">
                  <Text fw={700} size="lg" truncate>
                    {group.organization}
                  </Text>
                </a>
              </Link>
            </Tooltip>
          </div>
          {canManageSettings ? (
            <Link
              href={`/git/${encodeURIComponent(group.organization)}/settings`}
              legacyBehavior
            >
              <a
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-medium ${actionButtonClassName}`}
              >
                <IconSettings size={15} />
                Settings
              </a>
            </Link>
          ) : (
            <div />
          )}
        </div>
      )}

      <Collapse in={isExpanded}>
        <div className="border-t border-slate-200 bg-white">
          {group.projects.length > 0 ? (
            group.projects.map((project) => (
              <CompactProjectRow
                key={project.resourcePath}
                {...project}
                isRefreshingConnections={isRefreshingConnections}
                onThumbnailPreviewAvailable={onThumbnailPreviewAvailable}
                repositoryLabel={
                  repositoryDetailsByProject.get(project.project)?.label
                }
                repositoryURL={
                  repositoryDetailsByProject.get(project.project)?.url
                }
                status={projectStatusByProject.get(project.project)}
              />
            ))
          ) : (
            <div className="px-6 py-3 text-sm text-slate-500">
              {canManageSettings
                ? 'You can manage this organization, but no project-level access is currently visible here.'
                : canCreateProjects
                  ? 'You can create projects in this organization, but no project-level access is currently visible here.'
                  : 'No project-level access is currently visible here.'}
            </div>
          )}
        </div>
      </Collapse>
    </div>
  );
};

const GitLandingPage = ({
  headerProps,
  footerProps,
  selectedOrganization,
}: GitExplorerPageProps & { selectedOrganization?: string }) => {
  const router = useRouter();
  const session = useSession(false);
  const isAdmin = session.user?.is_admin === true;
  const lastAutoRefreshKeyRef = useRef<string | null>(null);
  const [connectionRefreshCount, setConnectionRefreshCount] = useState(0);
  const {
    data: geckoProjects = [],
    isLoading,
    refetch: refetchGeckoProjects,
  } = useGetGeckoProjectsQuery();
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [thumbnailPreviewByURL, setThumbnailPreviewByURL] = useState<
    Record<string, string>
  >({});
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOrganization] = useConnectGeckoGitOrganizationMutation();
  const [editConnectProject] = useEditConnectGeckoGitProjectMutation();
  const [reconcileOrganization, { isLoading: isReconcilingOrganization }] =
    useReconcileGeckoGitOrganizationMutation();
  const [reconcileOrganizations, { isLoading: isReconcilingOrganizations }] =
    useReconcileGeckoGitOrganizationsMutation();
  const organizationsStatusQuery = useGetGeckoGitOrganizationsStatusQuery(
    undefined,
    {
      skip: false,
    },
  );
  const {
    data: organizationsStatus,
    isLoading: isOrganizationsStatusLoading,
  } = organizationsStatusQuery;
  const isOrganizationsStatusFetching =
    'isFetching' in organizationsStatusQuery &&
    typeof organizationsStatusQuery.isFetching === 'boolean'
      ? organizationsStatusQuery.isFetching
      : false;
  const withConnectionRefresh = useCallback(
    async (work: () => Promise<void>) => {
      setConnectionRefreshCount((current) => current + 1);
      try {
        await work();
      } finally {
        setConnectionRefreshCount((current) => Math.max(0, current - 1));
      }
    },
    [],
  );
  const isRefreshingConnections =
    connectionRefreshCount > 0 ||
    isReconcilingOrganizations ||
    isReconcilingOrganization ||
    isOrganizationsStatusLoading ||
    isOrganizationsStatusFetching;
  const callbackGitHubOwner = useMemo(() => {
    const queryOwner = router.query.github_owner;
    return typeof queryOwner === 'string' ? queryOwner.trim() : '';
  }, [router.query.github_owner]);
  const pendingGitHubCallback = useMemo(() => {
    if (!router.isReady) {
      return null;
    }
    const installationID = router.query.installation_id;
    if (typeof installationID !== 'string' || !installationID.trim()) {
      return null;
    }
    const pendingProjectConnect = loadPendingProjectConnect();
    const githubState =
      typeof router.query.state === 'string'
        ? router.query.state
        : typeof router.query.github_state === 'string'
          ? router.query.github_state
          : undefined;
    if (!githubState && !pendingProjectConnect) {
      return null;
    }
    return {
      githubState,
      installationID,
      pendingProjectConnect,
    };
  }, [
    router.isReady,
    router.query.github_state,
    router.query.installation_id,
    router.query.state,
  ]);
  const blockingGitHubCallback = pendingGitHubCallback?.pendingProjectConnect
    ? pendingGitHubCallback
    : null;
  const geckoProjectRecordByResourcePath = useMemo(
    () =>
      new Map(
        geckoProjects.map(
          (project) => [project.resourcePath, project] as const,
        ),
      ),
    [geckoProjects],
  );
  const resolveProjectRecord = useCallback(
    async (organization: string, project: string) => {
      const resourcePath = `/programs/${organization}/projects/${project}`;
      const cached = geckoProjectRecordByResourcePath.get(resourcePath);
      if (cached?.configData) {
        return cached;
      }

      const refreshed = (await refetchGeckoProjects()) as {
        data?: Array<GeckoProjectRecord>;
      };
      const refreshedProjects = Array.isArray(refreshed.data)
        ? (refreshed.data as Array<GeckoProjectRecord>)
        : [];
      return (
        refreshedProjects.find(
          (candidate) =>
            candidate.resourcePath === resourcePath && candidate.configData,
        ) || null
      );
    },
    [geckoProjectRecordByResourcePath, refetchGeckoProjects],
  );
  const accessibleProjects = useMemo(
    () =>
      extractProjectsFromResourcePaths(
        geckoProjects.map(
          (project: GeckoProjectRecord) => project.resourcePath,
        ),
      ).map((project) => ({
        ...project,
        thumbnail_url: geckoProjectRecordByResourcePath.get(
          project.resourcePath,
        )?.thumbnail_url,
      })),
    [geckoProjectRecordByResourcePath, geckoProjects],
  );
  const rememberThumbnailPreview = useCallback(
    (thumbnailURL: string, previewData: string) => {
      setThumbnailPreviewByURL((current) =>
        current[thumbnailURL] === previewData
          ? current
          : { ...current, [thumbnailURL]: previewData },
      );
    },
    [],
  );
  const forgetThumbnailPreview = useCallback((thumbnailURL: string) => {
    setThumbnailPreviewByURL((current) => {
      if (!current[thumbnailURL]) {
        return current;
      }
      const next = { ...current };
      delete next[thumbnailURL];
      return next;
    });
  }, []);
  const organizationGroups = useMemo(
    () => groupProjectsByOrganization(accessibleProjects),
    [accessibleProjects],
  );
  const membershipOrganizationOptions = useMemo(() => {
    const organizations = new Set<string>();
    Object.entries(authzMapping).forEach(([resource, perms]) => {
      const membershipResource = isOrganizationMembershipResource(resource);
      if (!membershipResource || !Array.isArray(perms)) {
        return;
      }
      if (perms.some(isOrganizationMemberOrOwnerAction)) {
        organizations.add(membershipResource.organization);
      }
    });
    return Array.from(organizations).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [authzMapping]);
  const displayOrganizationGroups = useMemo(() => {
    const groupsByOrganization = new Map(
      organizationGroups.map((group) => [group.organization, group]),
    );
    const allowedOrganizations = new Set(membershipOrganizationOptions);
    const visibleOrganizations = new Set(allowedOrganizations);

    organizationGroups.forEach((group) => {
      visibleOrganizations.add(group.organization);
    });

    return Array.from(visibleOrganizations)
      .sort((left, right) => left.localeCompare(right))
      .map(
        (organization): OrganizationGroup =>
          groupsByOrganization.get(organization) ?? {
            organization,
            projects: [],
          },
      );
  }, [membershipOrganizationOptions, organizationGroups]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const organizationStatuses = useMemo(
    () =>
      new Map(
        (organizationsStatus?.organizations ?? []).map((status) => [
          status.organization,
          status,
        ]),
      ),
    [organizationsStatus?.organizations],
  );

  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    const organizationResults = organizationGroups
      .concat(
        displayOrganizationGroups.filter(
          (candidate) =>
            !organizationGroups.some(
              (group) => group.organization === candidate.organization,
            ),
        ),
      )
      .filter((group) =>
        group.organization.toLowerCase().includes(normalizedSearchQuery),
      )
      .map((group) => ({
        href: `/git/${encodeURIComponent(group.organization)}`,
        key: `organization-${group.organization}`,
        kind: 'organization' as const,
        label: group.organization,
        sublabel:
          group.projects.length > 0
            ? pluralize(group.projects.length, 'project')
            : 'Organization access',
      }));

    const projectResults = accessibleProjects
      .filter((project) =>
        project.project.toLowerCase().includes(normalizedSearchQuery),
      )
      .map((project) => ({
        href: `/git/${encodeURIComponent(project.organization)}/project/${encodeURIComponent(project.project)}`,
        key: `project-${project.resourcePath}`,
        kind: 'project' as const,
        label: project.project,
        sublabel: project.organization,
      }));

    return [...organizationResults, ...projectResults].slice(0, 12);
  }, [
    accessibleProjects,
    displayOrganizationGroups,
    normalizedSearchQuery,
    organizationGroups,
  ]);
  const visibleOrganizationGroups = useMemo(() => {
    const scopedGroups = !selectedOrganization
      ? displayOrganizationGroups
      : displayOrganizationGroups.filter(
          (group) => group.organization === selectedOrganization,
        );

    if (!normalizedSearchQuery) {
      return scopedGroups;
    }

    return scopedGroups
      .map((group) => {
        const matchesOrganization = group.organization
          .toLowerCase()
          .includes(normalizedSearchQuery);

        if (matchesOrganization) {
          return group;
        }

        const matchingProjects = group.projects.filter((project) =>
          project.project.toLowerCase().includes(normalizedSearchQuery),
        );

        if (matchingProjects.length === 0) {
          return null;
        }

        return {
          ...group,
          projects: matchingProjects,
        };
      })
      .filter((group): group is OrganizationGroup => group !== null);
  }, [displayOrganizationGroups, normalizedSearchQuery, selectedOrganization]);

  const refreshConnections = useCallback(async () => {
    await withConnectionRefresh(async () => {
      setConnectError(null);
      await reconcileOrganizations().unwrap();
    });
  }, [
    reconcileOrganizations,
    withConnectionRefresh,
  ]);

  const refreshConnectionsForOrganization = useCallback(
    async (organization: string) => {
      const normalizedOrganization = organization.trim();
      if (!normalizedOrganization) {
        await refreshConnections();
        return;
      }
      await withConnectionRefresh(async () => {
        setConnectError(null);
        await reconcileOrganization({
          organization: normalizedOrganization,
        }).unwrap();
      });
    },
    [
      reconcileOrganization,
      refreshConnections,
      withConnectionRefresh,
    ],
  );

  const handleInitConnectResponse = useCallback(
    async (
      organization: string | null,
      response: {
        mode?: string;
        redirect_url?: string;
      },
    ) => {
      if (response.redirect_url) {
        window.location.assign(response.redirect_url);
        return;
      }
      if (organization) {
        await refreshConnectionsForOrganization(organization);
        return;
      }
      await refreshConnections();
    },
    [refreshConnections, refreshConnectionsForOrganization],
  );

  useEffect(() => {
    if (!pendingGitHubCallback) {
      return;
    }
    const { githubState, installationID, pendingProjectConnect } =
      pendingGitHubCallback;
    const refreshKey = `${installationID}:${githubState ?? ''}:${pendingProjectConnect?.organization ?? ''}:${pendingProjectConnect?.project ?? ''}`;
    if (lastAutoRefreshKeyRef.current === refreshKey) {
      return;
    }
    lastAutoRefreshKeyRef.current = refreshKey;
    const callbackReturnPath = router.asPath.split('?', 1)[0] || '/git';
    const parsedInstallationID = Number.parseInt(installationID, 10);
    const run = async () => {
      try {
        if (!Number.isFinite(parsedInstallationID)) {
          throw new Error('GitHub did not return a valid installation id.');
        }
        if (githubState || pendingProjectConnect) {
          const organization =
            pendingProjectConnect?.organization ||
            organizationFromGitHubState(githubState);
          const previousRepositoryFullName =
            normalizeRepositoryFullName(
              pendingProjectConnect?.previousRepositoryFullName,
            ) ?? '';
          const targetRepositoryFullName =
            normalizeRepositoryFullName(
              pendingProjectConnect?.targetRepositoryFullName,
            ) ?? '';
          const githubOwner =
            callbackGitHubOwner ||
            gitHubOwnerFromRepositoryFullName(
              targetRepositoryFullName || previousRepositoryFullName,
            );
          if (!organization) {
            throw new Error(
              'GitHub callback did not include a Calypr organization.',
            );
          }
          if (!githubOwner) {
            throw new Error('GitHub callback did not include a GitHub owner.');
          }
          const response = await connectOrganization({
            githubOwner,
            organization,
            installationId: parsedInstallationID,
          }).unwrap();
          const repositories = response.repositories ?? [];
          const previousRepositoryPresent = repositoryPresentInInstallation(
            repositories,
            previousRepositoryFullName,
          );
          const targetRepositoryPresent = repositoryPresentInInstallation(
            repositories,
            targetRepositoryFullName,
          );
          if (pendingProjectConnect && targetRepositoryFullName) {
            if (!targetRepositoryPresent) {
              throw new Error(
                `GitHub App is not connected to repository "${targetRepositoryFullName}".`,
              );
            }
            await editConnectProject({
              organization: pendingProjectConnect.organization,
              project: pendingProjectConnect.project,
              repositoryFullName: targetRepositoryFullName,
            }).unwrap();
            clearPendingProjectConnect();
          } else if (
            pendingProjectConnect &&
            previousRepositoryFullName &&
            !previousRepositoryPresent
          ) {
            await editConnectProject({
              organization: pendingProjectConnect.organization,
              project: pendingProjectConnect.project,
              repositoryFullName: '',
            }).unwrap();
            clearPendingProjectConnect();
          } else if (
            pendingProjectConnect &&
            previousRepositoryFullName &&
            previousRepositoryPresent
          ) {
            throw new Error(
              `Repository "${previousRepositoryFullName}" is still installed in GitHub. Remove it from the GitHub App installation to disconnect this project.`,
            );
          }
          await handleInitConnectResponse(organization, response);
          void router.replace(callbackReturnPath, undefined, { shallow: true });
        } else {
          await refreshConnections();
          void router.replace(callbackReturnPath, undefined, { shallow: true });
        }
      } catch (error) {
        clearPendingProjectConnect();
        setConnectError(
          apiErrorMessage(error) || 'Failed to finalize the GitHub connection.',
        );
        await refreshConnections().catch(() => undefined);
        void router.replace(callbackReturnPath, undefined, { shallow: true });
      }
    };
    void run();
  }, [
    callbackGitHubOwner,
    editConnectProject,
    handleInitConnectResponse,
    connectOrganization,
    pendingGitHubCallback,
    refreshConnectionsForOrganization,
    refreshConnections,
    router,
    router.asPath,
    router.replace,
  ]);

  const hasReconciled = useRef(false);
  useEffect(() => {
    if (hasReconciled.current || blockingGitHubCallback) {
      return;
    }
    hasReconciled.current = true;
    void refreshConnections();
    // eslint-disable-next-line reactHooks/exhaustive-deps
  }, [blockingGitHubCallback]);

  const handleRefreshConnections = async () => {
    try {
      await refreshConnections();
    } catch (error) {
      setConnectError(
        apiErrorMessage(error) ||
          'Failed to refresh GitHub and storage connections.',
      );
    }
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: 'Gecko git project explorer',
        key: 'gecko-git-project-explorer',
        title: 'Git Project Explorer',
      }}
      mainProps={{ className: 'bg-[#f4f6f8]' }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f4f6f8]">
          <Container maw={1600} px="2.5rem" py="xl">
            <Stack gap="lg">
              {blockingGitHubCallback ? (
                <div className="flex min-h-[70vh] items-center justify-center px-6 py-12">
                  <div className="max-w-xl text-center">
                    <Text className="text-2xl font-semibold text-slate-900">
                      Finalizing your GitHub connection
                    </Text>
                    <Text className="mt-3 text-base leading-7 text-slate-600">
                      Please wait a moment...
                    </Text>
                    <div className="mt-8 flex justify-center">
                      <Loader color="blue" size="md" />
                    </div>
                  </div>
                </div>
              ) : null}
              {!blockingGitHubCallback ? (
                <>
                  <section className="border-b border-slate-200 pb-5">
                    <div className="flex items-center justify-between gap-6">
                      <div className="min-w-0">
                        <Link href="/git" legacyBehavior>
                          <a className="inline-flex items-center gap-2 text-xl font-bold text-slate-900 transition hover:text-slate-600">
                            <IconBrandGit size={22} />
                            Git
                          </a>
                        </Link>
                        <Text c="dimmed" size="sm">
                          Manage project repositories, GitHub connections, and
                          project setup across your Calypr organizations.
                        </Text>
                      </div>
                      <div className="flex w-full max-w-5xl items-center justify-end gap-3">
                        <Popover
                          opened={normalizedSearchQuery.length > 0}
                          position="bottom-end"
                          shadow="md"
                          width={360}
                          withinPortal
                        >
                          <Popover.Target>
                            <TextInput
                              className="w-full max-w-md [&_input]:border-slate-300 [&_input]:bg-white [&_input]:shadow-sm"
                              leftSection={<IconSearch size={16} />}
                              onChange={(event) =>
                                setSearchQuery(event.currentTarget.value)
                              }
                              placeholder="Search organizations or projects"
                              rightSection={
                                searchQuery ? (
                                  <ActionIcon
                                    aria-label="Clear git project search"
                                    onClick={() => setSearchQuery('')}
                                    size="sm"
                                    variant="subtle"
                                  >
                                    <IconX size={14} />
                                  </ActionIcon>
                                ) : null
                              }
                              size="sm"
                              value={searchQuery}
                            />
                          </Popover.Target>
                          <Popover.Dropdown p={0}>
                            <div className="max-h-[24rem] overflow-y-auto py-2">
                              {searchResults.length > 0 ? (
                                searchResults.map((result) => (
                                  <Link
                                    href={result.href}
                                    key={result.key}
                                    legacyBehavior
                                  >
                                    <a
                                      className="flex items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                      onClick={() => setSearchQuery('')}
                                    >
                                      {result.kind === 'organization' ? (
                                        <IconBuildingBank
                                          className="mt-0.5 text-slate-500"
                                          size={16}
                                        />
                                      ) : (
                                        <IconFolder
                                          className="mt-0.5 text-emerald-700"
                                          size={16}
                                        />
                                      )}
                                      <div className="min-w-0">
                                        <Text fw={600} size="sm">
                                          {result.label}
                                        </Text>
                                        <Text
                                          c="dimmed"
                                          className="truncate"
                                          size="xs"
                                        >
                                          {result.sublabel}
                                        </Text>
                                      </div>
                                    </a>
                                  </Link>
                                ))
                              ) : (
                                <Text
                                  c="dimmed"
                                  className="px-3 py-3"
                                  size="sm"
                                >
                                  No organizations or projects match “
                                  {searchQuery}
                                  ”.
                                </Text>
                              )}
                            </div>
                          </Popover.Dropdown>
                        </Popover>

                        <Button
                          className={actionButtonClassName}
                          color="sky"
                          leftSection={<IconPlus size={16} />}
                          onClick={() =>
                            void router.push(
                              selectedOrganization
                                ? `/git/new?org=${encodeURIComponent(selectedOrganization)}`
                                : '/git/new',
                            )
                          }
                          variant="light"
                        >
                          Create project
                        </Button>
                      </div>
                    </div>
                  </section>

                  {connectError ? (
                    <Alert color="red" variant="light">
                      {connectError}
                    </Alert>
                  ) : null}

                  {isLoading ? (
                    <section className="border-b border-slate-200 bg-white px-6 py-4">
                      <Text c="dimmed" size="sm">
                        Loading Gecko project tree...
                      </Text>
                    </section>
                  ) : visibleOrganizationGroups.length === 0 ? (
                    <section className="border-b border-slate-200 bg-white px-6 py-4">
                      <Text fw={700}>
                        {normalizedSearchQuery
                          ? 'No matching organizations or projects'
                          : 'No Gecko projects found'}
                      </Text>
                      <Text c="dimmed" className="mt-1" size="sm">
                        {normalizedSearchQuery
                          ? 'Try a different search term.'
                          : 'No organizations or project-scoped resources are currently visible for this account.'}
                      </Text>
                    </section>
                  ) : (
                    <section className="space-y-4">
                      {visibleOrganizationGroups.map((group) => (
                        <OrganizationRow
                          canCreateProjects={canCreateProjectsInOrganization(
                            authzMapping,
                            group.organization,
                            organizationStatuses.get(group.organization),
                            isAdmin,
                          )}
                          canManageSettings={canManageOrganizationSettings(
                            authzMapping,
                            group.organization,
                            organizationStatuses.get(group.organization),
                            isAdmin,
                          )}
                          group={group}
                          gitStatus={organizationStatuses.get(
                            group.organization,
                          )}
                          initiallyOpen
                          isRefreshingConnections={isRefreshingConnections}
                          hideCollapse={
                            group.organization === selectedOrganization
                          }
                          key={group.organization}
                          onThumbnailPreviewAvailable={rememberThumbnailPreview}
                        />
                      ))}
                    </section>
                  )}
                </>
              ) : null}
            </Stack>
          </Container>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitLandingPage;
