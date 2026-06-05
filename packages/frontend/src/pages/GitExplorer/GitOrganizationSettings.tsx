import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconChevronLeft,
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconTrash,
  IconUserPlus,
  IconX,
} from '@tabler/icons-react';
import {
  type AuthzOwnershipResourceBinding,
  createSyfonResourcePath,
  normalizeSyfonBuckets,
  type SyfonBucket,
  useAddAuthzOwnerMutation,
  useAddAuthzUserAccessMutation,
  useDeleteGeckoOrganizationMutation,
  useDeleteSyfonBucketScopeMutation,
  useGetAuthzOwnershipResourceQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useDeleteGeckoProjectMutation,
  useListSyfonBucketsQuery,
  useRemoveAuthzOwnerMutation,
  useRemoveAuthzUserAccessMutation,
  useUpsertSyfonBucketCredentialMutation,
} from '@gen3/core';
import { LoginView } from '../../components/Modals/LoginModal';
import { NavPageLayout } from '../../features/Navigation';
import { useSession } from '../../lib/session/session';
import { extractProjectsFromResourcePaths } from '../OrganizationExplorer/utils';
import type { AccessibleOrganizationProject } from '../OrganizationExplorer/types';
import type { GitExplorerPageProps } from './types';

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const projectResourcePath = (organization: string, project: string): string =>
  `/programs/${organization}/projects/${project}`;

const bucketProviderOptions = [{ label: 'Amazon S3', value: 's3' }];

const bucketRegionOptions = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'ap-southeast-1',
  'ap-southeast-2',
].map((region) => ({ label: region, value: region }));

const actionButtonClassName =
  'border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-100 hover:text-sky-900';

const actionIconClassName =
  'text-sky-700 transition hover:bg-sky-50 hover:text-sky-900';

const errorMessage = (error: unknown, fallback: string): string => {
  if (error && typeof error === 'object' && 'data' in error) {
    return JSON.stringify((error as { data: unknown }).data);
  }
  return fallback;
};

const bindingLabel = (binding: AuthzOwnershipResourceBinding): string =>
  binding.subject_type === 'group'
    ? `Group: ${binding.subject_name}`
    : binding.subject_name;

const isEditableUserBinding = (
  binding: AuthzOwnershipResourceBinding,
): boolean =>
  binding.subject_type === 'user' &&
  !binding.protected &&
  ['owner', 'delegated'].includes(binding.kind);

const isRemovableProjectAccessBinding = (
  binding: AuthzOwnershipResourceBinding,
): boolean =>
  binding.subject_type === 'user' &&
  !binding.protected &&
  ['reader', 'writer'].includes(binding.role_id) &&
  ['delegated', 'direct'].includes(binding.kind);

const roleBadgeColor = (binding: AuthzOwnershipResourceBinding): string => {
  if (binding.kind === 'admin') {
    return 'violet';
  }
  if (binding.role_id === 'owner') {
    return 'green';
  }
  return 'blue';
};

const roleSortOrder: Record<string, number> = {
  owner: 0,
  reader: 0,
  writer: 1,
};

interface ProjectBucketFormState {
  readonly access_key: string;
  readonly bucket: string;
  readonly endpoint: string;
  readonly org_path: string;
  readonly project_path: string;
  readonly provider: string;
  readonly region: string;
  readonly secret_key: string;
}

const ProjectAccessSection = ({
  canManageSettings,
  organization,
  project,
  buckets,
  onEditBucket,
  onRequestDeleteProject,
  onRemoveBucket,
  onRemoveOwner,
  onRevokeAccess,
}: {
  canManageSettings: boolean;
  organization: string;
  project: AccessibleOrganizationProject;
  buckets: Array<SyfonBucket>;
  onEditBucket: (project: string, bucket: SyfonBucket) => void;
  onRequestDeleteProject: (project: AccessibleOrganizationProject) => void;
  onRemoveBucket: (
    organization: string,
    project: string,
    bucket: SyfonBucket,
  ) => Promise<void>;
  onRemoveOwner: (resourcePath: string, username: string) => Promise<void>;
  onRevokeAccess: (
    resourcePath: string,
    username: string,
    roleID: string,
  ) => Promise<void>;
}) => {
  const [editingUserKey, setEditingUserKey] = useState<string | null>(null);
  const resourcePath = projectResourcePath(organization, project.project);
  const { data: ownership, isLoading: ownershipLoading } =
    useGetAuthzOwnershipResourceQuery(
      {
        resource_path: resourcePath,
        include_children: false,
        include_admins: false,
      },
      { skip: !canManageSettings },
    );
  const bindings = ownership?.bindings ?? [];
  const projectOwnerBindings = bindings.filter(
    (binding) =>
      binding.resource_path === resourcePath &&
      ['owner', 'direct'].includes(binding.kind) &&
      binding.role_id === 'owner',
  );
  const projectAccessBindings = bindings.filter(
    (binding) =>
      binding.resource_path === resourcePath &&
      ['delegated', 'direct'].includes(binding.kind) &&
      ['reader', 'writer'].includes(binding.role_id),
  );
  const groupedProjectAccessBindings = useMemo(() => {
    const grouped = new Map<string, Array<AuthzOwnershipResourceBinding>>();
    [...projectOwnerBindings, ...projectAccessBindings].forEach((binding) => {
      const key = `${binding.subject_type}:${binding.subject_name}`;
      grouped.set(key, [...(grouped.get(key) ?? []), binding]);
    });
    return Array.from(grouped.entries())
      .map(([key, rows]) => ({
        key,
        rows: [...rows].sort(
          (left, right) =>
            (roleSortOrder[left.role_id] ?? 99) -
            (roleSortOrder[right.role_id] ?? 99),
        ),
      }))
      .sort((left, right) =>
        bindingLabel(left.rows[0]).localeCompare(bindingLabel(right.rows[0])),
      );
  }, [projectAccessBindings, projectOwnerBindings]);

  return (
    <Card
      className="border-slate-200 bg-white/70 shadow-none"
      padding="md"
      radius="md"
      withBorder
    >
      <Stack gap="md">
        {ownershipLoading ? (
          <Group justify="center">
            <Loader size="sm" />
            <Text c="dimmed" size="sm">
              Loading project access...
            </Text>
          </Group>
        ) : null}
        <Group align="flex-start" justify="space-between">
          <div>
            <Text fw={700}>{project.project}</Text>
            <Text c="dimmed" size="sm">
              {groupedProjectAccessBindings.length} direct user
              {groupedProjectAccessBindings.length === 1 ? '' : 's'} ·{' '}
              {buckets.length} bucket{buckets.length === 1 ? '' : 's'}
            </Text>
          </div>
          <Menu position="bottom-end" shadow="md" width={210}>
            <Menu.Target>
              <ActionIcon
                aria-label={`Manage project ${project.project}`}
                className={actionIconClassName}
                variant="subtle"
              >
                <IconDotsVertical size={16} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={14} />}
                onClick={() => onRequestDeleteProject(project)}
              >
                Delete project
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>

        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Type</Table.Th>
              <Table.Th>Name</Table.Th>
              <Table.Th>Details</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {groupedProjectAccessBindings.map(({ key, rows }) => {
              const firstBinding = rows[0];
              const removableRows = rows.filter((binding) =>
                binding.role_id === 'owner'
                  ? isEditableUserBinding(binding)
                  : isRemovableProjectAccessBinding(binding),
              );
              const kinds = Array.from(
                new Set(rows.map((row) => row.kind)),
              ).join(', ');
              return (
                <React.Fragment key={key}>
                <Table.Tr>
                  <Table.Td>
                    <Badge variant="light">user</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{bindingLabel(firstBinding)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      {rows.map((binding) => (
                        <Badge
                          color={roleBadgeColor(binding)}
                          key={`${binding.policy_id}:${binding.role_id}:${binding.kind}`}
                          variant="light"
                        >
                          {binding.role_id}
                        </Badge>
                      ))}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text c="dimmed" size="sm">
                      {kinds}
                    </Text>
                  </Table.Td>
                  <Table.Td className="text-right">
                    {removableRows.length > 0 ? (
                      <Menu position="bottom-end" shadow="md" width={220}>
                        <Menu.Target>
                          <ActionIcon
                            aria-label={`Manage ${firstBinding.subject_name}`}
                            className={actionIconClassName}
                            variant="subtle"
                          >
                            <IconDotsVertical size={16} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<IconPencil size={14} />}
                            onClick={() =>
                              setEditingUserKey((current) =>
                                current === key ? null : key,
                              )
                            }
                          >
                            Edit access
                          </Menu.Item>
                          <Menu.Item
                            color="red"
                            leftSection={<IconTrash size={14} />}
                            onClick={() => {
                              removableRows.forEach((binding) => {
                                if (binding.role_id === 'owner') {
                                  void onRemoveOwner(
                                    resourcePath,
                                    binding.subject_name,
                                  );
                                  return;
                                }
                                void onRevokeAccess(
                                  resourcePath,
                                  binding.subject_name,
                                  binding.role_id,
                                );
                              });
                            }}
                          >
                            Delete user access
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
                {editingUserKey === key ? (
                  <Table.Tr key={`${key}:edit`}>
                    <Table.Td />
                    <Table.Td colSpan={4}>
                      <Group gap="xs">
                        <Text c="dimmed" size="sm">
                          Remove individual grants:
                        </Text>
                        {removableRows.map((binding) => (
                          <Button
                            color="red"
                            key={`${binding.policy_id}:${binding.role_id}:${binding.kind}:edit`}
                            leftSection={<IconTrash size={14} />}
                            onClick={() => {
                              if (binding.role_id === 'owner') {
                                void onRemoveOwner(
                                  resourcePath,
                                  binding.subject_name,
                                );
                                return;
                              }
                              void onRevokeAccess(
                                resourcePath,
                                binding.subject_name,
                                binding.role_id,
                              );
                            }}
                            size="xs"
                            variant="light"
                          >
                            {binding.role_id}
                          </Button>
                        ))}
                        <ActionIcon
                          aria-label="Close edit access row"
                          className={actionIconClassName}
                          onClick={() => setEditingUserKey(null)}
                          variant="subtle"
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ) : null}
                </React.Fragment>
              );
            })}
            {buckets.map((bucket) => (
              <Table.Tr key={`bucket:${bucket.name}`}>
                <Table.Td>
                  <Badge color="cyan" variant="light">
                    bucket
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{bucket.bucket ?? bucket.name}</Text>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Badge variant="light">{bucket.provider ?? 's3'}</Badge>
                    <Text size="sm">{bucket.region || 'Unavailable'}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text c="dimmed" size="sm">
                    {bucket.endpointUrl || 'Default endpoint'}
                  </Text>
                </Table.Td>
                <Table.Td className="text-right">
                  <Menu position="bottom-end" shadow="md" width={190}>
                    <Menu.Target>
                      <ActionIcon
                        aria-label={`Manage bucket ${bucket.bucket ?? bucket.name}`}
                        className={actionIconClassName}
                        variant="subtle"
                      >
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconPencil size={14} />}
                        onClick={() => onEditBucket(project.project, bucket)}
                      >
                        Edit bucket
                      </Menu.Item>
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() =>
                          void onRemoveBucket(
                            organization,
                            project.project,
                            bucket,
                          )
                        }
                      >
                        Delete bucket
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Table.Td>
              </Table.Tr>
            ))}
            {groupedProjectAccessBindings.length === 0 &&
            buckets.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" size="sm">
                    No direct access or buckets have been configured.
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : null}
          </Table.Tbody>
        </Table>
      </Stack>
    </Card>
  );
};

const GitOrganizationSettingsPage = ({
  headerProps,
  footerProps,
}: GitExplorerPageProps) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const orgResourcePath = organization ? `/programs/${organization}` : '';
  const orgProjectsResourcePath = orgResourcePath
    ? `${orgResourcePath}/projects`
    : '';
  const session = useSession(false);
  const sessionReady = !session.pending;
  const isAuthenticated = session.status === 'issued';
  const [activeAddForm, setActiveAddForm] = useState<
    'access' | 'bucket' | null
  >(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessRole, setAccessRole] = useState('reader');
  const [orgOwnerEmail, setOrgOwnerEmail] = useState('');
  const [orgPersonRole, setOrgPersonRole] = useState<'owner' | 'org-member'>(
    'org-member',
  );
  const [orgOwnerFormOpen, setOrgOwnerFormOpen] = useState(false);
  const [orgOwnerError, setOrgOwnerError] = useState<string | null>(null);
  const [bucketForm, setBucketForm] = useState<ProjectBucketFormState>({
    access_key: '',
    bucket: '',
    endpoint: '',
    org_path: '',
    project_path: '',
    provider: 's3',
    region: 'us-east-1',
    secret_key: '',
  });
  const [editingBucketName, setEditingBucketName] = useState<string | null>(
    null,
  );
  const [bucketDetachTarget, setBucketDetachTarget] = useState<{
    bucket: SyfonBucket;
    project: string;
  } | null>(null);
  const [projectDeleteTarget, setProjectDeleteTarget] =
    useState<AccessibleOrganizationProject | null>(null);
  const [projectDeleteConfirm, setProjectDeleteConfirm] = useState('');
  const [deletedProjectIDs, setDeletedProjectIDs] = useState<Set<string>>(
    () => new Set(),
  );
  const [orgDeleteOpen, setOrgDeleteOpen] = useState(false);
  const [orgDeleteConfirm, setOrgDeleteConfirm] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [bucketError, setBucketError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const {
    data: bucketResponse,
    isLoading: bucketsLoading,
    refetch: refetchBuckets,
  } = useListSyfonBucketsQuery(undefined, { skip: !isAuthenticated });
  const {
    data: gitOrganizationsStatus,
    isLoading: gitOrganizationsStatusLoading,
    refetch: refetchGitOrganizationsStatus,
  } = useGetGeckoGitOrganizationsStatusQuery(undefined, {
    skip: !isAuthenticated,
  });
  const organizationGitStatus = gitOrganizationsStatus?.organizations.find(
    (entry) => entry.organization === organization,
  );
  const canAccessSettings = organizationGitStatus?.can_access_settings ?? false;
  const canManagePeople = organizationGitStatus?.can_manage_people ?? false;
  const canDeleteOrg = organizationGitStatus?.can_delete_org ?? false;
  const {
    data: ownership,
    isLoading: ownershipLoading,
    refetch: refetchOwnership,
  } = useGetAuthzOwnershipResourceQuery(
    {
      resource_path: orgResourcePath,
      include_children: true,
      include_admins: false,
    },
    { skip: !orgResourcePath || !isAuthenticated || !canManagePeople },
  );
  const [addOwner] = useAddAuthzOwnerMutation();
  const [removeOwner] = useRemoveAuthzOwnerMutation();
  const [grantUser] = useAddAuthzUserAccessMutation();
  const [revokeUser] = useRemoveAuthzUserAccessMutation();
  const [deleteGeckoOrganization] = useDeleteGeckoOrganizationMutation();
  const [deleteGeckoProject] = useDeleteGeckoProjectMutation();
  const [upsertBucket] = useUpsertSyfonBucketCredentialMutation();
  const [deleteBucketScope] = useDeleteSyfonBucketScopeMutation();

  const manageableProjectStatuses = useMemo(
    () =>
      (organizationGitStatus?.projects ?? []).filter(
        (projectStatus) => projectStatus.can_manage_settings,
      ),
    [organizationGitStatus?.projects],
  );
  const projects = useMemo(
    () =>
      manageableProjectStatuses
        .map((projectStatus) => ({
          organization,
          project: projectStatus.project,
          resourcePath:
            projectStatus.resource_path ??
            projectResourcePath(organization, projectStatus.project),
        }))
        .filter((project) => !deletedProjectIDs.has(project.project)),
    [deletedProjectIDs, manageableProjectStatuses, organization],
  );
  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        label: project.project,
        value: project.project,
      })),
    [projects],
  );
  const buckets = useMemo(
    () => (bucketResponse ? normalizeSyfonBuckets(bucketResponse) : []),
    [bucketResponse],
  );

  const bindings = ownership?.bindings ?? [];
  const orgOwnerBindings = bindings.filter(
    (binding) =>
      binding.resource_path === orgResourcePath &&
      (binding.kind === 'owner' ||
        (binding.kind === 'direct' && binding.role_id === 'owner')),
  );
  const orgMemberBindings = bindings.filter(
    (binding) =>
      binding.resource_path === orgProjectsResourcePath &&
      binding.subject_type === 'user' &&
      ['delegated', 'direct'].includes(binding.kind) &&
      binding.role_id === 'org-member',
  );
  const orgPeopleBindings = [...orgOwnerBindings, ...orgMemberBindings].sort(
    (left, right) => bindingLabel(left).localeCompare(bindingLabel(right)),
  );
  const organizationGitHubInstallationUrl =
    organizationGitStatus?.html_url ?? null;
  const selectedProjectID = selectedProject ?? projects[0]?.project ?? null;
  const selectedProjectResourcePath = selectedProjectID
    ? projectResourcePath(organization, selectedProjectID)
    : '';

  const bucketsForProject = (project: string) => {
    const projectBucketResource = createSyfonResourcePath(
      organization,
      project,
    );
    return buckets.filter((bucket) =>
      bucket.resources.includes(projectBucketResource),
    );
  };

  const addOwnerForResource = async (
    resourcePath: string,
    username: string,
    errorFallback: string,
  ) => {
    try {
      setActionError(null);
      await addOwner({ resource_path: resourcePath, username }).unwrap();
      if (canManagePeople) {
        await refetchOwnership();
      }
    } catch (error) {
      setActionError(errorMessage(error, errorFallback));
      throw error;
    }
  };

  const removeOwnerForResource = async (
    resourcePath: string,
    username: string,
    errorFallback: string,
  ) => {
    try {
      setActionError(null);
      await removeOwner({ resource_path: resourcePath, username }).unwrap();
      if (canManagePeople) {
        await refetchOwnership();
      }
    } catch (error) {
      setActionError(errorMessage(error, errorFallback));
      throw error;
    }
  };

  const grantUserAccessForResource = async (
    resourcePath: string,
    username: string,
    roleID: string,
    errorFallback: string,
  ) => {
    try {
      setActionError(null);
      await grantUser({
        resource_path: resourcePath,
        username,
        role_id: roleID,
      }).unwrap();
      if (canManagePeople) {
        await refetchOwnership();
      }
    } catch (error) {
      setActionError(errorMessage(error, errorFallback));
      throw error;
    }
  };

  const revokeUserAccessForResource = async (
    resourcePath: string,
    username: string,
    roleID: string,
    errorFallback: string,
  ) => {
    try {
      setActionError(null);
      await revokeUser({
        resource_path: resourcePath,
        username,
        role_id: roleID,
      }).unwrap();
      if (canManagePeople) {
        await refetchOwnership();
      }
    } catch (error) {
      setActionError(errorMessage(error, errorFallback));
      throw error;
    }
  };

  const handleAddOrgOwner = async () => {
    const username = orgOwnerEmail.trim().toLowerCase();
    if (!isValidEmail(username)) {
      setOrgOwnerError('Enter a valid email address.');
      return;
    }
    try {
      setOrgOwnerError(null);
      if (orgPersonRole === 'owner') {
        await addOwnerForResource(
          orgResourcePath,
          username,
          'Failed to add organization owner.',
        );
      } else {
        await grantUserAccessForResource(
          orgProjectsResourcePath,
          username,
          'org-member',
          'Failed to add organization member.',
        );
      }
      setOrgOwnerEmail('');
      setOrgOwnerFormOpen(false);
    } catch {
      // Error state is set by addOwnerForResource.
    }
  };

  const handleRemoveOrgOwner = async (
    binding: AuthzOwnershipResourceBinding,
  ) => {
    try {
      if (binding.role_id === 'org-member') {
        await revokeUserAccessForResource(
          orgProjectsResourcePath,
          binding.subject_name,
          'org-member',
          'Failed to remove organization member.',
        );
      } else {
        await removeOwnerForResource(
          orgResourcePath,
          binding.subject_name,
          'Failed to remove organization owner.',
        );
      }
    } catch {
      // Error state is set by removeOwnerForResource.
    }
  };

  const handleAddProjectAccess = async () => {
    const username = accessEmail.trim().toLowerCase();
    if (!selectedProjectResourcePath) {
      setFormError('Select a project.');
      return;
    }
    if (!isValidEmail(username)) {
      setFormError('Enter a valid email address.');
      return;
    }
    setFormError(null);
    if (accessRole === 'owner') {
      try {
        await addOwnerForResource(
          selectedProjectResourcePath,
          username,
          'Failed to add project owner.',
        );
        setAccessEmail('');
        setActiveAddForm(null);
      } catch {
        // Error state is set by addOwnerForResource.
      }
      return;
    }
    await handleGrantUser(selectedProjectResourcePath, username, accessRole);
  };

  const updateBucketField = (
    field: keyof ProjectBucketFormState,
    value: string,
  ) => {
    setBucketForm((current) => ({ ...current, [field]: value }));
  };

  const handleAddSelectedProjectBucket = async () => {
    if (!selectedProjectID) {
      setBucketError('Select a project.');
      return;
    }
    if (!bucketForm.bucket.trim()) {
      setBucketError('Bucket name is required.');
      return;
    }
    if (
      bucketForm.provider === 's3' &&
      (!bucketForm.access_key.trim() || !bucketForm.secret_key.trim())
    ) {
      setBucketError('Access key and secret key are required for S3 buckets.');
      return;
    }
    try {
      setBucketError(null);
      await handleAddBucket(organization, selectedProjectID, bucketForm);
      setBucketForm((current) => ({
        ...current,
        access_key: '',
        bucket: '',
        secret_key: '',
      }));
      setEditingBucketName(null);
      setActiveAddForm(null);
    } catch {
      // Error state is set by handleAddBucket.
    }
  };

  const handleEditBucket = (project: string, bucket: SyfonBucket) => {
    setSelectedProject(project);
    setEditingBucketName(bucket.name);
    setBucketForm({
      access_key: '',
      bucket: bucket.bucket ?? bucket.name,
      endpoint: bucket.endpointUrl ?? '',
      org_path: '',
      project_path: '',
      provider: bucket.provider ?? 's3',
      region: bucket.region || 'us-east-1',
      secret_key: '',
    });
    setBucketError(null);
    setActiveAddForm('bucket');
  };

  const handleGrantUser = async (
    resourcePath: string,
    username: string,
    roleID: string,
  ) => {
    try {
      setActionError(null);
      await grantUser({
        resource_path: resourcePath,
        username,
        role_id: roleID,
      }).unwrap();
      if (canManagePeople) {
        await refetchOwnership();
      }
    } catch (error) {
      setActionError(errorMessage(error, 'Failed to add project access.'));
    }
  };

  const handleRevokeUser = async (
    resourcePath: string,
    username: string,
    roleID: string,
  ) => {
    try {
      setActionError(null);
      const response = await revokeUser({
        resource_path: resourcePath,
        username,
        role_id: roleID,
      }).unwrap();
      const notRemoved = response.not_removed ?? [];
      if ((response.removed ?? []).length === 0 && notRemoved.length > 0) {
        setActionError(
          `Access was not removed: ${notRemoved
            .map((entry) => entry.reason ?? entry.kind)
            .join(', ')}`,
        );
      }
      if (canManagePeople) {
        await refetchOwnership();
      }
    } catch (error) {
      setActionError(errorMessage(error, 'Failed to remove project access.'));
    }
  };

  const handleAddBucket = async (
    org: string,
    project: string,
    request: ProjectBucketFormState,
  ) => {
    try {
      setActionError(null);
      await upsertBucket({
        access_key: request.access_key.trim() || undefined,
        bucket: request.bucket.trim(),
        endpoint: request.endpoint.trim() || undefined,
        organization: org,
        organization_sub_path: request.org_path.trim() || undefined,
        project_id: project,
        project_sub_path: request.project_path.trim() || undefined,
        provider: request.provider.trim(),
        region: request.region.trim() || undefined,
        secret_key: request.secret_key.trim() || undefined,
      }).unwrap();
      await refetchBuckets();
    } catch (error) {
      setActionError(errorMessage(error, 'Failed to add project bucket.'));
      throw error;
    }
  };

  const handleRemoveBucket = async (
    org: string,
    project: string,
    bucket: SyfonBucket,
  ) => {
    try {
      setActionError(null);
      await deleteBucketScope({
        bucket: bucket.name,
        organization: org,
        project_id: project,
      }).unwrap();
      await refetchBuckets();
    } catch (error) {
      setActionError(errorMessage(error, 'Failed to remove project bucket.'));
      throw error;
    }
  };

  const requestRemoveBucket = (
    project: string,
    projectBuckets: Array<SyfonBucket>,
    bucket: SyfonBucket,
  ) => {
    if (projectBuckets.length <= 1) {
      setBucketDetachTarget({ bucket, project });
      return;
    }
    void handleRemoveBucket(organization, project, bucket);
  };

  const purgeProjectFromCalypr = async (
    project: AccessibleOrganizationProject,
  ) => {
    const projectID = project.project;

    setActionError(null);

    await deleteGeckoProject({ organization, project: projectID }).unwrap();
  };

  const handleDeleteProject = async () => {
    if (!projectDeleteTarget) {
      return;
    }
    if (projectDeleteConfirm !== projectDeleteTarget.project) {
      setActionError('Type the exact project name to delete this project.');
      return;
    }
    try {
      await purgeProjectFromCalypr(projectDeleteTarget);
      setDeletedProjectIDs(
        (current) =>
          new Set([...Array.from(current), projectDeleteTarget.project]),
      );
      setSelectedProject((current) =>
        current === projectDeleteTarget.project ? null : current,
      );
      setProjectDeleteTarget(null);
      setProjectDeleteConfirm('');
      await refetchBuckets();
    } catch (error) {
      setActionError(errorMessage(error, 'Failed to delete project.'));
    }
  };

  const handleDeleteOrganization = async () => {
    if (orgDeleteConfirm !== organization) {
      setActionError('Type the exact organization name to delete it.');
      return;
    }
    try {
      setActionError(null);
      await deleteGeckoOrganization({ organization }).unwrap();
      await Promise.all([
        refetchOwnership().catch(() => undefined),
        refetchBuckets().catch(() => undefined),
        refetchGitOrganizationsStatus().catch(() => undefined),
      ]);
      setOrgDeleteOpen(false);
      setOrgDeleteConfirm('');
      window.location.assign('/git');
    } catch (error) {
      setActionError(errorMessage(error, 'Failed to delete organization.'));
    }
  };

  const unauthorized = sessionReady && isAuthenticated && !canAccessSettings;
  const isLoading =
    !sessionReady ||
    gitOrganizationsStatusLoading ||
    bucketsLoading ||
    (canManagePeople && ownershipLoading);
  const hasProjectSettings = projects.length > 0;
  const hasAnySettings = hasProjectSettings || canManagePeople || canDeleteOrg;
  const addPanel = activeAddForm ? (
    <Card
      className="absolute right-0 top-full z-20 mt-2 w-[min(46rem,calc(100vw-3rem))] border-slate-200 shadow-xl"
      padding="md"
      radius="lg"
      withBorder
    >
      <Stack gap="sm">
        <Group justify="space-between">
          <Text fw={700} size="sm">
            {activeAddForm === 'access'
              ? 'Add project access'
              : editingBucketName
                ? 'Edit bucket'
                : 'Add project bucket'}
          </Text>
          <ActionIcon
            aria-label="Close add panel"
            className={actionIconClassName}
            onClick={() => setActiveAddForm(null)}
            variant="subtle"
          >
            <IconX size={16} />
          </ActionIcon>
        </Group>
        <Select
          allowDeselect={false}
          data={projectOptions}
          label="Project"
          onChange={(value) => setSelectedProject(value ?? null)}
          value={selectedProjectID}
        />
        {activeAddForm === 'access' ? (
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-end">
            <TextInput
              error={formError}
              label="Email"
              onChange={(event) => setAccessEmail(event.currentTarget.value)}
              placeholder="name@example.org"
              value={accessEmail}
            />
            <Select
              allowDeselect={false}
              data={[
                { label: 'Reader', value: 'reader' },
                { label: 'Writer', value: 'writer' },
                { label: 'Owner', value: 'owner' },
              ]}
              label="Role"
              onChange={(value) => setAccessRole(value ?? 'reader')}
              value={accessRole}
            />
            <Button
              className={actionButtonClassName}
              color="sky"
              leftSection={<IconUserPlus size={16} />}
              onClick={handleAddProjectAccess}
              variant="light"
            >
              Add access
            </Button>
          </div>
        ) : null}
        {activeAddForm === 'bucket' ? (
          <Stack gap="xs">
            <div className="grid gap-2 md:grid-cols-2">
              <TextInput
                error={bucketError}
                label="Bucket Name"
                onChange={(event) =>
                  updateBucketField('bucket', event.currentTarget.value)
                }
                placeholder="calypr-project-data"
                value={bucketForm.bucket}
              />
              <TextInput
                label="Endpoint URL"
                onChange={(event) =>
                  updateBucketField('endpoint', event.currentTarget.value)
                }
                placeholder="https://s3.amazonaws.com"
                value={bucketForm.endpoint}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <TextInput
                label="Access key"
                onChange={(event) =>
                  updateBucketField('access_key', event.currentTarget.value)
                }
                type="password"
                value={bucketForm.access_key}
              />
              <TextInput
                label="Secret key"
                onChange={(event) =>
                  updateBucketField('secret_key', event.currentTarget.value)
                }
                type="password"
                value={bucketForm.secret_key}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <TextInput
                label="Org path"
                onChange={(event) =>
                  updateBucketField('org_path', event.currentTarget.value)
                }
                placeholder="optional"
                value={bucketForm.org_path}
              />
              <TextInput
                label="Project path"
                onChange={(event) =>
                  updateBucketField('project_path', event.currentTarget.value)
                }
                placeholder="optional"
                value={bucketForm.project_path}
              />
            </div>
            <div className="grid gap-2 md:grid-cols-[10rem_10rem_auto] md:items-end">
              <Select
                allowDeselect={false}
                data={bucketProviderOptions}
                label="Provider"
                onChange={(value) =>
                  updateBucketField('provider', value || 's3')
                }
                value={bucketForm.provider}
              />
              <Select
                allowDeselect={false}
                data={bucketRegionOptions}
                label="Region"
                onChange={(value) =>
                  updateBucketField('region', value || 'us-east-1')
                }
                searchable
                value={bucketForm.region}
              />
              <Button
                className={actionButtonClassName}
                color="sky"
                onClick={handleAddSelectedProjectBucket}
                variant="light"
              >
                {editingBucketName ? 'Edit bucket' : 'Add bucket'}
              </Button>
            </div>
          </Stack>
        ) : null}
      </Stack>
    </Card>
  ) : null;

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: 'Manage Calypr organization access',
        key: 'gecko-organization-settings',
        title: 'Organization Settings',
      }}
      mainProps={{ className: 'bg-[#f6f8fa]' }}
    >
      <div className="min-h-screen bg-[#f6f8fa]">
        <Container maw={1600} px="2.5rem" py="lg">
          <Stack gap="md">
            <div>
              <Link
                href={`/git/${encodeURIComponent(organization)}`}
                legacyBehavior
              >
                <a className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
                  <IconChevronLeft size={16} />
                  Back to organization
                </a>
              </Link>
              <Title order={2}>Settings: {organization}</Title>
              <Text c="dimmed" size="sm">
                Manage project access and storage.
              </Text>
            </div>

            {isLoading ? (
              <Card padding="xl" radius="lg" withBorder>
                <Group justify="center">
                  <Loader size="sm" />
                  <Text c="dimmed">Loading access settings...</Text>
                </Group>
              </Card>
            ) : !isAuthenticated ? (
              <Card padding="xl" radius="lg" withBorder>
                <Stack gap="md">
                  <Alert color="yellow" variant="light">
                    Sign in to manage this organization.
                  </Alert>
                  <LoginView redirectPath={router.asPath} />
                </Stack>
              </Card>
            ) : unauthorized ? (
              <Alert color="yellow" variant="light">
                You do not have permission to manage this organization.
              </Alert>
            ) : (
              <>
                {actionError ? (
                  <Alert color="red" variant="light">
                    {actionError}
                  </Alert>
                ) : null}
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Text fw={700}>Projects</Text>
                    {hasProjectSettings ? (
                      <div className="relative">
                        <Group gap="xs">
                          <Button
                            className={actionButtonClassName}
                            color="sky"
                            leftSection={<IconPlus size={14} />}
                            onClick={() => setActiveAddForm('access')}
                            size="xs"
                            variant="light"
                          >
                            Access
                          </Button>
                          <Button
                            className={actionButtonClassName}
                            color="sky"
                            leftSection={<IconPlus size={14} />}
                            onClick={() => {
                              setEditingBucketName(null);
                              setActiveAddForm('bucket');
                            }}
                            size="xs"
                            variant="light"
                          >
                            Bucket
                          </Button>
                        </Group>
                        {addPanel}
                      </div>
                    ) : null}
                  </Group>
                  {!hasProjectSettings ? (
                    <Card padding="md" radius="lg" withBorder>
                      <Text c="dimmed" size="sm">
                        {hasAnySettings
                          ? 'No project settings are available for this organization.'
                          : 'No configurable settings are available for this organization.'}
                      </Text>
                    </Card>
                  ) : (
                    <Stack gap="sm">
                      {projects.map((project) => {
                        const projectBucketResource = createSyfonResourcePath(
                          organization,
                          project.project,
                        );
                        return (
                          <ProjectAccessSection
                            buckets={buckets.filter((bucket) =>
                              bucket.resources.includes(projectBucketResource),
                            )}
                            canManageSettings
                            key={project.resourcePath}
                            onEditBucket={handleEditBucket}
                            onRemoveBucket={(
                              org,
                              projectID,
                              bucket,
                            ) => {
                              requestRemoveBucket(
                                projectID,
                                bucketsForProject(projectID),
                                bucket,
                              );
                              return Promise.resolve();
                            }}
                            onRemoveOwner={(resourcePath, username) =>
                              removeOwnerForResource(
                                resourcePath,
                                username,
                                'Failed to remove project owner.',
                              )
                            }
                            onRequestDeleteProject={(projectToDelete) => {
                              setProjectDeleteTarget(projectToDelete);
                              setProjectDeleteConfirm('');
                            }}
                            onRevokeAccess={handleRevokeUser}
                            organization={organization}
                            project={project}
                          />
                        );
                      })}
                    </Stack>
                  )}
                </Stack>

                {canManagePeople ? (
                  <Card
                    className="border-slate-200 bg-white/70 shadow-none"
                    padding="md"
                    radius="md"
                    withBorder
                  >
                    <Stack gap="md">
                      <Group justify="space-between">
                        <div>
                          <Text fw={700}>Organization people</Text>
                          <Text c="dimmed" size="sm">
                            Owners can manage every project and organization
                            people. Members can create new projects, then own
                            the projects they create.
                          </Text>
                        </div>
                        <Button
                          className={actionButtonClassName}
                          color="sky"
                          leftSection={<IconPlus size={14} />}
                          onClick={() =>
                            setOrgOwnerFormOpen((current) => !current)
                          }
                          size="xs"
                          variant="light"
                        >
                          Person
                        </Button>
                      </Group>
                      {orgOwnerFormOpen ? (
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_11rem_auto_auto] md:items-end">
                          <TextInput
                            error={orgOwnerError}
                            label="Add organization person"
                            onChange={(event) =>
                              setOrgOwnerEmail(event.currentTarget.value)
                            }
                            placeholder="name@example.org"
                            value={orgOwnerEmail}
                          />
                          <Select
                            allowDeselect={false}
                            data={[
                              { label: 'Member', value: 'org-member' },
                              { label: 'Owner', value: 'owner' },
                            ]}
                            label="Role"
                            onChange={(value) =>
                              setOrgPersonRole(
                                value === 'owner' ? 'owner' : 'org-member',
                              )
                            }
                            value={orgPersonRole}
                          />
                          <Button
                            className={actionButtonClassName}
                            color="sky"
                            leftSection={<IconUserPlus size={16} />}
                            onClick={handleAddOrgOwner}
                            variant="light"
                          >
                            Add person
                          </Button>
                          <ActionIcon
                            aria-label="Close organization owner form"
                            className={actionIconClassName}
                            onClick={() => setOrgOwnerFormOpen(false)}
                            variant="subtle"
                          >
                            <IconX size={16} />
                          </ActionIcon>
                        </div>
                      ) : null}
                      <Table striped withTableBorder>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>User</Table.Th>
                            <Table.Th>Role</Table.Th>
                            <Table.Th />
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {orgPeopleBindings.length === 0 ? (
                            <Table.Tr>
                              <Table.Td colSpan={3}>
                                <Text c="dimmed" size="sm">
                                  No organization owners or members have been
                                  added.
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                          ) : (
                            orgPeopleBindings.map((binding) => (
                              <Table.Tr
                                key={`${binding.resource_path}:${binding.kind}:${binding.role_id}:${binding.subject_type}:${binding.subject_name}`}
                              >
                                <Table.Td>
                                  <Text size="sm">{bindingLabel(binding)}</Text>
                                </Table.Td>
                                <Table.Td>
                                  <Badge
                                    color={
                                      binding.role_id === 'org-member'
                                        ? 'blue'
                                        : 'green'
                                    }
                                    variant="light"
                                  >
                                    {binding.role_id === 'org-member'
                                      ? 'member'
                                      : 'owner'}
                                  </Badge>
                                </Table.Td>
                                <Table.Td className="text-right">
                                  {isEditableUserBinding(binding) ? (
                                    <Menu
                                      position="bottom-end"
                                      shadow="md"
                                      width={190}
                                    >
                                      <Menu.Target>
                                        <ActionIcon
                                          aria-label={`Manage organization owner ${binding.subject_name}`}
                                          className={actionIconClassName}
                                          variant="subtle"
                                        >
                                          <IconDotsVertical size={16} />
                                        </ActionIcon>
                                      </Menu.Target>
                                      <Menu.Dropdown>
                                        <Menu.Item
                                          color="red"
                                          leftSection={<IconTrash size={14} />}
                                          onClick={() =>
                                            handleRemoveOrgOwner(binding)
                                          }
                                        >
                                          Delete{' '}
                                          {binding.role_id === 'org-member'
                                            ? 'member'
                                            : 'owner'}
                                        </Menu.Item>
                                      </Menu.Dropdown>
                                    </Menu>
                                  ) : null}
                                </Table.Td>
                              </Table.Tr>
                            ))
                          )}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  </Card>
                ) : null}

                {canDeleteOrg ? (
                  <Card
                    className="border-red-200 bg-red-50/60 shadow-none"
                    padding="md"
                    radius="md"
                    withBorder
                  >
                    <Group align="center" justify="space-between">
                      <div>
                        <Text c="red" fw={700}>
                          Delete organization
                        </Text>
                        <Text c="dimmed" size="sm">
                          Permanently remove every project, access grant, and
                          Syfon record for this organization from Calypr. Bucket
                          data itself is not deleted.
                        </Text>
                      </div>
                      <Button
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => {
                          setOrgDeleteOpen(true);
                          setOrgDeleteConfirm('');
                        }}
                        variant="light"
                      >
                        Delete organization
                      </Button>
                    </Group>
                  </Card>
                ) : null}
              </>
            )}
          </Stack>
        </Container>
      </div>
      <Modal
        centered
        onClose={() => setBucketDetachTarget(null)}
        opened={bucketDetachTarget !== null}
        title="Detach last project bucket?"
      >
        <Stack gap="md">
          <Alert color="red" variant="light">
            This is the last bucket associated with{' '}
            <strong>{bucketDetachTarget?.project}</strong>. Detaching it will
            effectively disable the project in Calypr until another bucket is
            attached. Bucket data itself will not be deleted.
          </Alert>
          <Group justify="flex-end">
            <Button
              onClick={() => setBucketDetachTarget(null)}
              variant="subtle"
            >
              Cancel
            </Button>
            <Button
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => {
                if (!bucketDetachTarget) return;
                void handleRemoveBucket(
                  organization,
                  bucketDetachTarget.project,
                  bucketDetachTarget.bucket,
                ).then(() => setBucketDetachTarget(null));
              }}
            >
              Detach bucket
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        centered
        onClose={() => {
          setProjectDeleteTarget(null);
          setProjectDeleteConfirm('');
        }}
        opened={projectDeleteTarget !== null}
        title={`Delete project ${projectDeleteTarget?.project ?? ''}?`}
      >
        <Stack gap="md">
          <Alert color="red" variant="light">
            This will delete the project from Calypr: Gecko project config,
            Syfon records and bucket associations, and Arborist access resources
            and grants. Bucket data itself is not deleted.
          </Alert>
          <Alert color="yellow" variant="light">
            <Stack gap="xs">
              <Text size="sm">
                Calypr does not remove the repository from the GitHub App
                installation. If you want the repo disconnected on the GitHub
                side, remove it manually from the installation page.
              </Text>
              {organizationGitHubInstallationUrl ? (
                <Button
                  component="a"
                  href={organizationGitHubInstallationUrl}
                  rel="noreferrer"
                  target="_blank"
                  variant="light"
                  color="yellow"
                  size="xs"
                >
                  Open GitHub installation
                </Button>
              ) : null}
            </Stack>
          </Alert>
          <TextInput
            label={`Type ${projectDeleteTarget?.project ?? ''} to confirm`}
            onChange={(event) =>
              setProjectDeleteConfirm(event.currentTarget.value)
            }
            value={projectDeleteConfirm}
          />
          <Group justify="flex-end">
            <Button
              onClick={() => {
                setProjectDeleteTarget(null);
                setProjectDeleteConfirm('');
              }}
              variant="subtle"
            >
              Cancel
            </Button>
            <Button
              color="red"
              disabled={projectDeleteConfirm !== projectDeleteTarget?.project}
              leftSection={<IconTrash size={14} />}
              onClick={handleDeleteProject}
            >
              Delete project
            </Button>
          </Group>
        </Stack>
      </Modal>
      <Modal
        centered
        onClose={() => {
          setOrgDeleteOpen(false);
          setOrgDeleteConfirm('');
        }}
        opened={orgDeleteOpen}
        title={`Delete organization ${organization}?`}
      >
        <Stack gap="md">
          <Alert color="red" variant="light">
            This will delete every Calypr project in this organization,
            including Gecko project cards, Syfon records and bucket
            associations, and Arborist access resources and grants. Bucket data
            itself is not deleted.
          </Alert>
          <TextInput
            label={`Type ${organization} to confirm`}
            onChange={(event) => setOrgDeleteConfirm(event.currentTarget.value)}
            value={orgDeleteConfirm}
          />
          <Group justify="flex-end">
            <Button
              onClick={() => {
                setOrgDeleteOpen(false);
                setOrgDeleteConfirm('');
              }}
              variant="subtle"
            >
              Cancel
            </Button>
            <Button
              color="red"
              disabled={orgDeleteConfirm !== organization}
              leftSection={<IconTrash size={14} />}
              onClick={handleDeleteOrganization}
            >
              Delete organization
            </Button>
          </Group>
        </Stack>
      </Modal>
    </NavPageLayout>
  );
};

export default GitOrganizationSettingsPage;
