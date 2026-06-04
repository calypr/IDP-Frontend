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
  GeckoGitProjectStatus,
  GeckoProjectConfig,
  GeckoProjectRecord,
  GeckoGitOrganizationProjectStatus,
} from '@gen3/core';
import {
  useConnectGeckoGitOrganizationMutation,
  useCreateGeckoProjectMutation,
  useDeleteGeckoProjectThumbnailMutation,
  useGetAuthzMappingsQuery,
  useGetGeckoGitProjectsQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectThumbnailQuery,
  useGetGeckoProjectsQuery,
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
import type { GitExplorerPageProps } from './types';

const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const actionButtonClassName =
  'border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900';

const gitHubReturnSignalKey = 'gecko:git-github-return';

const buildGitHubConnectReturnPath = (): string => '/git/github-return';

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
const minThumbnailPixels = 500;
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
  isAdmin = false,
): boolean => {
  if (isAdmin) {
    return true;
  }
  const candidatePaths = [`/programs/${organization}`, '/programs', '/', '*'];
  return candidatePaths.some((path) =>
    (authzMapping[path] ?? []).some(
      (action) =>
        actionMatches(action, 'arborist', 'manage-owners') ||
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
  src_repo: '',
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
      label: 'GitHub is not connected',
      details: integrations.github.details,
    });
  }
  if (!integrations.storage.pass) {
    issues.push({
      key: 'storage',
      label: 'Storage is not configured',
      details: integrations.storage.details,
    });
  }
  return issues;
};

const integrationIssueBadgeLabel = (
  issues: Array<{ key: 'github' | 'storage'; label: string }>,
): string => {
  const keys = issues.map((issue) => issue.key);
  if (keys.includes('github') && keys.includes('storage')) {
    return 'GitHub + storage';
  }
  if (keys.includes('github')) {
    return 'GitHub missing';
  }
  if (keys.includes('storage')) {
    return 'Storage missing';
  }
  return 'Needs attention';
};

const ThumbnailField = ({
  error,
  fileName,
  onFileSelected,
  onRemove,
  previewURL,
}: {
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
      Optional. PNG or JPG only, between 500x500 and 3000x3000 pixels, and under
      1MB. Stored by Gecko on persistent project storage and served separately
      from the project config.
    </Text>
    <Group align="flex-start" gap="md" wrap="nowrap">
      <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
        {previewURL ? (
          <img
            alt="Project thumbnail preview"
            className="h-full w-full object-cover"
            src={previewURL}
          />
        ) : (
          <Text c="dimmed" size="xs">
            No thumbnail
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
  onEdit,
  previewURL,
}: {
  onEdit: () => void;
  previewURL?: string;
}) => (
  <section className="border-t border-slate-200 pt-6">
    <SectionHeader
      action={
        <Button
          className={actionButtonClassName}
          color="sky"
          onClick={onEdit}
          size="sm"
          variant="light"
        >
          Edit thumbnail
        </Button>
      }
      body={
        <Group gap="sm" wrap="nowrap">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
            {previewURL ? (
              <img
                alt="Project thumbnail preview"
                className="h-full w-full object-cover"
                src={previewURL}
              />
            ) : (
              <Text c="dimmed" size="xs">
                None
              </Text>
            )}
          </div>
          <Text c="dimmed" size="sm">
            {previewURL
              ? 'Thumbnail configured.'
              : 'No thumbnail yet. Add one later if you want a project image.'}
          </Text>
        </Group>
      }
      title="Project thumbnail"
    />
  </section>
);

const StatusPill = ({
  color,
  label,
}: {
  color: 'gray' | 'green' | 'red' | 'sky';
  label: string;
}) => (
  <span
    className={[
      'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-[0.04em] uppercase',
      color === 'green'
        ? 'bg-emerald-50 text-emerald-700'
        : color === 'red'
          ? 'bg-rose-50 text-rose-700'
          : color === 'sky'
            ? 'bg-sky-50 text-sky-700'
            : 'bg-slate-100 text-slate-600',
    ].join(' ')}
  >
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

const CreateProjectModal = ({
  allowDismiss = true,
  existingOrganizations = [],
  initialFormState,
  onClose,
  onCreated,
  opened,
  organization,
}: {
  allowDismiss?: boolean;
  existingOrganizations?: Array<string>;
  initialFormState?: CreateProjectFormState;
  onClose: () => void;
  onCreated: () => void;
  opened: boolean;
  organization: string;
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
    resetForm();
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
      handleClose();
      return;
    }
    const trimmedOrganization =
      toSlug(formState.org_title) || formState.org_title.trim();
    const trimmedProjectKey = toSlug(formState.project_name);
    const configData: GeckoProjectConfig = {
      contact_email: formState.contact_email.trim(),
      description: formState.description.trim(),
      icon_name: formState.icon_name.trim(),
      org_title: trimmedOrganization,
      project_title: formState.project_title.trim(),
      src_repo: formState.src_repo.trim(),
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
            setSubmitError(
              'Project was created, but the thumbnail upload failed. You can reopen Edit project and try again.',
            );
            onCreated();
            return;
          }
        } catch (error) {
          setCreatedProjectKey(submittedResourceKey);
          setSubmitError(
            `Project was created, but the thumbnail upload failed: ${
              apiErrorMessage(error) || 'Unknown error'
            }`,
          );
          onCreated();
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
      <Stack gap="lg">
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
                          updateField(
                            'project_title',
                            event.currentTarget.value,
                          )
                        }
                        placeholder="Human-readable project label"
                        value={formState.project_title}
                      />
                      <TextInput
                        error={fieldErrors.contact_email}
                        label="Contact email"
                        onChange={(event) =>
                          updateField(
                            'contact_email',
                            event.currentTarget.value,
                          )
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
              <StorageFields
                formState={formState}
                onUpdateField={updateField}
              />
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
              {createdProjectKey ? 'Done' : 'Create project'}
            </Button>
          </Group>
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
    </Modal>
  );
};

const ProjectManagementModal = ({
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
}) => {
  const [activeTab, setActiveTab] = useState<string | null>('details');
  const [thumbnailEditorOpen, setThumbnailEditorOpen] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');
  const [thumbnailRemoved, setThumbnailRemoved] = useState(false);
  const [formState, setFormState] = useState(() =>
    defaultProjectConfig(organization),
  );
  const [updateProject, { isLoading: isSavingProject }] =
    useUpdateGeckoProjectMutation();
  const [uploadThumbnail, { isLoading: isUploadingThumbnail }] =
    useUploadGeckoProjectThumbnailMutation();
  const [deleteThumbnail, { isLoading: isDeletingThumbnail }] =
    useDeleteGeckoProjectThumbnailMutation();
  const [updateStorage, { isLoading: isSavingStorage }] =
    useUpdateGeckoProjectStorageMutation();
  const {
    data: existingThumbnail,
    isFetching: isFetchingThumbnail,
    refetch: refetchThumbnail,
  } = useGetGeckoProjectThumbnailQuery(
    { organization, project },
    { skip: !opened },
  );
  const integrations = projectIntegrations(status);

  useEffect(() => {
    setActiveTab('details');
    setThumbnailEditorOpen(false);
    setOverviewError(null);
    setStorageError(null);
    setThumbnailError(null);
    setThumbnailFile(null);
    setThumbnailPreview('');
    setThumbnailRemoved(false);
    setFormState({
      ...defaultProjectConfig(organization),
      contact_email: config?.contact_email || '',
      description: config?.description || '',
      icon_name: config?.icon_name || 'binoculars',
      org_title: config?.org_title || organization,
      project_name: project,
      project_title: config?.project_title || project,
      src_repo: config?.src_repo || repositoryURL || repositoryLabel || '',
    });
  }, [config, opened, organization, project, repositoryLabel, repositoryURL]);

  useEffect(() => {
    if (!opened || thumbnailFile || thumbnailRemoved) {
      return;
    }
    setThumbnailPreview(existingThumbnail?.data_url || '');
  }, [existingThumbnail, opened, thumbnailFile, thumbnailRemoved]);

  const issues = integrationIssuesForProject(status);

  const updateThumbnailFile = async (file: File | null): Promise<void> => {
    if (!file) {
      setThumbnailFile(null);
      setThumbnailPreview(
        thumbnailRemoved ? '' : existingThumbnail?.data_url || '',
      );
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

  const saveOverview = async () => {
    const nextConfig: GeckoProjectConfig = {
      contact_email: formState.contact_email.trim(),
      description: formState.description.trim(),
      icon_name: formState.icon_name.trim() || 'binoculars',
      org_title: organization,
      project_title: formState.project_title.trim(),
      src_repo: formState.src_repo.trim(),
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

      if (thumbnailRemoved && existingThumbnail) {
        const deleteResponse = await deleteThumbnail({
          organization,
          project,
        }).unwrap();
        if (!deleteResponse.success) {
          setThumbnailError('Failed to remove project thumbnail.');
          return;
        }
      } else if (thumbnailFile) {
        const uploadResponse = await uploadThumbnail({
          file: thumbnailFile,
          organization,
          project,
        }).unwrap();
        if (!uploadResponse.success) {
          setThumbnailError('Failed to upload project thumbnail.');
          return;
        }
      }

      setThumbnailFile(null);
      setThumbnailRemoved(false);
      await refetchThumbnail();
      onProjectSaved();
    } catch (error) {
      const message =
        apiErrorMessage(error) || 'Failed to save project settings.';
      if (message.toLowerCase().includes('thumbnail')) {
        setThumbnailError(message);
        return;
      }
      setOverviewError(message);
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
            <StatusPill
              color={issues.length > 0 ? 'red' : 'green'}
              label={issues.length > 0 ? 'Incomplete' : 'Connected'}
            />
            {issues.length > 0 ? (
              <Text c="dimmed" size="sm">
                Missing:{' '}
                {issues
                  .map((issue) =>
                    issue.label
                      .replace('GitHub is not connected', 'GitHub')
                      .replace('Storage is not configured', 'Storage'),
                  )
                  .join(', ')}
              </Text>
            ) : (
              <Text c="dimmed" size="sm">
                GitHub and storage are configured for this project.
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
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            project_title: event.currentTarget.value,
                          }))
                        }
                        value={formState.project_title}
                      />
                      <TextInput
                        label="Contact email"
                        onChange={(event) =>
                          setFormState((current) => ({
                            ...current,
                            contact_email: event.currentTarget.value,
                          }))
                        }
                        value={formState.contact_email}
                      />
                    </div>
                    <Textarea
                      autosize
                      label="Description"
                      minRows={2}
                      onChange={(event) =>
                        setFormState((current) => ({
                          ...current,
                          description: event.currentTarget.value,
                        }))
                      }
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
                  label={integrations.storage.pass ? 'Connected' : 'Missing'}
                />
                <Text c="dimmed" size="sm">
                  {integrations.storage.pass
                    ? 'Uploads are configured for this project.'
                    : 'Uploads are not configured yet.'}
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
            loading={
              isSavingProject ||
              isUploadingThumbnail ||
              isDeletingThumbnail ||
              isFetchingThumbnail
            }
            onClick={() => void saveOverview()}
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
            error={thumbnailError}
            fileName={thumbnailFile?.name}
            onFileSelected={(file) => {
              void updateThumbnailFile(file);
            }}
            onRemove={() => {
              setThumbnailFile(null);
              setThumbnailError(null);
              setThumbnailPreview('');
              setThumbnailRemoved(Boolean(existingThumbnail));
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
    </Modal>
  );
};

const CompactProjectRow = ({
  status,
  organization,
  onManageProject,
  project,
  repositoryURL,
  repositoryLabel,
  isRefreshingConnections = false,
}: AccessibleOrganizationProject & {
  status?: GeckoGitOrganizationProjectStatus;
  onManageProject: (
    organization: string,
    project: string,
    status?: GeckoGitOrganizationProjectStatus,
  ) => void;
  repositoryLabel?: string;
  repositoryURL?: string;
  isRefreshingConnections?: boolean;
}) => {
  const router = useRouter();
  const localProjectHref = `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`;
  const issues = integrationIssuesForProject(status);
  const isHealthy = Boolean(status) && issues.length === 0;

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
          <img
            alt="Calypr"
            className="h-4 w-4 shrink-0"
            src="/icons/calypr-mark-mono.svg"
          />
          <a
            className="min-w-0 truncate font-semibold text-slate-900 transition hover:text-slate-700 hover:underline"
            href={localProjectHref}
            onClick={(event) => event.stopPropagation()}
          >
            {project}
          </a>
          {isRefreshingConnections ? (
            <Badge color="gray" size="sm" variant="light">
              Refreshing...
            </Badge>
          ) : (
            <Badge
              color={isHealthy ? 'green' : 'red'}
              size="sm"
              variant="light"
            >
              {isHealthy ? 'Connected' : integrationIssueBadgeLabel(issues)}
            </Badge>
          )}
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
          color="gray"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onManageProject(organization, project, status);
          }}
          size="compact-sm"
          variant="subtle"
        >
          Edit
        </Button>
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
  initiallyOpen = false,
  hideCollapse = false,
  onManageProject,
  isRefreshingConnections = false,
}: {
  group: OrganizationGroup;
  gitStatus?: GeckoGitOrganizationStatus;
  canManageSettings?: boolean;
  initiallyOpen?: boolean;
  hideCollapse?: boolean;
  onManageProject: (
    organization: string,
    project: string,
    status?: GeckoGitOrganizationProjectStatus,
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
                onManageProject={onManageProject}
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
              You can manage this organization, but no project-level access is
              currently visible here.
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
  const {
    data: geckoProjects = [],
    isLoading,
    refetch: refetchGeckoProjects,
  } = useGetGeckoProjectsQuery();
  const { data: gitProjects = [], refetch: refetchGitProjects } =
    useGetGeckoGitProjectsQuery();
  const { data: authzMapping = {}, refetch: refetchAuthzMapping } =
    useGetAuthzMappingsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [connectChooserOpen, setConnectChooserOpen] = useState(false);
  const [manageProject, setManageProject] = useState<{
    organization: string;
    project: string;
    status?: GeckoGitOrganizationProjectStatus;
  } | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOrganization] = useConnectGeckoGitOrganizationMutation();
  const [reconcileOrganizations, { isLoading: isRefreshingConnections }] =
    useReconcileGeckoGitOrganizationsMutation();
  const { data: organizationsStatus, refetch: refetchOrganizationsStatus } =
    useGetGeckoGitOrganizationsStatusQuery(undefined, {
      skip: false,
    });
  const accessibleProjects = useMemo(
    () =>
      extractProjectsFromResourcePaths(
        geckoProjects.map(
          (project: GeckoProjectRecord) => project.resourcePath,
        ),
      ),
    [geckoProjects],
  );
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
    (organizationsStatus?.organizations ?? []).forEach((status) => {
      if (allowedOrganizations.has(status.organization)) {
        visibleOrganizations.add(status.organization);
      }
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
  }, [
    membershipOrganizationOptions,
    organizationGroups,
    organizationsStatus?.organizations,
  ]);
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
  const manageableOrganizationOptions = useMemo(() => {
    const organizations = new Set<string>();
    displayOrganizationGroups.forEach((group) => {
      if (
        canManageOrganizationSettings(authzMapping, group.organization, isAdmin)
      ) {
        organizations.add(group.organization);
      }
    });
    (organizationsStatus?.organizations ?? []).forEach((status) => {
      if (
        canManageOrganizationSettings(
          authzMapping,
          status.organization,
          isAdmin,
        )
      ) {
        organizations.add(status.organization);
      }
    });
    return Array.from(organizations).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [
    authzMapping,
    displayOrganizationGroups,
    isAdmin,
    organizationsStatus?.organizations,
  ]);
  const githubConnectTargets = useMemo(() => {
    const displayGroupsByOrganization = new Map(
      displayOrganizationGroups.map((group) => [group.organization, group]),
    );
    const targets = manageableOrganizationOptions.flatMap((organization) => {
      const visibleGroup = displayGroupsByOrganization.get(organization);
      const statusProjects =
        organizationStatuses.get(organization)?.projects ?? [];
      const targetsByProjectID = new Map<
        string,
        {
          organization: string;
          project: string;
          projectID: string;
          repoLabel?: string;
          needsConnection: boolean;
          statusDetails?: string;
        }
      >();

      statusProjects.forEach((projectStatus) => {
        const github = projectIntegrations(projectStatus).github;
        const hasRepository =
          Boolean(projectStatus.repository?.owner) &&
          Boolean(projectStatus.repository?.repo);
        const projectID = `${organization}/${projectStatus.project}`;
        targetsByProjectID.set(projectID, {
          organization,
          project: projectStatus.project,
          projectID,
          repoLabel: hasRepository
            ? `${projectStatus.repository.owner}/${projectStatus.repository.repo}`
            : undefined,
          needsConnection: !github.pass,
          statusDetails: github.details,
        });
      });

      (visibleGroup?.projects ?? []).forEach((project) => {
        const projectID = `${organization}/${project.project}`;
        if (targetsByProjectID.has(projectID)) {
          return;
        }
        targetsByProjectID.set(projectID, {
          organization,
          project: project.project,
          projectID,
          needsConnection: true,
          statusDetails: 'GitHub connection status is unavailable.',
        });
      });

      return Array.from(targetsByProjectID.values());
    });

    const filteredTargets = selectedOrganization
      ? targets.filter((target) => target.organization === selectedOrganization)
      : targets;

    return filteredTargets.sort((left, right) => {
      if (left.needsConnection !== right.needsConnection) {
        return left.needsConnection ? -1 : 1;
      }
      if (left.organization !== right.organization) {
        return left.organization.localeCompare(right.organization);
      }
      return left.project.localeCompare(right.project);
    });
  }, [
    displayOrganizationGroups,
    manageableOrganizationOptions,
    organizationStatuses,
    selectedOrganization,
  ]);
  const gitProjectDetailsByID = useMemo(
    () =>
      new Map(
        gitProjects.map((projectStatus: GeckoGitProjectStatus) => [
          projectStatus.project_id,
          projectStatus,
        ]),
      ),
    [gitProjects],
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
    setConnectError(null);
    await reconcileOrganizations().unwrap();
    await Promise.all([
      refetchOrganizationsStatus(),
      refetchGeckoProjects(),
      refetchAuthzMapping(),
    ]);
  }, [
    reconcileOrganizations,
    refetchAuthzMapping,
    refetchGeckoProjects,
    refetchOrganizationsStatus,
  ]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }
    const setupAction = router.query.setup_action;
    const installationID = router.query.installation_id;
    if (setupAction !== 'update' || typeof installationID !== 'string') {
      return;
    }
    const refreshKey = `${setupAction}:${installationID}`;
    if (lastAutoRefreshKeyRef.current === refreshKey) {
      return;
    }
    lastAutoRefreshKeyRef.current = refreshKey;
    const run = async () => {
      try {
        await refreshConnections();
      } catch (error) {
        setConnectError(
          apiErrorMessage(error) ||
            'Failed to refresh GitHub and storage connections.',
        );
      } finally {
        void router.replace('/git', undefined, { shallow: true });
      }
    };
    void run();
  }, [refreshConnections, router]);

  useEffect(() => {
    const handleStorageSignal = (event: StorageEvent) => {
      if (event.key !== gitHubReturnSignalKey || !event.newValue) {
        return;
      }
      void refreshConnections().catch((error) => {
        setConnectError(
          apiErrorMessage(error) ||
            'Failed to refresh GitHub and storage connections.',
        );
      });
    };
    window.addEventListener('storage', handleStorageSignal);
    return () => {
      window.removeEventListener('storage', handleStorageSignal);
    };
  }, [refreshConnections]);

  const handleOrganizationConnectFor = async (organization: string) => {
    setConnectError(null);
    setConnectChooserOpen(false);
    try {
      const response = await connectOrganization({
        organization,
        redirectPath: buildGitHubConnectReturnPath(),
      }).unwrap();
      window.location.assign(response.redirect_url);
    } catch (error) {
      setConnectError(
        apiErrorMessage(error) ||
          'Failed to start the GitHub App installation flow.',
      );
    }
  };

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
                            <Text c="dimmed" className="px-3 py-3" size="sm">
                              No organizations or projects match “{searchQuery}
                              ”.
                            </Text>
                          )}
                        </div>
                      </Popover.Dropdown>
                    </Popover>
                    <Popover
                      onChange={setConnectChooserOpen}
                      opened={connectChooserOpen}
                      position="bottom-end"
                      shadow="md"
                      width={300}
                      withinPortal
                    >
                      <Popover.Target>
                        <Button
                          className={actionButtonClassName}
                          color="sky"
                          onClick={() =>
                            setConnectChooserOpen((current) => !current)
                          }
                          variant="light"
                        >
                          Connect GitHub
                        </Button>
                      </Popover.Target>
                      <Popover.Dropdown p="sm">
                        <Stack gap={6}>
                          <Text fw={600} size="sm">
                            GitHub connection targets
                          </Text>
                          <Text c="dimmed" size="xs">
                            Select the Calypr project you want to fix. Gecko
                            will open the GitHub settings for that
                            project&apos;s organization.
                          </Text>
                          {githubConnectTargets.length > 0 ? (
                            githubConnectTargets.map((target) => (
                              <button
                                className="rounded-md px-2 py-1.5 text-left transition hover:bg-slate-50"
                                disabled={isRefreshingConnections}
                                key={target.projectID}
                                onClick={() => {
                                  void handleOrganizationConnectFor(
                                    target.organization,
                                  );
                                }}
                                type="button"
                              >
                                <Group
                                  align="center"
                                  justify="space-between"
                                  wrap="nowrap"
                                >
                                  <div className="min-w-0">
                                    <Text fw={600} size="sm">
                                      {target.project}
                                    </Text>
                                    <Text c="dimmed" size="xs">
                                      {target.organization}
                                    </Text>
                                    {target.repoLabel ? (
                                      <Text
                                        c="dimmed"
                                        className="truncate"
                                        size="xs"
                                      >
                                        {target.repoLabel}
                                      </Text>
                                    ) : null}
                                  </div>
                                  <Group gap={6} wrap="nowrap">
                                    {isRefreshingConnections ? (
                                      <Badge
                                        color="gray"
                                        size="xs"
                                        variant="light"
                                      >
                                        Refreshing...
                                      </Badge>
                                    ) : target.needsConnection ? (
                                      <Badge
                                        color="red"
                                        size="xs"
                                        variant="light"
                                      >
                                        Needs GitHub
                                      </Badge>
                                    ) : (
                                      <Badge
                                        color="green"
                                        size="xs"
                                        variant="light"
                                      >
                                        Connected
                                      </Badge>
                                    )}
                                    <IconChevronRight
                                      className="text-slate-400"
                                      size={14}
                                    />
                                  </Group>
                                </Group>
                              </button>
                            ))
                          ) : (
                            <Text c="dimmed" size="sm">
                              No manageable projects are available.
                            </Text>
                          )}
                        </Stack>
                      </Popover.Dropdown>
                    </Popover>
                    {!selectedOrganization ? (
                      <Button
                        className={actionButtonClassName}
                        color="sky"
                        loading={isRefreshingConnections}
                        onClick={() => {
                          void handleRefreshConnections();
                        }}
                        variant="light"
                      >
                        Refresh connections
                      </Button>
                    ) : (
                      <Button
                        className={actionButtonClassName}
                        color="sky"
                        loading={isRefreshingConnections}
                        onClick={() => {
                          void handleRefreshConnections();
                        }}
                        variant="light"
                      >
                        Refresh
                      </Button>
                    )}
                    <Button
                      className={actionButtonClassName}
                      color="sky"
                      leftSection={<IconPlus size={16} />}
                      onClick={() => setCreateModalOpen(true)}
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
                      canManageSettings={canManageOrganizationSettings(
                        authzMapping,
                        group.organization,
                        isAdmin,
                      )}
                      group={group}
                      gitStatus={organizationStatuses.get(group.organization)}
                      initiallyOpen
                      isRefreshingConnections={isRefreshingConnections}
                      hideCollapse={group.organization === selectedOrganization}
                      key={group.organization}
                      onManageProject={(organization, project, status) =>
                        setManageProject({ organization, project, status })
                      }
                    />
                  ))}
                </section>
              )}
            </Stack>
          </Container>
          {createModalOpen ? (
            <CreateProjectModal
              existingOrganizations={membershipOrganizationOptions}
              onClose={() => setCreateModalOpen(false)}
              onCreated={() => {
                void Promise.all([
                  refetchOrganizationsStatus(),
                  refetchGeckoProjects(),
                  refetchAuthzMapping(),
                ]);
              }}
              opened={createModalOpen}
              organization={selectedOrganization || ''}
            />
          ) : null}
          {manageProject ? (
            <ProjectManagementModal
              config={
                gitProjectDetailsByID.get(
                  `${manageProject.organization}/${manageProject.project}`,
                )?.config
              }
              onClose={() => setManageProject(null)}
              onProjectSaved={() => {
                void Promise.all([
                  refetchOrganizationsStatus(),
                  refetchGeckoProjects(),
                  refetchGitProjects(),
                ]);
              }}
              onStorageSaved={() => {
                void handleRefreshConnections();
              }}
              opened
              organization={manageProject.organization}
              project={manageProject.project}
              repositoryLabel={
                manageProject.status?.repository
                  ? `${manageProject.status.repository.owner}/${manageProject.status.repository.repo}`
                  : undefined
              }
              repositoryURL={manageProject.status?.repository?.url}
              status={manageProject.status}
            />
          ) : null}
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitLandingPage;
