import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Code,
  Container,
  Group,
  Menu,
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
  useGetExplorerStateV1Query,
  useLazyGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectsQuery,
  useGetGeckoGitProjectRefsQuery,
  useGetGeckoGitProjectTreeQuery,
  useRefreshGeckoGitProjectMutation,
  type GeckoGitRefreshResponse,
  type GeckoGitProjectStatus,
  type GeckoGitTreeEntry,
} from '@gen3/core';
import {
  IconCheck,
  IconChevronDown,
  IconCopy,
  IconDownload,
  IconFile,
  IconFolder,
  IconGitBranch,
  IconLink,
  IconMail,
  IconPhoto,
  IconSearch,
  IconTerminal2,
  IconClock,
  IconX,
} from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import {
  NavPageLayout,
  ProjectWorkspaceTabs,
} from '../../features/Navigation';
import type { FileActionsConfig } from '../../features/CohortBuilder/types';
import { getFileExtensionCandidates } from '../OrganizationExplorer/utils';
import { useIsEmbedded } from '../../utils';
import type { GitExplorerPageProps } from './types';
import GitUploadPRModal from './GitUploadPRModal';
import { hardNavigate } from './navigation';

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

const OME_TIFF_SUFFIX = '.ome.tiff';
const OFFSETS_JSON_SUFFIX = '.offsets.json';

const getConfiguredGitEntryActions = (
  path: string,
  fileActions?: FileActionsConfig,
): Array<string> => {
  const configuredFromExtensions = getFileExtensionCandidates(path).flatMap(
    (extension) => fileActions?.extensions?.[extension] ?? [],
  );
  const configured = Array.from(
    new Set([
      ...configuredFromExtensions,
      ...(configuredFromExtensions.length === 0
        ? (fileActions?.extensions?.default ?? ['file_download'])
        : []),
    ]),
  );

  return configured.includes('file_download')
    ? configured
    : ['file_download', ...configured];
};

const hasMatchingOffsetsEntry = (
  path: string,
  entries: Array<GeckoGitTreeEntry>,
): boolean => {
  const normalizedPath = path.trim().toLowerCase();
  if (!normalizedPath.endsWith(OME_TIFF_SUFFIX)) {
    return false;
  }

  const expectedOffsetsPath = `${normalizedPath.slice(
    0,
    -OME_TIFF_SUFFIX.length,
  )}${OFFSETS_JSON_SUFFIX}`;
  return entries.some(
    (candidate) =>
      candidate.type === 'blob' &&
      candidate.path.trim().toLowerCase() === expectedOffsetsPath,
  );
};

const TRANSIENT_ALERT_TIMEOUT_MS = 5000;
const MIRROR_STATUS_POLL_INTERVAL_MS = 1000;
const isPersistentGitProjectError = (message: string | null | undefined) =>
  (message ?? '').toLowerCase().includes('remote repository is empty');

interface GitProjectSuccessBanner {
  readonly branchName: string;
  readonly pullRequestURL: string;
}

const GitProjectPage = ({
  headerProps,
  footerProps,
  fileActions,
  pageProblems,
}: GitExplorerPageProps) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const requestedRef =
    typeof router.query.ref === 'string' ? router.query.ref : null;
  const requestedPath =
    typeof router.query.path === 'string' ? router.query.path : '';
  const isEmbedded = useIsEmbedded();

  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>(requestedPath);
  const [actionError, setActionError] = useState<string | null>(null);
  const [visibleProjectError, setVisibleProjectError] = useState<string | null>(
    null,
  );
  const [successBanner, setSuccessBanner] =
    useState<GitProjectSuccessBanner | null>(null);
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
    data: gitProjects = [],
    isLoading: isStatusLoading,
    refetch: refetchGitProjects,
  } = useGetGeckoGitProjectsQuery();
  const { data: explorer } = useGetExplorerStateV1Query(
    { project: `${organization}/${project}`, explorerId: 'default' },
    {
      skip: !organization || !project,
    },
  );
  const projectStatus = useMemo(
    () =>
      gitProjects.find(
        (candidate) =>
          candidate.organization === organization && candidate.project === project,
      ),
    [gitProjects, organization, project],
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
      includeLastModified: true,
      includeLFSPointer: true,
      include_last_modified: true,
      include_lfs_pointer: true,
      include_size: true,
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
    if (!actionError) {
      return;
    }
    if (isPersistentGitProjectError(actionError)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setActionError(null);
    }, TRANSIENT_ALERT_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [actionError]);

  useEffect(() => {
    const nextError = projectStatus?.last_error?.trim() || null;
    setVisibleProjectError(nextError);
    if (!nextError || isPersistentGitProjectError(nextError)) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setVisibleProjectError((current) =>
        current === nextError ? null : current,
      );
    }, TRANSIENT_ALERT_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [projectStatus?.last_error]);

  useEffect(() => {
    if (
      shouldSkip ||
      isStatusLoading ||
      projectStatus?.installation_state !== 'connected' ||
      projectStatus?.mirror_ready
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refetchGitProjects();
    }, MIRROR_STATUS_POLL_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [
    isStatusLoading,
    projectStatus?.installation_state,
    projectStatus?.mirror_ready,
    refetchGitProjects,
    shouldSkip,
  ]);

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
  const hasNoRepositoryBranches =
    projectStatus?.installation_state === 'connected' &&
    projectStatus?.mirror_ready &&
    !areRefsLoading &&
    refOptions.length === 0;
  const isRepositoryUninitialized =
    hasNoRepositoryBranches && !projectStatus?.default_branch;
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
  const hasExplorerConfig = Boolean(explorer);
  const effectiveFileActions: FileActionsConfig | undefined = fileActions;
  const gitProjectHref = useMemo(() => {
    const query = new URLSearchParams();
    if (effectiveRef) {
      query.set('ref', effectiveRef);
    }
    if (currentPath) {
      query.set('path', currentPath);
    }
    const serialized = query.toString();
    return `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${serialized ? `?${serialized}` : ''}`;
  }, [currentPath, effectiveRef, organization, project]);

  const handleRefresh = async () => {
    setActionError(null);
    try {
      const refreshResponse = (await refreshProject({
        organization,
        project,
      }).unwrap()) as GeckoGitRefreshResponse;
      refreshResponse.default_branch?.trim();
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'data' in error
          ? JSON.stringify((error as { data: unknown }).data)
          : 'Failed to refresh the repository mirror.';
      setActionError(message);
      return;
    }

    try {
      const statusResult = (await refetchGitProjects()) as {
        data?: Array<GeckoGitProjectStatus>;
      };
      const refreshedDefaultBranch = statusResult.data
        ?.find(
          (candidate) =>
            candidate.organization === organization && candidate.project === project,
        )
        ?.default_branch?.trim();

      if (!refreshedDefaultBranch) {
        setSelectedRef(null);
        await Promise.allSettled([refetchTree()]);
        return;
      }

      await Promise.allSettled([refetchRefs(), refetchTree()]);
    } catch {
      // Ignore follow-up refetch failures. The refresh itself already succeeded,
      // and transient query issues should not surface as a repository refresh error.
    }
  };

  const handleLFSDownload = async (checksum: string, path?: string) => {
    setActionError(null);
    setDownloadingChecksum(checksum);
    try {
      window.open(
        buildSyfonDownloadUrl(checksum),
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      if (path) {
        await handleFileDownload(path);
        return;
      }
      setActionError(
        `Failed to resolve a Syfon download for LFS checksum ${checksum}.`,
      );
    } finally {
      setDownloadingChecksum(null);
    }
  };

  const handleLFSImageViewerOpen = (checksum: string) => {
    setActionError(null);
    setDownloadingChecksum(checksum);
    try {
      window.open(
        `/image-viewer/view/${encodeURIComponent(checksum)}`,
        '_blank',
        'noopener,noreferrer',
      );
    } catch {
      setActionError(
        `Failed to open the image viewer for LFS checksum ${checksum}.`,
      );
    } finally {
      setDownloadingChecksum(null);
    }
  };

  const canOpenGitImageViewer = (entry: GeckoGitTreeEntry): boolean => {
    if (!entry.lfs_pointer) {
      return false;
    }

    return (
      getConfiguredGitEntryActions(entry.path, effectiveFileActions).includes(
        'file_image',
      ) || hasMatchingOffsetsEntry(entry.path, treeData?.entries ?? [])
    );
  };

  const handleOpenFile = (path: string) => {
    const encodedPath = path
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const query = selectedRef ? `?ref=${encodeURIComponent(selectedRef)}` : '';
    hardNavigate(
      router,
      `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/blob/${encodedPath}${query}`,
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

    const queryString = new URLSearchParams(nextQuery).toString();
    hardNavigate(
      router,
      `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${queryString ? `?${queryString}` : ''}`,
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
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          {canOpenGitImageViewer(entry) ? (
                            <Tooltip label="Open image viewer">
                              <ActionIcon
                                aria-label={`Open image viewer for ${entry.path}`}
                                color="teal"
                                loading={
                                  downloadingChecksum === entry.lfs_pointer.oid
                                }
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  void handleLFSImageViewerOpen(
                                    entry.lfs_pointer!.oid,
                                  );
                                }}
                                size="md"
                                variant="subtle"
                              >
                                <IconPhoto size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : null}
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
                                  entry.path,
                                );
                              }}
                              size="md"
                              variant="subtle"
                            >
                              <IconDownload size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
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
                        : 'Initializing repository mirror...'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Card>
  );

  const gitProjectContent = (
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
                  {!hasNoRepositoryBranches ? (
                    <Button
                      className="px-2"
                      onClick={() => setIsUploadOpen(true)}
                      size="xs"
                      variant="default"
                    >
                      Upload files
                    </Button>
                  ) : null}
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
                              const query = new URLSearchParams();
                              if (value) query.set('ref', value);
                              if (currentPath) query.set('path', currentPath);
                              hardNavigate(
                                router,
                                `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${query.toString() ? `?${query.toString()}` : ''}`,
                              );
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
                      <a
                        className="min-w-0 no-underline text-primary hover:underline"
                        href={`${router.basePath ?? ''}/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${effectiveRef ? `?ref=${encodeURIComponent(effectiveRef)}` : ''}`}
                      >
                        <Title
                          className="truncate text-[1.1rem] leading-tight"
                          order={3}
                        >
                          {project}
                        </Title>
                      </a>
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

              {visibleProjectError ? (
                <Alert color="red" variant="light">
                  {visibleProjectError}
                </Alert>
              ) : null}
              {successBanner ? (
                <Alert color="green" variant="light">
                  Pull request created on branch{' '}
                  <Code>{successBanner.branchName}</Code>.{' '}
                  <a
                    className="text-primary hover:underline"
                    href={successBanner.pullRequestURL}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open pull request
                  </a>
                </Alert>
              ) : null}
              {isRepositoryUninitialized ? (
                <Alert color="yellow" variant="light">
                  This repository has no default branch yet. Initialize your
                  repo first before uploading files.
                </Alert>
              ) : null}
              {projectStatus?.installation_state !== 'connected' ? (
                <Alert color="blue" variant="light">
                  {projectStatus?.organization_app_installed
                    ? 'GitHub is not connected for this project yet. Update repository access from '
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

              {isUploadOpen ? (
                <GitUploadPRModal
                  initialBaseBranch={effectiveRef ?? projectStatus?.default_branch}
                  isRepositoryUninitialized={isRepositoryUninitialized}
                  onClose={() => setIsUploadOpen(false)}
                  onSuccess={(result) => {
                    setSuccessBanner(result);
                    setIsUploadOpen(false);
                  }}
                  opened={isUploadOpen}
                  organization={organization}
                  project={project}
                  refs={refsData?.refs ?? []}
                  targetSubdirectory={currentPath}
                />
              ) : null}

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
                                const query = new URLSearchParams();
                                if (value) query.set('ref', value);
                                hardNavigate(
                                  router,
                                  `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}${query.toString() ? `?${query.toString()}` : ''}`,
                                );
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
                            width={380}
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
                              <div className="space-y-2.5 px-2.5 py-2">
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                  <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                                    Clone repository
                                  </Text>
                                  <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[11px] leading-5 text-slate-900">
                                    <Text
                                      className="overflow-x-auto whitespace-pre-wrap break-all"
                                      component="div"
                                      inherit
                                    >
                                      {gitCloneCommand || 'Unavailable'}
                                    </Text>
                                  </div>
                                  <Group className="mt-2" justify="space-between" wrap="nowrap">
                                    <Text c="dimmed" className="pr-3 leading-4" size="xs">
                                      Clone the upstream GitHub repository.
                                    </Text>
                                    <Button
                                      className="shrink-0 px-2"
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
                                      size="compact-xs"
                                      variant={hasCopiedCloneCommand ? 'light' : 'default'}
                                    >
                                      {hasCopiedCloneCommand ? 'Copied' : 'Copy'}
                                    </Button>
                                  </Group>
                                </div>
                                <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                                  <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                                    Git-DRS Remote
                                  </Text>
                                  <div className="mt-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 font-mono text-[11px] leading-5 text-slate-900">
                                    <Text
                                      className="overflow-x-auto whitespace-pre-wrap break-all"
                                      component="div"
                                      inherit
                                    >
                                      {gitDrsRemoteAddCommand}
                                    </Text>
                                  </div>
                                  <Group className="mt-2" justify="space-between" wrap="nowrap">
                                    <Text c="dimmed" className="pr-3 leading-4" size="xs">
                                      Attach the Gen3-backed remote to an existing clone.
                                    </Text>
                                    <Button
                                      className="shrink-0 px-2"
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
                                      size="compact-xs"
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
                            <a
                              className="text-primary hover:underline text-sm"
                              href={projectStatus?.repository.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {projectStatus.config.src_repo}
                            </a>
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
  );

  if (isEmbedded) {
    return <ProtectedContent>{gitProjectContent}</ProtectedContent>;
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
      headerMetadata={{
        content: `${organization}/${project}`,
        key: 'gecko-git-project',
        title: `${organization}/${project}`,
      }}
      mainProps={{ className: 'bg-[#f6f8fa]' }}
    >
      <ProtectedContent>
        <ProjectWorkspaceTabs
          activeTab="git"
          gitHref={gitProjectHref}
          hasExplorerConfig={hasExplorerConfig}
          organization={organization}
          project={project}
        >
          {gitProjectContent}
        </ProjectWorkspaceTabs>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitProjectPage;
