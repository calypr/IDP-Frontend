import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Popover,
  Select,
  Stack,
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
} from '@gen3/core';
import {
  useConnectGeckoGitOrganizationMutation,
  useCreateAuthzOwnedDescendantMutation,
  useCreateGeckoProjectMutation,
  useGetAuthzMappingsQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectsQuery,
  useLazyGetGeckoGitPendingRepositoriesQuery,
  useReconcileGeckoGitPendingRepositoriesMutation,
} from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
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

const pendingActionButtonClassName =
  'border border-amber-300 bg-amber-100 text-amber-900 shadow-sm transition hover:border-amber-400 hover:bg-amber-200';

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

interface PendingRepositoryDraft {
  readonly id: string;
  readonly organization: string;
  readonly repo_clone_url?: string;
  readonly repo_full_name: string;
  readonly repo_name: string;
}

const buildGitHubConnectReturnPath = (): string => '/git';

const parseGitSetupSessionID = (
  state: string | string[] | undefined,
): string | null => {
  if (typeof state !== 'string') {
    return null;
  }
  const prefix = 'gecko_git_setup:';
  return state.startsWith(prefix) ? state.slice(prefix.length) || null : null;
};

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value.trim());

const apiErrorStatus = (error: unknown): number | undefined => {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
};

const apiErrorMessage = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  if (
    'error' in error &&
    typeof (error as { error?: unknown }).error === 'string'
  ) {
    return (error as { error: string }).error;
  }
  if ('data' in error) {
    const data = (error as { data?: unknown }).data;
    if (typeof data === 'string') {
      return data;
    }
    if (data && typeof data === 'object') {
      const nestedError = (data as { error?: unknown }).error;
      if (nestedError && typeof nestedError === 'object') {
        const message = (nestedError as { message?: unknown }).message;
        if (typeof message === 'string') {
          return message;
        }
      }
      const message = (data as { message?: unknown }).message;
      if (typeof message === 'string') {
        return message;
      }
    }
  }
  return undefined;
};

const isExistingAuthzResourceError = (error: unknown): boolean =>
  apiErrorStatus(error) === 409 &&
  (apiErrorMessage(error) ?? '').includes('resource already exists:');

const joinStoragePath = (
  organizationPath: string,
  projectPath: string,
): string | undefined => {
  const segments = [organizationPath, projectPath]
    .map((segment) => segment.trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);

  return segments.length > 0 ? segments.join('/') : undefined;
};

const getOrganizationStatusColor = (status?: string): string => {
  switch (status) {
    case 'connected':
      return 'green';
    case 'partially_configured':
      return 'blue';
    case 'installed_unconfigured':
      return 'yellow';
    default:
      return 'gray';
  }
};

const getOrganizationStatusLabel = (
  status?: string,
  configuredProjects = 0,
  totalProjects = 0,
): string => {
  switch (status) {
    case 'connected':
      return totalProjects > 0
        ? `${configuredProjects}/${totalProjects} repos connected`
        : 'Connected';
    case 'partially_configured':
      return `${configuredProjects}/${totalProjects} repos connected`;
    case 'installed_unconfigured':
      return 'Installed, no tracked repos connected';
    default:
      return 'Not connected';
  }
};

const actionAllows = (
  action: { readonly method: string; readonly service: string },
  service: string,
  method: string,
): boolean =>
  (action.service === service || action.service === '*') &&
  (action.method === method || action.method === '*');

const canManageOrganizationSettings = (
  authzMapping: Record<string, Array<{ method: string; service: string }>>,
  organization: string,
): boolean => {
  const candidatePaths = [`/programs/${organization}`, '/programs'];
  return candidatePaths.some((path) =>
    (authzMapping[path] ?? []).some(
      (action) =>
        actionAllows(action, 'arborist', 'manage-owners') ||
        actionAllows(action, '*', '*'),
    ),
  );
};

const canConnectOrganization = (
  authzMapping: Record<string, Array<{ method: string; service: string }>>,
  organization: string,
): boolean => {
  const candidatePaths = [
    `/programs/${organization}`,
    `/programs/${organization}/projects`,
  ];
  return candidatePaths.some((path) =>
    (authzMapping[path] ?? []).some(
      (action) =>
        actionAllows(action, 'arborist', 'create-descendant') ||
        actionAllows(action, 'arborist', 'manage-owners') ||
        actionAllows(action, 'arborist', '*') ||
        actionAllows(action, '*', '*'),
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

const defaultProjectConfigFromPendingRepository = (
  pendingRepository: PendingRepositoryDraft,
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
  org_title: '',
  project_name: '',
  project_title: '',
  src_repo: pendingRepository.repo_clone_url || '',
});

const CreateProjectModal = ({
  allowDismiss = true,
  existingOrganizations = [],
  existingProjectKeys = new Set<string>(),
  initialFormState,
  onClose,
  onCreated,
  opened,
  organization,
  pendingRepository,
  pendingSequenceLabel,
}: {
  allowDismiss?: boolean;
  existingOrganizations?: Array<string>;
  existingProjectKeys?: Set<string>;
  initialFormState?: CreateProjectFormState;
  onClose: () => void;
  onCreated: (createdPendingRepoID?: string) => void;
  opened: boolean;
  organization: string;
  pendingRepository?: PendingRepositoryDraft | null;
  pendingSequenceLabel?: string | null;
}) => {
  const [formState, setFormState] = useState(
    () => initialFormState || defaultProjectConfig(organization),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createGeckoProject, { isLoading }] = useCreateGeckoProjectMutation();
  const [createAuthzOwnedDescendant, { isLoading: isCreatingOwnership }] =
    useCreateAuthzOwnedDescendantMutation();

  const resetForm = () => {
    setFormState(initialFormState || defaultProjectConfig(organization));
    setSubmitError(null);
  };

  useEffect(() => {
    setFormState(initialFormState || defaultProjectConfig(organization));
    setSubmitError(null);
  }, [initialFormState, organization, opened]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const updateField = (field: keyof typeof formState, value: string): void => {
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

  const isPendingCreation = Boolean(pendingRepository);
  const submittedOrganization =
    toSlug(formState.org_title) || formState.org_title.trim();
  const submittedProject = toSlug(formState.project_name);
  const submittedResourceKey = `${submittedOrganization}/${submittedProject}`;
  const organizationExists = existingOrganizations.includes(
    submittedOrganization,
  );
  const projectExists = existingProjectKeys.has(submittedResourceKey);
  const isNewProject = !projectExists;
  const isNewOrganization = !organizationExists;
  const requiresStorageConfig = isPendingCreation && isNewProject;
  const isSubmitting = isLoading || isCreatingOwnership;

  const handleSubmit = async () => {
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

    if (!trimmedOrganization) {
      setSubmitError('Organization is required.');
      return;
    }

    if (!trimmedProjectKey) {
      setSubmitError('Project name is required.');
      return;
    }

    if (
      !configData.contact_email ||
      !configData.src_repo ||
      !configData.description ||
      !configData.project_title
    ) {
      setSubmitError('All fields are required.');
      return;
    }

    if (!isValidEmail(configData.contact_email)) {
      setSubmitError('Enter a valid contact email address.');
      return;
    }

    if (requiresStorageConfig) {
      if (!formState.bucket.trim() || !formState.bucket_provider.trim()) {
        setSubmitError('Provider and bucket name are required.');
        return;
      }
      if (
        formState.bucket_provider.trim().toLowerCase() === 's3' &&
        (!formState.bucket_access_key.trim() ||
          !formState.bucket_secret_key.trim())
      ) {
        setSubmitError('S3 access key and secret key are required.');
        return;
      }
    }

    setSubmitError(null);

    try {
      const createOwnedDescendantOrContinue = async (request: {
        readonly name: string;
        readonly parent_path: string;
        readonly template: string;
      }): Promise<void> => {
        try {
          await createAuthzOwnedDescendant(request).unwrap();
        } catch (error) {
          if (isExistingAuthzResourceError(error)) {
            return;
          }
          throw error;
        }
      };

      if (isPendingCreation && isNewOrganization) {
        await createOwnedDescendantOrContinue({
          name: trimmedOrganization,
          parent_path: '/programs',
          template: 'gen3-program',
        });
      }

      if (isPendingCreation && isNewProject) {
        await createOwnedDescendantOrContinue({
          name: trimmedProjectKey,
          parent_path: `/programs/${trimmedOrganization}/projects`,
          template: 'gen3-project',
        });
      }

      const response = await createGeckoProject({
        configData,
        organization: trimmedOrganization,
        pendingRepoID: pendingRepository?.id,
        project: trimmedProjectKey,
        storage: requiresStorageConfig
          ? {
              access_key: formState.bucket_access_key.trim() || undefined,
              bucket: formState.bucket.trim(),
              endpoint: formState.bucket_endpoint_url.trim() || undefined,
              organization: trimmedOrganization,
              path: joinStoragePath(
                formState.bucket_org_path,
                formState.bucket_project_path,
              ),
              project_id: trimmedProjectKey,
              provider: formState.bucket_provider.trim(),
              region: formState.bucket_region.trim() || undefined,
              secret_key: formState.bucket_secret_key.trim() || undefined,
            }
          : undefined,
      }).unwrap();

      if (!response.success) {
        setSubmitError(response.error || 'Failed to create project.');
        return;
      }

      resetForm();
      onCreated(pendingRepository?.id);
      if (!pendingRepository?.id) {
        onClose();
      }
    } catch (error) {
      const errorMessage =
        apiErrorMessage(error) ??
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
        pendingRepository
          ? `Finish setup for ${pendingRepository.repo_full_name}${pendingSequenceLabel ? ` (${pendingSequenceLabel})` : ''}`
          : `Create project in ${organization}`
      }
    >
      <Stack gap="xs">
        <div className="grid gap-3 md:grid-cols-2">
          <Autocomplete
            data-autofocus
            data={existingOrganizations}
            label="Calypr organization"
            onChange={(value) => updateField('org_title', value)}
            placeholder="Existing org or new org"
            readOnly={!pendingRepository}
            value={formState.org_title}
          />
          <TextInput
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
            label="Project title"
            onChange={(event) =>
              updateField('project_title', event.currentTarget.value)
            }
            placeholder="Human-readable project label"
            value={formState.project_title}
          />
          <TextInput
            label="Contact email"
            onChange={(event) =>
              updateField('contact_email', event.currentTarget.value)
            }
            placeholder="name@example.org"
            value={formState.contact_email}
          />
        </div>
        {!pendingRepository ? (
          <TextInput
            label="Repository URL"
            onChange={(event) =>
              updateField('src_repo', event.currentTarget.value)
            }
            placeholder="https://github.com/example/example-project.git"
            value={formState.src_repo}
          />
        ) : null}
        <Textarea
          autosize
          label="Description"
          minRows={2}
          onChange={(event) =>
            updateField('description', event.currentTarget.value)
          }
          placeholder="Project description"
          value={formState.description}
        />
        {requiresStorageConfig ? (
          <Stack gap="xs">
            <TextInput
              label="Endpoint URL"
              onChange={(event) =>
                updateField('bucket_endpoint_url', event.currentTarget.value)
              }
              placeholder="https://s3.amazonaws.com"
              value={formState.bucket_endpoint_url}
            />
            <TextInput
              label="Bucket Name"
              onChange={(event) =>
                updateField('bucket', event.currentTarget.value)
              }
              placeholder="calypr-project-data"
              value={formState.bucket}
            />
            <TextInput
              label="Access key"
              onChange={(event) =>
                updateField('bucket_access_key', event.currentTarget.value)
              }
              type="password"
              value={formState.bucket_access_key}
            />
            <TextInput
              label="Secret key"
              onChange={(event) =>
                updateField('bucket_secret_key', event.currentTarget.value)
              }
              type="password"
              value={formState.bucket_secret_key}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <TextInput
                label="Org path"
                onChange={(event) =>
                  updateField('bucket_org_path', event.currentTarget.value)
                }
                placeholder="optional"
                value={formState.bucket_org_path}
              />
              <TextInput
                label="Project path"
                onChange={(event) =>
                  updateField('bucket_project_path', event.currentTarget.value)
                }
                placeholder="optional"
                value={formState.bucket_project_path}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                allowDeselect={false}
                data={bucketProviderOptions}
                label="Provider"
                onChange={(value) =>
                  updateField('bucket_provider', value || 's3')
                }
                value={formState.bucket_provider}
              />
              <Select
                allowDeselect={false}
                data={bucketRegionOptions}
                label="Region"
                onChange={(value) =>
                  updateField('bucket_region', value || 'us-east-1')
                }
                searchable
                value={formState.bucket_region}
              />
            </div>
          </Stack>
        ) : isPendingCreation ? (
          <Alert color="green" variant="light">
            This project already exists in your accessible Gecko project list,
            so this will only attach or confirm the Git repository in Gecko.
          </Alert>
        ) : null}
        <Group justify="flex-end">
          {submitError ? (
            <Alert className="mr-auto flex-1" color="red" variant="light">
              {submitError}
            </Alert>
          ) : null}
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
            {isPendingCreation ? 'Finish project' : 'Create project'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
};

const CompactProjectRow = ({
  configured,
  organization,
  project,
  repositoryURL,
  repositoryLabel,
}: AccessibleOrganizationProject & {
  configured?: boolean;
  repositoryLabel?: string;
  repositoryURL?: string;
}) => {
  const router = useRouter();
  const localProjectHref = `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`;

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
        {repositoryURL ? (
          <a
            className="min-w-0 truncate font-semibold text-slate-900 transition hover:text-slate-700 hover:underline"
            href={repositoryURL}
            onClick={(event) => event.stopPropagation()}
            rel="noreferrer"
            target="_blank"
          >
            {project}
          </a>
        ) : (
          <Text fw={600} truncate>
            {project}
          </Text>
        )}
        <Badge color={configured ? 'green' : 'gray'} size="sm" variant="light">
          {configured ? 'Connected' : 'Not connected'}
        </Badge>
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
    <Text c="dimmed" size="sm">
      Open
    </Text>
    </div>
  );
};

const OrganizationRow = ({
  group,
  gitStatus,
  canManageSettings = false,
  initiallyOpen = false,
  hideCollapse = false,
}: {
  group: OrganizationGroup;
  gitStatus?: GeckoGitOrganizationStatus;
  canManageSettings?: boolean;
  initiallyOpen?: boolean;
  hideCollapse?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const isExpanded = hideCollapse ? true : isOpen;
  const statusLabel = getOrganizationStatusLabel(
    gitStatus?.configuration_state,
    gitStatus?.configured_projects ?? 0,
    gitStatus?.total_projects ?? group.projects.length,
  );
  const statusColor = getOrganizationStatusColor(
    gitStatus?.configuration_state,
  );
  const configuredProjects = new Set(
    (gitStatus?.projects ?? [])
      .filter((projectStatus) => projectStatus.configured)
      .map((projectStatus) => projectStatus.project),
  );
  const repositoryDetailsByProject = new Map(
    (gitStatus?.projects ?? []).map((projectStatus) => [
      projectStatus.project,
      {
        label: projectStatus.repository
          ? `${projectStatus.repository.owner}/${projectStatus.repository.repo}`
          : undefined,
        url: projectStatus.repository?.url,
      },
    ]),
  );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {hideCollapse ? (
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 bg-slate-50 px-6 py-4">
          <Link href="/git" legacyBehavior>
            <a className="inline-flex w-fit items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-900">
              <IconChevronLeft size={16} />
              Organizations
            </a>
          </Link>
          <div className="min-w-0 text-center">
            <Text
              c="dimmed"
              className="mb-0.5 tracking-[0.14em]"
              size="10px"
              tt="uppercase"
            >
              Organization
            </Text>
            <Text fw={700} size="lg" truncate>
              {group.organization}
            </Text>
          </div>
          <Badge color={statusColor} variant="light">
            {statusLabel}
          </Badge>
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
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 bg-slate-50 px-6 py-4 transition hover:bg-slate-100/80">
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
            <Text
              c="dimmed"
              className="mb-0.5 tracking-[0.14em]"
              size="10px"
              tt="uppercase"
            >
              Organization
            </Text>
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
          <Badge color={statusColor} variant="light">
            {statusLabel}
          </Badge>
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
                configured={configuredProjects.has(project.project)}
                repositoryLabel={
                  repositoryDetailsByProject.get(project.project)?.label
                }
                repositoryURL={
                  repositoryDetailsByProject.get(project.project)?.url
                }
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
  const installationIDFromQuery = useMemo(() => {
    const rawInstallationID = router.query.installation_id;
    const setupAction = router.query.setup_action;
    if (
      typeof rawInstallationID !== 'string' ||
      typeof setupAction !== 'string' ||
      setupAction !== 'update'
    ) {
      return null;
    }
    const parsedInstallationID = Number(rawInstallationID);
    return Number.isFinite(parsedInstallationID) && parsedInstallationID > 0
      ? parsedInstallationID
      : null;
  }, [router.query.installation_id, router.query.setup_action]);
  const setupSessionIDFromQuery = useMemo(
    () => parseGitSetupSessionID(router.query.state),
    [router.query.state],
  );
  const { data: geckoProjects = [], isLoading } = useGetGeckoProjectsQuery();
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [activePendingRepoID, setActivePendingRepoID] = useState<string | null>(
    null,
  );
  const [dismissedPendingRepoIDs, setDismissedPendingRepoIDs] = useState<
    Set<string>
  >(new Set());
  const [connectOrganization, { isLoading: isConnectingOrganization }] =
    useConnectGeckoGitOrganizationMutation();
  const [reconcilePendingRepositories] =
    useReconcileGeckoGitPendingRepositoriesMutation();
  const [fetchPendingRepositories, { data: pendingRepositoriesResponse }] =
    useLazyGetGeckoGitPendingRepositoriesQuery();
  const lastReconciledKeyRef = useRef<string | null>(null);
  const {
    data: organizationsStatus,
    isLoading: isOrganizationsStatusLoading,
    refetch: refetchOrganizationsStatus,
  } = useGetGeckoGitOrganizationsStatusQuery(undefined, {
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
  const connectableOrganizations = useMemo(() => {
    const organizations = new Set<string>();
    Object.entries(authzMapping).forEach(([resource, perms]) => {
      const parts = resource.split('/').filter(Boolean);
      if (parts.length < 3 || parts[0] !== 'programs') {
        return;
      }
      const organization = parts[1];
      const canConnect = canConnectOrganization(
        authzMapping,
        organization,
      );
      if (canConnect) {
        organizations.add(organization);
      }
      if (Array.isArray(perms)) {
        perms.forEach((action) => {
          if (
            actionAllows(action, 'arborist', 'create-descendant') ||
            actionAllows(action, 'arborist', 'manage-owners') ||
            actionAllows(action, 'arborist', '*') ||
            actionAllows(action, '*', '*')
          ) {
            organizations.add(organization);
          }
        });
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
    const allowedOrganizations = new Set(connectableOrganizations);
    const visibleOrganizations = new Set<string>();

    organizationGroups.forEach((group) => {
      if (allowedOrganizations.has(group.organization)) {
        visibleOrganizations.add(group.organization);
      }
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
    connectableOrganizations,
    organizationGroups,
    organizationsStatus?.organizations,
  ]);
  const organizationOptions = useMemo(() => {
    const organizations = new Set<string>();
    displayOrganizationGroups.forEach((group) =>
      organizations.add(group.organization),
    );
    (organizationsStatus?.organizations ?? []).forEach((status) =>
      organizations.add(status.organization),
    );
    return Array.from(organizations).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [displayOrganizationGroups, organizationsStatus?.organizations]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const connectionAuthorizationOrganization =
    connectableOrganizations[0] || organizationOptions[0] || null;
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
  const pendingRepositories = useMemo(
    () => pendingRepositoriesResponse?.pending ?? [],
    [pendingRepositoriesResponse?.pending],
  );
  const callbackPendingRepositories = useMemo(() => {
    if (!setupSessionIDFromQuery) {
      return [];
    }
    return pendingRepositories.filter(
      (pendingRepo) => pendingRepo.setup_session_id === setupSessionIDFromQuery,
    );
  }, [pendingRepositories, setupSessionIDFromQuery]);
  const activePendingRepository = useMemo(() => {
    if (pendingRepositories.length === 0) {
      return null;
    }
    if (!activePendingRepoID) {
      return pendingRepositories[0];
    }
    return (
      pendingRepositories.find(
        (pendingRepo) => pendingRepo.id === activePendingRepoID,
      ) || pendingRepositories[0]
    );
  }, [activePendingRepoID, pendingRepositories]);
  const activePendingRepositoryIndex = useMemo(
    () =>
      activePendingRepository
        ? pendingRepositories.findIndex(
            (pendingRepo) => pendingRepo.id === activePendingRepository.id,
          )
        : -1,
    [activePendingRepository, pendingRepositories],
  );

  useEffect(() => {
    void fetchPendingRepositories();
  }, [fetchPendingRepositories]);

  useEffect(() => {
    if (!router.isReady || installationIDFromQuery === null) {
      return;
    }
    const reconciliationKey = `${installationIDFromQuery}:${setupSessionIDFromQuery || ''}`;
    if (lastReconciledKeyRef.current === reconciliationKey) {
      return;
    }
    lastReconciledKeyRef.current = reconciliationKey;
    const run = async () => {
      try {
        await reconcilePendingRepositories({
          installationID: installationIDFromQuery,
          setupSessionID: setupSessionIDFromQuery || undefined,
        }).unwrap();
      } catch {
        // Keep pending repos visible from webhook state even if direct reconcile fails.
      } finally {
        void fetchPendingRepositories();
        void refetchOrganizationsStatus();
      }
    };
    void run();
  }, [
    router.isReady,
    installationIDFromQuery,
    fetchPendingRepositories,
    reconcilePendingRepositories,
    refetchOrganizationsStatus,
    setupSessionIDFromQuery,
  ]);

  useEffect(() => {
    if (pendingRepositories.length === 0) {
      setActivePendingRepoID(null);
      return;
    }
    if (
      !activePendingRepoID ||
      !pendingRepositories.some(
        (pendingRepo) => pendingRepo.id === activePendingRepoID,
      )
    ) {
      setActivePendingRepoID(pendingRepositories[0].id);
    }
  }, [activePendingRepoID, pendingRepositories]);

  useEffect(() => {
    const pendingRepoToAutoOpen = callbackPendingRepositories.find(
      (pendingRepo) => !dismissedPendingRepoIDs.has(pendingRepo.id),
    );
    if (installationIDFromQuery !== null && pendingRepoToAutoOpen) {
      setActivePendingRepoID(pendingRepoToAutoOpen.id);
      setCreateModalOpen(true);
    }
  }, [
    callbackPendingRepositories,
    dismissedPendingRepoIDs,
    installationIDFromQuery,
  ]);

  const handleOrganizationConnect = async () => {
    if (!connectionAuthorizationOrganization) {
      return;
    }
    await handleOrganizationConnectFor(connectionAuthorizationOrganization);
  };

  const handleOrganizationConnectFor = async (organization: string) => {
    setConnectError(null);
    try {
      const response = await connectOrganization({
        organization,
        redirectPath: buildGitHubConnectReturnPath(),
      }).unwrap();
      window.location.assign(response.redirect_url);
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error
          ? JSON.stringify((error as { data: unknown }).data)
          : 'Failed to start the GitHub App installation flow.';
      setConnectError(message);
    }
  };

  const handlePendingProjectCreated = async (createdPendingRepoID?: string) => {
    await fetchPendingRepositories();
    await refetchOrganizationsStatus();
    if (!createdPendingRepoID) {
      return;
    }
    setActivePendingRepoID(null);
    setCreateModalOpen(false);
  };

  const pendingRepositoryFormState = useMemo(() => {
    if (!activePendingRepository) {
      return undefined;
    }
    return defaultProjectConfigFromPendingRepository({
      id: activePendingRepository.id,
      organization: activePendingRepository.organization,
      repo_clone_url: activePendingRepository.repo_clone_url,
      repo_full_name: activePendingRepository.repo_full_name,
      repo_name: activePendingRepository.repo_name,
    });
  }, [activePendingRepository]);

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
                  <div className="flex w-full max-w-4xl items-center justify-end gap-3">
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
                    {!selectedOrganization ? (
                      <Button
                        className={actionButtonClassName}
                        color="sky"
                        disabled={!connectionAuthorizationOrganization}
                        loading={isConnectingOrganization}
                        onClick={handleOrganizationConnect}
                        variant="light"
                      >
                        GitHub Connections
                      </Button>
                    ) : null}
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
                      )}
                      group={group}
                      gitStatus={organizationStatuses.get(group.organization)}
                      initiallyOpen
                      hideCollapse={group.organization === selectedOrganization}
                      key={group.organization}
                    />
                  ))}
                </section>
              )}

              {!selectedOrganization && pendingRepositories.length > 0 ? (
                <section className="border border-amber-200 bg-amber-50/50 shadow-sm">
                  <Stack gap="sm" p="md">
                    <div>
                      <Text fw={700}>Pending project setup</Text>
                      <Text c="dimmed" size="sm">
                        These GitHub repositories were connected but still need
                        project details before they appear in Calypr.
                      </Text>
                    </div>
                    <div className="divide-y divide-amber-200 border-t border-amber-200">
                      {pendingRepositories.map((pendingRepo) => (
                        <div
                          className="grid gap-3 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                          key={pendingRepo.id}
                        >
                          <div className="min-w-0">
                            <Text fw={600} truncate>
                              {pendingRepo.repo_full_name}
                            </Text>
                            <Text c="dimmed" size="sm">
                              Organization: {pendingRepo.organization}
                            </Text>
                          </div>
                          <Button
                            className={pendingActionButtonClassName}
                            color="yellow"
                            onClick={() => {
                              setDismissedPendingRepoIDs((current) => {
                                const next = new Set(current);
                                next.delete(pendingRepo.id);
                                return next;
                              });
                              setActivePendingRepoID(pendingRepo.id);
                              setCreateModalOpen(true);
                            }}
                            variant="light"
                          >
                            Finish setup
                          </Button>
                        </div>
                      ))}
                    </div>
                  </Stack>
                </section>
              ) : null}
            </Stack>
          </Container>
              {selectedOrganization ? (
            <CreateProjectModal
              existingOrganizations={[
                ...new Set([...organizationOptions, ...connectableOrganizations]),
              ]}
              existingProjectKeys={
                new Set(
                  accessibleProjects.map(
                    (project) => `${project.organization}/${project.project}`,
                  ),
                )
              }
              onClose={() => setCreateModalOpen(false)}
              onCreated={() => {
                void router.reload();
              }}
              opened={createModalOpen}
              organization={selectedOrganization}
            />
          ) : createModalOpen && activePendingRepository ? (
            <CreateProjectModal
              existingOrganizations={[
                ...new Set([...organizationOptions, ...connectableOrganizations]),
              ]}
              existingProjectKeys={
                new Set(
                  accessibleProjects.map(
                    (project) => `${project.organization}/${project.project}`,
                  ),
                )
              }
              initialFormState={pendingRepositoryFormState}
              onClose={() => {
                if (activePendingRepository) {
                  setDismissedPendingRepoIDs((current) => {
                    const next = new Set(current);
                    next.add(activePendingRepository.id);
                    return next;
                  });
                }
                setCreateModalOpen(false);
              }}
              onCreated={(createdPendingRepoID) => {
                void handlePendingProjectCreated(createdPendingRepoID);
              }}
              opened={createModalOpen}
              organization={activePendingRepository.organization}
              pendingRepository={{
                id: activePendingRepository.id,
                organization: activePendingRepository.organization,
                repo_clone_url: activePendingRepository.repo_clone_url,
                repo_full_name: activePendingRepository.repo_full_name,
                repo_name: activePendingRepository.repo_name,
              }}
              pendingSequenceLabel={
                activePendingRepositoryIndex >= 0
                  ? `${activePendingRepositoryIndex + 1} of ${pendingRepositories.length}`
                  : null
              }
            />
          ) : null}
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitLandingPage;
