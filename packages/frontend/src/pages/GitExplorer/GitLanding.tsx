import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Container,
  Group,
  Image,
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
  IconBuildingBank,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconFolder,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import type {
  GeckoGitOrganizationStatus,
  GeckoProjectConfig,
  GeckoProjectRecord,
} from '@gen3/core';
import {
  useConnectGeckoGitOrganizationMutation,
  useCreateGeckoProjectMutation,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectsQuery,
  useReconcileGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationsMutation,
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

const toSlug = (value: string): string =>
  value
    .trim()
    .replace(/\.git$/i, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const gitProjectIconOptions = [
  'binoculars',
  'binary-tree',
  'chart-bar',
  'chart-donut',
  'compass',
  'file',
  'home',
  'key',
  'layers-intersect',
  'query',
  'Search',
  'Soup',
].map((iconName) => ({
  imagePath: `/icons/${iconName}.svg`,
  label: iconName,
  value: iconName,
}));

interface CreateProjectFormState {
  readonly contact_email: string;
  readonly description: string;
  readonly icon_name: string;
  readonly org_title: string;
  readonly project_name: string;
  readonly project_title: string;
  readonly src_repo: string;
}

const renderGitProjectIconOption = (
  iconName: string | null | undefined,
): React.ReactNode => {
  if (!iconName) return null;

  const selectedIcon = gitProjectIconOptions.find(
    (option) => option.value === iconName,
  );

  if (!selectedIcon) {
    return iconName;
  }

  return (
    <div className="flex items-center gap-2">
      <Image
        alt={selectedIcon.label}
        className="h-4 w-4"
        fit="contain"
        src={selectedIcon.imagePath}
      />
      <span>{selectedIcon.label}</span>
    </div>
  );
};

const getGitProjectIconPath = (
  iconName: string | null | undefined,
): string | undefined =>
  gitProjectIconOptions.find((option) => option.value === iconName)?.imagePath;

const buildGitHubConnectReturnPath = (): string => '/git';

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
        ? `${configuredProjects}/${totalProjects} repos configured`
        : 'Connected';
    case 'partially_configured':
      return `${configuredProjects}/${totalProjects} repos configured`;
    case 'installed_unconfigured':
      return 'Installed, no tracked repos configured';
    default:
      return 'Not connected';
  }
};

const getGlobalStatusLabel = (status?: string): string => {
  switch (status) {
    case 'connected':
      return 'All tracked orgs configured';
    case 'partially_configured':
      return 'Tracked orgs partially configured';
    case 'installed_unconfigured':
      return 'Tracked org connected';
    default:
      return 'No tracked orgs connected';
  }
};

const defaultProjectConfig = (
  organization: string,
): CreateProjectFormState => ({
  contact_email: '',
  description: '',
  icon_name: 'binoculars',
  org_title: organization,
  project_name: '',
  project_title: '',
  src_repo: '',
});

const CreateProjectModal = ({
  onClose,
  onCreated,
  opened,
  organization,
}: {
  onClose: () => void;
  onCreated: () => void;
  opened: boolean;
  organization: string;
}) => {
  const [formState, setFormState] = useState(() =>
    defaultProjectConfig(organization),
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createGeckoProject, { isLoading }] = useCreateGeckoProjectMutation();

  const resetForm = () => {
    setFormState(defaultProjectConfig(organization));
    setSubmitError(null);
  };

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

  const handleSubmit = async () => {
    const trimmedProjectKey = toSlug(formState.project_name);
    const configData: GeckoProjectConfig = {
      contact_email: formState.contact_email.trim(),
      description: formState.description.trim(),
      icon_name: formState.icon_name.trim(),
      org_title: organization,
      project_title: formState.project_title.trim(),
      src_repo: formState.src_repo.trim(),
      title: formState.project_title.trim(),
    };

    if (!trimmedProjectKey) {
      setSubmitError('Project name is required.');
      return;
    }

    if (
      !configData.contact_email ||
      !configData.src_repo ||
      !configData.description ||
      !configData.project_title ||
      !configData.icon_name
    ) {
      setSubmitError('All fields are required.');
      return;
    }

    setSubmitError(null);

    try {
      const response = await createGeckoProject({
        configData,
        organization,
        project: trimmedProjectKey,
      }).unwrap();

      if (!response.success) {
        setSubmitError(response.error || 'Failed to create project.');
        return;
      }

      resetForm();
      onClose();
      onCreated();
    } catch (error) {
      const errorMessage =
        typeof error === 'object' &&
        error !== null &&
        'error' in error &&
        typeof (error as { error?: unknown }).error === 'string'
          ? (error as { error: string }).error
          : 'Failed to create project.';
      setSubmitError(errorMessage);
    }
  };

  return (
    <Modal
      onClose={handleClose}
      opened={opened}
      size="lg"
      title={`Create project in ${organization}`}
    >
      <Stack gap="sm">
        <div>
          <Text fw={500} mb={6} size="sm">
            Project repository path
          </Text>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
            <Text c="dimmed" ff="monospace" size="sm">
              {organization} /
            </Text>
            <TextInput
              onChange={(event) =>
                updateField('project_name', event.currentTarget.value)
              }
              placeholder="example_project"
              value={formState.project_name}
            />
          </div>
        </div>
        <TextInput
          description="Used for the human-readable project label in the UI."
          label="Project title"
          onChange={(event) =>
            updateField('project_title', event.currentTarget.value)
          }
          placeholder="B-Cell Focused Translational Project Catalog"
          value={formState.project_title}
        />
        <TextInput
          label="Repository URL"
          onChange={(event) =>
            updateField('src_repo', event.currentTarget.value)
          }
          placeholder="https://github.com/example/example-project.git"
          value={formState.src_repo}
        />
        <TextInput
          label="Contact email"
          onChange={(event) =>
            updateField('contact_email', event.currentTarget.value)
          }
          placeholder="name@ohsu.edu"
          value={formState.contact_email}
        />
        <div>
          <Select
            data={gitProjectIconOptions}
            description="Choose an icon to be used to describe your project"
            label="Icon"
            leftSection={
              formState.icon_name ? (
                <Image
                  alt={formState.icon_name}
                  className="h-4 w-4"
                  fit="contain"
                  src={getGitProjectIconPath(formState.icon_name)}
                />
              ) : undefined
            }
            onChange={(value) => updateField('icon_name', value || '')}
            renderOption={({ option }) =>
              renderGitProjectIconOption(option.value)
            }
            value={formState.icon_name}
          />
        </div>
        <Textarea
          autosize
          label="Description"
          minRows={3}
          onChange={(event) =>
            updateField('description', event.currentTarget.value)
          }
          placeholder="Project description"
          value={formState.description}
        />
        <Group justify="flex-end">
          {submitError ? (
            <Alert className="mr-auto flex-1" color="red" variant="light">
              {submitError}
            </Alert>
          ) : null}
          <Button color="gray" onClick={handleClose} variant="subtle">
            Cancel
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            loading={isLoading}
            onClick={handleSubmit}
          >
            Create project
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
  resourcePath,
}: AccessibleOrganizationProject & { configured?: boolean }) => (
  <Link
    href={`/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`}
    legacyBehavior
  >
    <a className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border-t border-slate-200 px-3 py-2 text-sm transition hover:bg-slate-50">
      <div className="min-w-0">
        <Group gap="xs" wrap="nowrap">
          <Text fw={600} truncate>
            {project}
          </Text>
          <Badge
            color={configured ? 'green' : 'gray'}
            size="sm"
            variant="light"
          >
            {configured ? 'Configured' : 'Not configured'}
          </Badge>
        </Group>
        <Text c="dimmed" size="xs" truncate>
          {resourcePath}
        </Text>
      </div>
      <Text c="dimmed" size="sm">
        Open
      </Text>
    </a>
  </Link>
);

const OrganizationRow = ({
  group,
  gitStatus,
  initiallyOpen = false,
  hideCollapse = false,
}: {
  group: OrganizationGroup;
  gitStatus?: GeckoGitOrganizationStatus;
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
  const statusColor = getOrganizationStatusColor(gitStatus?.configuration_state);
  const configuredProjects = new Set(
    (gitStatus?.projects ?? [])
      .filter((projectStatus) => projectStatus.configured)
      .map((projectStatus) => projectStatus.project),
  );

  return (
    <Card padding={0} radius="lg" withBorder>
      {hideCollapse ? (
        <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 px-4 py-3">
          <Link href="/git" legacyBehavior>
            <a className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              <IconChevronLeft size={16} />
              Organizations
            </a>
          </Link>
          <div className="min-w-0 text-center">
            <Text fw={700} size="lg" truncate>
              {group.organization}
            </Text>
          </div>
          <Badge color={statusColor} variant="light">
            {statusLabel}
          </Badge>
          <Text c="dimmed" size="sm">
            {pluralize(group.projects.length, 'project')}
          </Text>
        </div>
      ) : (
        <div className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
          <button
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${group.organization}`}
            className="inline-flex items-center justify-center rounded-md border border-transparent p-1 transition hover:border-slate-200 hover:bg-white hover:shadow-sm focus-visible:border-slate-300 focus-visible:bg-white focus-visible:shadow-sm"
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
              <Link href={`/git/${encodeURIComponent(group.organization)}`} legacyBehavior>
                <a className="inline-flex max-w-full rounded-md text-left decoration-slate-400 underline-offset-4 transition hover:text-slate-700 hover:underline focus-visible:underline">
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
          <div />
          <Text c="dimmed" size="sm">
            {pluralize(group.projects.length, 'project')}
          </Text>
        </div>
      )}

      <Collapse in={isExpanded}>
        <div className="border-t border-slate-200 bg-white">
          {group.projects.map((project) => (
            <CompactProjectRow
              key={project.resourcePath}
              {...project}
              configured={configuredProjects.has(project.project)}
            />
          ))}
        </div>
      </Collapse>
    </Card>
  );
};

const GitLandingPage = ({
  headerProps,
  footerProps,
  selectedOrganization,
}: GitExplorerPageProps & { selectedOrganization?: string }) => {
  const router = useRouter();
  const { data: geckoProjects = [], isLoading } = useGetGeckoProjectsQuery();
  const [searchQuery, setSearchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectOrganization, { isLoading: isConnectingOrganization }] =
    useConnectGeckoGitOrganizationMutation();
  const {
    data: organizationsStatus,
    isLoading: isOrganizationsStatusLoading,
    refetch: refetchOrganizationsStatus,
  } = useGetGeckoGitOrganizationsStatusQuery(undefined, {
    skip: false,
  });
  const [reconcileOrganizations, { isLoading: isReconcilingOrganizations }] =
    useReconcileGeckoGitOrganizationsMutation();
  const [reconcileOrganization] = useReconcileGeckoGitOrganizationMutation();
  const hasTriggeredReconcileRef = useRef<string | null>(null);

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
  const organizationOptions = useMemo(
    () => organizationGroups.map((group) => group.organization),
    [organizationGroups],
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const connectionAuthorizationOrganization = organizationOptions[0] || null;
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
      .filter((group) =>
        group.organization.toLowerCase().includes(normalizedSearchQuery),
      )
      .map((group) => ({
        href: `/git/${encodeURIComponent(group.organization)}`,
        key: `organization-${group.organization}`,
        kind: 'organization' as const,
        label: group.organization,
        sublabel: pluralize(group.projects.length, 'project'),
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
  }, [accessibleProjects, normalizedSearchQuery, organizationGroups]);
  const visibleOrganizationGroups = useMemo(() => {
    const scopedGroups = !selectedOrganization
      ? organizationGroups
      : organizationGroups.filter(
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
  }, [normalizedSearchQuery, organizationGroups, selectedOrganization]);

  useEffect(() => {
    const reconcileKey = selectedOrganization || '__all__';
    if (hasTriggeredReconcileRef.current === reconcileKey) {
      return;
    }

    if (!selectedOrganization && organizationGroups.length === 0) {
      return;
    }

    hasTriggeredReconcileRef.current = reconcileKey;
    const run = async () => {
      try {
        if (selectedOrganization) {
          await reconcileOrganization({
            organization: selectedOrganization,
          }).unwrap();
          await refetchOrganizationsStatus();
        } else {
          await reconcileOrganizations().unwrap();
          await refetchOrganizationsStatus();
        }
      } catch {
        // Leave the existing Gecko state visible if reconcile fails.
      }
    };

    void run();
  }, [
    organizationGroups.length,
    reconcileOrganization,
    reconcileOrganizations,
    refetchOrganizationsStatus,
    selectedOrganization,
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

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: 'Gecko git project explorer',
        key: 'gecko-git-project-explorer',
        title: 'Git Project Explorer',
      }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f6f8fa]">
          <Container py="lg" size="lg">
            <Stack gap="md">
              <Card padding="md" radius="lg" withBorder>
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Text fw={700} size="lg">
                      {selectedOrganization || 'Organizations'}
                    </Text>
                    <Text c="dimmed" size="sm">
                      Browse Gecko-backed organizations and projects. The Syfon
                      view remains available under `/organization`.
                    </Text>
                  </div>
                  <div className="flex w-full max-w-2xl items-center justify-end gap-3">
                    {selectedOrganization ? (
                      <>
                        <Button
                          leftSection={<IconPlus size={16} />}
                          onClick={() => setCreateModalOpen(true)}
                          variant="light"
                        >
                          New project
                        </Button>
                      </>
                    ) : null}
                    <Popover
                      opened={normalizedSearchQuery.length > 0}
                      position="bottom-end"
                      shadow="md"
                      width={360}
                      withinPortal
                    >
                      <Popover.Target>
                        <TextInput
                          className="w-full max-w-md"
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
                  </div>
                </div>
              </Card>

              {!selectedOrganization ? (
                <Card padding="md" radius="lg" withBorder>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <Text fw={700}>GitHub app connections</Text>
                      <Text c="dimmed" size="sm">
                        Manage GitHub App access across tracked organizations,
                        then use project pages to refresh repository mirrors and
                        inspect repo state.
                      </Text>
                    </div>
                    <div className="flex w-full flex-col gap-3 md:max-w-3xl md:flex-row md:items-center md:justify-end">
                      <div className="flex min-w-[12rem] flex-col gap-1 md:items-end">
                        <Tooltip
                          label={
                            organizationsStatus?.app_installed
                              ? `${organizationsStatus.configured_projects} tracked repositories are currently configured across ${organizationsStatus.installed_organizations} installed organizations.`
                              : 'No tracked organizations currently report a GitHub App installation.'
                          }
                          withArrow
                        >
                          <Badge
                            color={
                              getOrganizationStatusColor(
                                organizationsStatus?.configuration_state,
                              )
                            }
                            size="lg"
                            variant="light"
                          >
                            {isOrganizationsStatusLoading
                              ? 'Checking GitHub status'
                              : isReconcilingOrganizations
                                ? 'Refreshing GitHub status'
                              : getGlobalStatusLabel(
                                  organizationsStatus?.configuration_state,
                                )}
                          </Badge>
                        </Tooltip>
                        <Text c="dimmed" size="xs">
                          {organizationsStatus
                            ? `${organizationsStatus.configured_projects} of ${organizationsStatus.total_projects} tracked repos configured`
                            : isReconcilingOrganizations
                              ? 'Reconciling GitHub configuration...'
                              : 'Checking repository connection status...'}
                        </Text>
                      </div>
                      <Button
                        disabled={!connectionAuthorizationOrganization}
                        loading={isConnectingOrganization}
                        onClick={handleOrganizationConnect}
                        variant="filled"
                      >
                        {organizationsStatus?.app_installed
                          ? 'Configure GitHub app'
                          : 'Connect GitHub app'}
                      </Button>
                    </div>
                  </div>
                </Card>
              ) : null}

              {connectError ? (
                <Alert color="red" variant="light">
                  {connectError}
                </Alert>
              ) : null}

              {isLoading ? (
                <Card padding="md" radius="lg" withBorder>
                  <Text c="dimmed" size="sm">
                    Loading Gecko project tree...
                  </Text>
                </Card>
              ) : visibleOrganizationGroups.length === 0 ? (
                <Card padding="md" radius="lg" withBorder>
                  <Text fw={700}>
                    {normalizedSearchQuery
                      ? 'No matching organizations or projects'
                      : 'No Gecko projects found'}
                  </Text>
                  <Text c="dimmed" className="mt-1" size="sm">
                    {normalizedSearchQuery
                      ? 'Try a different search term.'
                      : 'The Gecko list-projects endpoint did not return any project-scoped resources.'}
                  </Text>
                </Card>
              ) : (
                <Stack gap="xs">
                  {visibleOrganizationGroups.map((group) => (
                    <OrganizationRow
                      group={group}
                      gitStatus={organizationStatuses.get(group.organization)}
                      initiallyOpen={
                        group.organization === selectedOrganization
                      }
                      hideCollapse={group.organization === selectedOrganization}
                      key={group.organization}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </Container>
          {selectedOrganization ? (
            <CreateProjectModal
              onClose={() => setCreateModalOpen(false)}
              onCreated={() => {
                void router.reload();
              }}
              opened={createModalOpen}
              organization={selectedOrganization}
            />
          ) : null}
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitLandingPage;
