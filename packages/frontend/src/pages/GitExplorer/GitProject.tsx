import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Card,
  Code,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Popover,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core';
import {
  SYFON_API,
  useLazyGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectRefsQuery,
  useGetGeckoGitProjectStatusQuery,
  useGetGeckoGitProjectTreeQuery,
  useLazyGetSyfonObjectsByChecksumQuery,
  useRefreshGeckoGitProjectMutation,
  type GeckoGitTreeEntry,
} from '@gen3/core';
import {
  IconDatabaseExport,
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconFile,
  IconFolder,
  IconGitBranch,
  IconLink,
  IconMail,
  IconSearch,
  IconTerminal2,
  IconClock,
  IconX,
} from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
import { Upload } from '../../features/Upload';
import type { GitExplorerPageProps } from './types';

const formatBytes = (size: number): string => {
  if (!Number.isFinite(size) || size < 0) {
    return 'Unknown size';
  }
  if (size < 1024) {
    return `${size} bytes`;
  }
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const formatRelativeDate = (value?: string): string => {
  if (!value) {
    return 'Unknown';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  const diffMs = date.getTime() - Date.now();
  const absSeconds = Math.abs(diffMs) / 1000;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absSeconds < 60) {
    return rtf.format(Math.round(diffMs / 1000), 'second');
  }
  const absMinutes = absSeconds / 60;
  if (absMinutes < 60) {
    return rtf.format(Math.round(diffMs / (60 * 1000)), 'minute');
  }
  const absHours = absMinutes / 60;
  if (absHours < 24) {
    return rtf.format(Math.round(diffMs / (60 * 60 * 1000)), 'hour');
  }
  const absDays = absHours / 24;
  if (absDays < 30) {
    return rtf.format(Math.round(diffMs / (24 * 60 * 60 * 1000)), 'day');
  }
  const absMonths = absDays / 30;
  if (absMonths < 12) {
    return rtf.format(Math.round(diffMs / (30 * 24 * 60 * 60 * 1000)), 'month');
  }
  return rtf.format(Math.round(diffMs / (365 * 24 * 60 * 60 * 1000)), 'year');
};

const buildSyfonDownloadUrl = (objectId: string): string =>
  `${SYFON_API}/download/${encodeURIComponent(objectId)}?redirect=true`;

const buildGitDrsRemoteAddCommand = (
  organization: string,
  project: string,
): string =>
  `git drs remote add gen3 origin ${organization}/${project} --cred ~/.gen3/credentials.json`;

const GitProjectPage = ({ headerProps, footerProps }: GitExplorerPageProps) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const requestedRef =
    typeof router.query.ref === 'string' ? router.query.ref : null;
  const requestedPath =
    typeof router.query.path === 'string' ? router.query.path : '';

  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(requestedPath);
  const [actionError, setActionError] = useState<string | null>(null);
  const [downloadingChecksum, setDownloadingChecksum] = useState<string | null>(
    null,
  );
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasCopiedRepoPath, setHasCopiedRepoPath] = useState(false);
  const [hasCopiedCloneCommand, setHasCopiedCloneCommand] = useState(false);
  const [hasCopiedRemoteCommand, setHasCopiedRemoteCommand] = useState(false);
  const hasHydratedTreeRef = useRef<string | null>(null);

  const shouldSkip = !organization || !project;
  const {
    data: projectStatus,
    isLoading: isStatusLoading,
    refetch: refetchStatus,
  } = useGetGeckoGitProjectStatusQuery(
    { organization, project },
    { skip: shouldSkip },
  );
  const effectiveRef =
    selectedRef ?? requestedRef ?? projectStatus?.default_branch ?? null;
  const {
    data: refsData,
    isLoading: areRefsLoading,
    refetch: refetchRefs,
  } = useGetGeckoGitProjectRefsQuery(
    { organization, project },
    {
      skip:
        shouldSkip ||
        projectStatus?.installation_state !== 'connected' ||
        !projectStatus?.mirror_ready,
    },
  );
  const {
    data: treeData,
    isLoading: isTreeLoading,
    refetch: refetchTree,
  } = useGetGeckoGitProjectTreeQuery(
    {
      organization,
      project,
      path: currentPath,
      ref: effectiveRef ?? undefined,
    },
    {
      skip:
        shouldSkip ||
        projectStatus?.installation_state !== 'connected' ||
        !projectStatus?.mirror_ready,
      },
    );
  const [lookupSyfonObjectsByChecksum] =
    useLazyGetSyfonObjectsByChecksumQuery();
  const [getGitProjectFile, { isLoading: isResolvingFileDownload }] =
    useLazyGetGeckoGitProjectFileQuery();

  const [refreshProject, { isLoading: isRefreshing }] =
    useRefreshGeckoGitProjectMutation();

  useEffect(() => {
    if (requestedRef) {
      setSelectedRef(requestedRef);
      return;
    }
    if (projectStatus?.default_branch && !selectedRef) {
      setSelectedRef(projectStatus.default_branch);
    }
  }, [projectStatus?.default_branch, requestedRef, selectedRef]);

  useEffect(() => {
    setCurrentPath(requestedPath);
  }, [requestedPath]);

  useEffect(() => {
    if (
      shouldSkip ||
      projectStatus?.installation_state !== 'connected' ||
      !projectStatus?.mirror_ready
    ) {
      return;
    }

    const hydrationKey = `${organization}/${project}/${effectiveRef ?? projectStatus?.default_branch ?? ''}/${currentPath}`;
    if (hasHydratedTreeRef.current === hydrationKey) {
      return;
    }
    hasHydratedTreeRef.current = hydrationKey;

    void Promise.all([refetchRefs(), refetchTree()]);
  }, [
    currentPath,
    effectiveRef,
    organization,
    project,
    projectStatus?.default_branch,
    projectStatus?.installation_state,
    projectStatus?.mirror_ready,
    refetchRefs,
    refetchTree,
    shouldSkip,
  ]);

  const refOptions = useMemo(
    () =>
      (refsData?.refs ?? []).map((ref) => ({
        label: ref.default ? `${ref.name} (default)` : ref.name,
        value: ref.name,
      })),
    [refsData?.refs],
  );
  const refSelectorWidthCh = useMemo(() => {
    const labels = refOptions.map((option) => option.label.length);
    const fallbackLength = effectiveRef?.length ?? 12;
    return Math.max(0, fallbackLength, ...labels) + 0.25;
  }, [effectiveRef, refOptions]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) return [];
    return (treeData?.entries ?? [])
      .filter((entry) => {
        const haystacks = [entry.name, entry.path]
          .filter(Boolean)
          .map((value) => value.toLowerCase());
        return haystacks.some((value) => value.includes(normalizedSearchQuery));
      })
      .slice(0, 12);
  }, [normalizedSearchQuery, treeData?.entries]);
  const isSearchOpen = normalizedSearchQuery.length > 0;
  const currentPathSegments = currentPath.split('/').filter(Boolean);
  const isRootView = currentPathSegments.length === 0;
  const currentRepoPath = [organization, project, ...currentPathSegments].join('/');
  const breadcrumbSegments = currentPathSegments.map((segment, index) => ({
    label: segment,
    pathSegments: currentPathSegments.slice(0, index + 1),
  }));
  const repoRootLabel = {
    label: project,
    pathSegments: [] as Array<string>,
  };
  const breadcrumbLabelClassName =
    'truncate text-[1.1rem] font-semibold leading-tight text-slate-900 hover:text-slate-950';
  const gitCloneCommand = projectStatus?.repository?.url
    ? `git clone ${projectStatus.repository.url}`
    : projectStatus?.config.src_repo
      ? `git clone ${projectStatus.config.src_repo}`
      : '';
  const gitDrsRemoteAddCommand = buildGitDrsRemoteAddCommand(
    organization,
    project,
  );

  const handleRefresh = async () => {
    setActionError(null);
    try {
      await refreshProject({ organization, project }).unwrap();
      await Promise.all([refetchStatus(), refetchRefs(), refetchTree()]);
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error
          ? JSON.stringify((error as { data: unknown }).data)
          : 'Failed to refresh the repository mirror.';
      setActionError(message);
    }
  };

  const handleLFSDownload = async (checksum: string) => {
    setActionError(null);
    setDownloadingChecksum(checksum);
    try {
      const response = await lookupSyfonObjectsByChecksum(checksum).unwrap();
      const objectId = response.resolved_drs_object?.[0]?.id;
      if (!objectId) {
        setActionError(
          `No Syfon object was found for LFS checksum ${checksum}.`,
        );
        return;
      }
      window.open(
        buildSyfonDownloadUrl(objectId),
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      setActionError(
        `Failed to resolve a Syfon download for LFS checksum ${checksum}.`,
      );
    } finally {
      setDownloadingChecksum(null);
    }
  };

  const handleOpenFile = (path: string) => {
    const encodedPath = path
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const query = selectedRef ? `?ref=${encodeURIComponent(selectedRef)}` : '';
    void router.push(
      `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/blob/${encodedPath}${query}`,
    );
  };

  const handleFileDownload = async (path: string) => {
    setActionError(null);
    try {
      const response = await getGitProjectFile({
        organization,
        project,
        path,
        ref: effectiveRef ?? undefined,
      }).unwrap();
      if (!response.download_url) {
        setActionError(`No GitHub download URL is available for ${path}.`);
        return;
      }
      window.open(response.download_url, '_blank', 'noopener,noreferrer');
    } catch {
      setActionError(`Failed to resolve a GitHub download URL for ${path}.`);
    }
  };

  const navigateToPath = (pathSegments: Array<string>) => {
    const nextQuery: Record<string, string> = {};
    if (effectiveRef) {
      nextQuery.ref = effectiveRef;
    }
    if (pathSegments.length > 0) {
      nextQuery.path = pathSegments.join('/');
    }

    void router.push(
      {
        pathname: '/git/[org]/project/[project]',
        query: {
          org: organization,
          project,
          ...nextQuery,
        },
      },
      undefined,
      { shallow: true },
    );
  };

  const renderBreadcrumbButton = (
    label: string,
    pathSegments: Array<string>,
  ) => (
    <button
      className={`${breadcrumbLabelClassName} max-w-[220px]`}
      onClick={() => navigateToPath(pathSegments)}
      type="button"
    >
      {label}
    </button>
  );

  const copyCurrentRepoPath = async () => {
    await navigator.clipboard.writeText(currentRepoPath);
    setHasCopiedRepoPath(true);
    window.setTimeout(() => setHasCopiedRepoPath(false), 2000);
  };

  const copyCloneCommand = async () => {
    if (!gitCloneCommand) return;
    await navigator.clipboard.writeText(gitCloneCommand);
    setHasCopiedCloneCommand(true);
    window.setTimeout(() => setHasCopiedCloneCommand(false), 2000);
  };

  const copyGitDrsRemoteAddCommand = async () => {
    await navigator.clipboard.writeText(gitDrsRemoteAddCommand);
    setHasCopiedRemoteCommand(true);
    window.setTimeout(() => setHasCopiedRemoteCommand(false), 2000);
  };

  const openSearchResult = (entry: GeckoGitTreeEntry) => {
    setSearchQuery('');
    if (entry.type === 'tree') {
      navigateToPath(entry.path.split('/').filter(Boolean));
      return;
    }
    handleOpenFile(entry.path);
  };

  const repositoryTable = (
    <Card padding={0} radius="md" withBorder>
      <ScrollArea>
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th className="pl-3 pr-4 py-2 text-xs">
                Name
              </Table.Th>
              <Table.Th className="px-4 py-2 text-xs">
                Description
              </Table.Th>
              <Table.Th
                className="px-4 py-2 text-xs"
                w={120}
              >
                Size
              </Table.Th>
              <Table.Th
                className="px-4 py-2 text-xs"
                w={180}
              >
                Updated
              </Table.Th>
              <Table.Th
                className="pl-4 pr-3 py-2 text-xs"
                ta="right"
                w={96}
              >
                Actions
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isTreeLoading ? (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" py="xl" ta="center">
                    Loading repository tree...
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : treeData?.entries?.length ? (
              treeData.entries.map((entry) => (
                <Table.Tr
                  className="cursor-pointer"
                  key={`${entry.type}:${entry.path}`}
                  onClick={() => {
                    if (entry.type === 'tree') {
                      navigateToPath(
                        entry.path.split('/').filter(Boolean),
                      );
                    } else {
                      handleOpenFile(entry.path);
                    }
                  }}
                >
                  <Table.Td className="pl-3 pr-4 py-1">
                    <div className="flex w-full items-center gap-2.5 px-1.5 py-1">
                      {entry.type === 'tree' ? (
                        <IconFolder
                          className="text-sky-600"
                          size={16}
                        />
                      ) : (
                        <IconFile
                          className="text-slate-500"
                          size={16}
                        />
                      )}
                      <div className="min-w-0">
                        <Text fw={600} size="sm">
                          {entry.name}
                        </Text>
                        {entry.type === 'tree' ? (
                          <Text c="dimmed" size="xs">
                            Derived folder
                          </Text>
                        ) : null}
                      </div>
                    </div>
                  </Table.Td>
                  <Table.Td className="px-4 py-1">
                    <Group gap="xs" wrap="nowrap">
                      <Text c="dimmed" size="sm">
                        {entry.lfs_pointer
                          ? 'Git LFS pointer'
                          : entry.type === 'tree'
                            ? 'Derived folder'
                            : 'Tracked file'}
                      </Text>
                      {entry.lfs_pointer ? (
                        <Text
                          c="violet"
                          fw={700}
                          size="xs"
                          tt="uppercase"
                        >
                          LFS
                        </Text>
                      ) : null}
                    </Group>
                  </Table.Td>
                  <Table.Td className="px-4 py-1">
                    <Text size="sm">
                      {entry.type === 'tree'
                        ? '—'
                        : entry.lfs_pointer
                          ? formatBytes(entry.lfs_pointer.size)
                          : entry.size
                            ? formatBytes(entry.size)
                            : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td className="px-4 py-1">
                    <Text size="sm">
                      {formatRelativeDate(entry.last_modified_at)}
                    </Text>
                  </Table.Td>
                  <Table.Td className="pl-4 pr-3 py-1">
                    <Group justify="flex-end">
                      {entry.lfs_pointer ? (
                        <Tooltip label="Download LFS object from Syfon">
                          <ActionIcon
                            aria-label={`Download LFS object for ${entry.path}`}
                            color="violet"
                            loading={
                              downloadingChecksum ===
                              entry.lfs_pointer.oid
                            }
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleLFSDownload(
                                entry.lfs_pointer!.oid,
                              );
                            }}
                            size="md"
                            variant="subtle"
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : entry.type === 'blob' ? (
                        <Tooltip label="Download file">
                          <ActionIcon
                            aria-label={`Download ${entry.path}`}
                            loading={isResolvingFileDownload}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleFileDownload(entry.path);
                            }}
                            size="md"
                            variant="subtle"
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                      ) : (
                        <Text c="dimmed" size="sm">
                          —
                        </Text>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))
            ) : (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" py="xl" ta="center">
                    {projectStatus?.installation_state !==
                    'connected'
                      ? projectStatus?.organization_app_installed
                        ? 'Configure repository access from the main /git page first.'
                        : 'Connect the GitHub App from the main /git page first.'
                      : projectStatus?.mirror_ready
                        ? 'No entries found for this folder.'
                        : 'Loading repository tree...'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: `${organization}/${project}`,
        key: 'gecko-git-project',
        title: `${organization}/${project}`,
      }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f6f8fa]">
          <Container py="md" size="xl">
            <Stack gap="sm">
              <Group justify="space-between" gap="xs" wrap="nowrap">
                {isRootView ? (
                  <Group className="min-w-0 flex-1" gap={6} wrap="nowrap">
                    <Link
                      href={`/git/${encodeURIComponent(organization)}`}
                      legacyBehavior
                    >
                      <a className="min-w-0 no-underline text-primary hover:underline">
                        <Title
                          className="truncate text-[1.1rem] leading-tight"
                          order={3}
                        >
                          {organization}
                        </Title>
                      </a>
                    </Link>
                    <Text c="dimmed" fw={700} size="sm">
                      /
                    </Text>
                    {renderBreadcrumbButton(
                      repoRootLabel.label,
                      repoRootLabel.pathSegments,
                    )}
                  </Group>
                ) : (
                  <div />
                )}
                <Group gap="xs" wrap="nowrap">
                  <Button
                    className="px-2"
                    disabled={isRefreshing}
                    onClick={handleRefresh}
                    size="xs"
                    variant="default"
                  >
                    {isRefreshing ? 'Refreshing...' : 'Refresh repository'}
                  </Button>
                  <Button
                    className="px-2"
                    onClick={() => setIsUploadOpen(true)}
                    size="xs"
                    variant="default"
                  >
                    Upload files
                  </Button>
                  <Tooltip label="Open raw Syfon project view">
                    <ActionIcon
                      aria-label="Open Syfon project view"
                      component="a"
                      href={`/organization/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`}
                      size="lg"
                      variant="subtle"
                    >
                      <IconDatabaseExport size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>

              {!isRootView ? (
                <Card padding="md" radius="md" withBorder>
                  <Group
                    align="center"
                    justify="space-between"
                    wrap="nowrap"
                  >
                    <Group className="min-w-0 flex-1" gap={8} wrap="nowrap">
                      <div style={{ width: `${refSelectorWidthCh}ch` }}>
                        <Select
                          data={refOptions}
                          disabled={areRefsLoading || refOptions.length === 0}
                          leftSection={<IconGitBranch size={15} />}
                          onChange={(value) => {
                            void router.push({
                              pathname: `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`,
                              query: {
                                ...(value ? { ref: value } : {}),
                                ...(currentPath
                                  ? { path: currentPath }
                                  : {}),
                              },
                            });
                          }}
                          placeholder={
                            areRefsLoading ? 'Loading refs...' : 'Default ref'
                          }
                          size="xs"
                          styles={{
                            input: {
                              minWidth: 'unset',
                              paddingLeft: '2rem',
                              paddingRight: '1.5rem',
                            },
                            section: {
                              width: '1.75rem',
                            },
                          }}
                          value={effectiveRef}
                        />
                      </div>
                      <Link
                        href={`/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${effectiveRef ? `?ref=${encodeURIComponent(effectiveRef)}` : ''}`}
                        legacyBehavior
                      >
                        <a className="min-w-0 no-underline text-primary hover:underline">
                          <Title
                            className="truncate text-[1.1rem] leading-tight"
                            order={3}
                          >
                            {project}
                          </Title>
                        </a>
                      </Link>
                      {breadcrumbSegments.map((breadcrumb) => (
                        <React.Fragment key={breadcrumb.pathSegments.join('/')}>
                          <Text c="dimmed" fw={700} size="sm">
                            /
                          </Text>
                          {renderBreadcrumbButton(
                            breadcrumb.label,
                            breadcrumb.pathSegments,
                          )}
                        </React.Fragment>
                      ))}
                      <ActionIcon
                        aria-label="Copy repository path"
                        color={hasCopiedRepoPath ? 'primary.0' : 'gray'}
                        onClick={() => {
                          void copyCurrentRepoPath();
                        }}
                        size="sm"
                        variant="subtle"
                      >
                        {hasCopiedRepoPath ? (
                          <IconCheck size={16} />
                        ) : (
                          <IconCopy size={16} />
                        )}
                      </ActionIcon>
                    </Group>
                    <Group gap={8} wrap="nowrap">
                      <Popover
                        withinPortal
                      >
                        <Popover.Target>
                          <TextInput
                            className="w-[18rem]"
                            leftSection={<IconSearch size={16} />}
                            onChange={(event) =>
                              setSearchQuery(event.currentTarget.value)
                            }
                            placeholder="Go to file"
                            rightSection={
                              searchQuery ? (
                                <ActionIcon
                                  aria-label="Clear file search"
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
                          <div className="max-h-[26rem] overflow-y-auto py-2">
                            {searchResults.length > 0 ? (
                              searchResults.map((entry) => (
                                <button
                                  className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                  key={`${entry.type}:${entry.path}`}
                                  onClick={() => openSearchResult(entry)}
                                  type="button"
                                >
                                  {entry.type === 'tree' ? (
                                    <IconFolder
                                      className="mt-0.5 text-sky-600"
                                      size={16}
                                    />
                                  ) : (
                                    <IconFile
                                      className="mt-0.5 text-slate-500"
                                      size={16}
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <Text fw={600} size="sm">
                                      {entry.name}
                                    </Text>
                                    <Text c="dimmed" className="truncate" size="xs">
                                      {entry.path}
                                    </Text>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <Text c="dimmed" className="px-3 py-3" size="sm">
                                No files match “{searchQuery}”.
                              </Text>
                            )}
                          </div>
                        </Popover.Dropdown>
                      </Popover>
                    </Group>
                  </Group>
                </Card>
              ) : null}

              {actionError ? (
                <Alert color="red" variant="light">
                  {actionError}
                </Alert>
              ) : null}

              {projectStatus?.last_error ? (
                <Alert color="red" variant="light">
                  {projectStatus.last_error}
                </Alert>
              ) : null}
              {projectStatus?.installation_state !== 'connected' ? (
                <Alert color="blue" variant="light">
                  {projectStatus?.organization_app_installed
                    ? 'This organization has the GitHub App installed, but this tracked repository is not configured yet. Update repository access from '
                    : 'This organization does not have the GitHub App installed yet. Connect it from '}
                  <Link
                    href="/git"
                    legacyBehavior
                  >
                    <a className="font-medium underline">
                      /git
                    </a>
                  </Link>{' '}
                  {projectStatus?.organization_app_installed
                    ? 'to include this repository.'
                    : 'before refreshing this repository mirror.'}
                </Alert>
              ) : null}

              <Modal
                centered
                onClose={() => setIsUploadOpen(false)}
                opened={isUploadOpen}
                size="xl"
                title="Upload files"
              >
                <Upload
                  embedded
                  hideScopeControls
                  initialOrganization={organization}
                  initialProject={project}
                  initialSubdirectory={currentPath}
                  lockOrganization
                  lockProject
                  lockSubdirectory
                />
              </Modal>

              {isRootView ? (
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <Stack gap="sm">
                    <Card padding="md" radius="md" withBorder>
                      <Group
                        align="center"
                        justify="space-between"
                        wrap="nowrap"
                      >
                        <Group gap={8} wrap="nowrap">
                          <div style={{ width: `${refSelectorWidthCh}ch` }}>
                            <Select
                              data={refOptions}
                              disabled={areRefsLoading || refOptions.length === 0}
                              leftSection={<IconGitBranch size={15} />}
                              onChange={(value) => {
                                void router.push({
                                  pathname: `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`,
                                  query: {
                                    ...(value ? { ref: value } : {}),
                                  },
                                });
                              }}
                              placeholder={
                                areRefsLoading ? 'Loading refs...' : 'Default ref'
                              }
                              size="xs"
                              styles={{
                                input: {
                                  minWidth: 'unset',
                                  paddingLeft: '2rem',
                                  paddingRight: '1.5rem',
                                },
                                section: {
                                  width: '1.75rem',
                                },
                              }}
                              value={effectiveRef}
                            />
                          </div>
                        </Group>
                        <Group gap={8} wrap="nowrap">
                          <Popover
                            opened={isSearchOpen}
                            position="bottom-end"
                            shadow="md"
                            width={360}
                            withinPortal
                          >
                            <Popover.Target>
                              <TextInput
                                className="w-[18rem]"
                                leftSection={<IconSearch size={16} />}
                                onChange={(event) =>
                                  setSearchQuery(event.currentTarget.value)
                                }
                                placeholder="Go to file"
                                rightSection={
                                  searchQuery ? (
                                    <ActionIcon
                                      aria-label="Clear file search"
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
                              <div className="max-h-[26rem] overflow-y-auto py-2">
                                {searchResults.length > 0 ? (
                                  searchResults.map((entry) => (
                                    <button
                                      className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-slate-50"
                                      key={`${entry.type}:${entry.path}`}
                                      onClick={() => openSearchResult(entry)}
                                      type="button"
                                    >
                                      {entry.type === 'tree' ? (
                                        <IconFolder
                                          className="mt-0.5 text-sky-600"
                                          size={16}
                                        />
                                      ) : (
                                        <IconFile
                                          className="mt-0.5 text-slate-500"
                                          size={16}
                                        />
                                      )}
                                      <div className="min-w-0">
                                        <Text fw={600} size="sm">
                                          {entry.name}
                                        </Text>
                                        <Text c="dimmed" className="truncate" size="xs">
                                          {entry.path}
                                        </Text>
                                      </div>
                                    </button>
                                  ))
                                ) : (
                                  <Text c="dimmed" className="px-3 py-3" size="sm">
                                    No files match “{searchQuery}”.
                                  </Text>
                                )}
                              </div>
                            </Popover.Dropdown>
                          </Popover>
                          <Menu
                            position="bottom-end"
                            shadow="md"
                            width={420}
                            withinPortal
                          >
                            <Menu.Target>
                              <Button
                                className="px-2"
                                leftSection={<IconTerminal2 size={16} />}
                                rightSection={<IconChevronDown size={14} />}
                                size="xs"
                                variant="default"
                              >
                                Remote add
                              </Button>
                            </Menu.Target>
                            <Menu.Dropdown>
                              <div className="space-y-3 px-3 py-2">
                                <div className="space-y-2">
                                  <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                                    Clone repository
                                  </Text>
                                  <Code
                                    block
                                    className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-slate-50 p-2 text-[12px]"
                                  >
                                    {gitCloneCommand || 'Unavailable'}
                                  </Code>
                                  <Group justify="space-between" wrap="nowrap">
                                    <Text c="dimmed" size="xs">
                                      Clone the upstream GitHub repository.
                                    </Text>
                                    <Button
                                      className="px-2"
                                      disabled={!gitCloneCommand}
                                      leftSection={
                                        hasCopiedCloneCommand ? (
                                          <IconCheck size={14} />
                                        ) : (
                                          <IconCopy size={14} />
                                        )
                                      }
                                      onClick={() => {
                                        void copyCloneCommand();
                                      }}
                                      size="xs"
                                      variant={hasCopiedCloneCommand ? 'light' : 'default'}
                                    >
                                      {hasCopiedCloneCommand ? 'Copied' : 'Copy'}
                                    </Button>
                                  </Group>
                                </div>
                                <div className="space-y-2">
                                  <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                                    Git-DRS Remote
                                  </Text>
                                  <Code
                                    block
                                    className="overflow-x-auto whitespace-pre-wrap break-all rounded-md border border-slate-200 bg-slate-50 p-2 text-[12px]"
                                  >
                                    {gitDrsRemoteAddCommand}
                                  </Code>
                                  <Group justify="space-between" wrap="nowrap">
                                    <Text c="dimmed" size="xs">
                                      Attach the Gen3-backed remote to an existing clone.
                                    </Text>
                                    <Button
                                      className="px-2"
                                      leftSection={
                                        hasCopiedRemoteCommand ? (
                                          <IconCheck size={14} />
                                        ) : (
                                          <IconCopy size={14} />
                                        )
                                      }
                                      onClick={() => {
                                        void copyGitDrsRemoteAddCommand();
                                      }}
                                      size="xs"
                                      variant={hasCopiedRemoteCommand ? 'light' : 'default'}
                                    >
                                      {hasCopiedRemoteCommand ? 'Copied' : 'Copy'}
                                    </Button>
                                  </Group>
                                </div>
                              </div>
                            </Menu.Dropdown>
                          </Menu>
                        </Group>
                      </Group>
                    </Card>
                    {repositoryTable}
                  </Stack>
                  <Stack gap="md" px="sm">
                    <Text fw={700} size="xl">
                      About
                    </Text>
                    <Text size="sm">
                      {projectStatus?.config.description || 'No description provided.'}
                    </Text>
                    <Stack gap="sm">
                      <Group align="flex-start" gap="sm" wrap="nowrap">
                        <IconLink className="mt-0.5 text-slate-500" size={16} />
                        <div className="min-w-0">
                          {projectStatus?.config.src_repo ? (
                            <Anchor
                              href={projectStatus?.repository.url}
                              rel="noreferrer"
                              size="sm"
                              target="_blank"
                            >
                              {projectStatus.config.src_repo}
                            </Anchor>
                          ) : (
                            <Text size="sm">Unavailable</Text>
                          )}
                        </div>
                      </Group>
                      <Group align="flex-start" gap="sm" wrap="nowrap">
                        <IconClock className="mt-0.5 text-slate-500" size={16} />
                        <Text size="sm">
                          {projectStatus?.last_refreshed_at ?? 'Never'}
                        </Text>
                      </Group>
                      <Group align="flex-start" gap="sm" wrap="nowrap">
                        <IconMail className="mt-0.5 text-slate-500" size={16} />
                        <Text size="sm">
                          {projectStatus?.config.contact_email || 'Unavailable'}
                        </Text>
                      </Group>
                    </Stack>
                  </Stack>
                </div>
              ) : (
                repositoryTable
              )}
            </Stack>
          </Container>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitProjectPage;
