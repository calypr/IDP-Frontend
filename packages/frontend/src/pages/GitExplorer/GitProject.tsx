import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Checkbox,
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
  useCreateFunnelTaskMutation,
  useGetFunnelTaskQuery,
  useLazyGetGeckoGitProjectFileQuery,
  useGetGeckoGitProjectsQuery,
  useGetGeckoGitProjectRefsQuery,
  useGetGeckoGitProjectTreeQuery,
  useRefreshGeckoGitProjectMutation,
  type GeckoGitRefreshResponse,
  type GeckoGitProjectStatus,
  type GeckoGitTreeEntry,
  type FunnelTaskState,
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
import { NavPageLayout, ProjectWorkspaceTabs } from '../../features/Navigation';
import type { FileActionsConfig } from '../../features/CohortBuilder/types';
import { getFileExtensionCandidates } from '../OrganizationExplorer/utils';
import { useIsEmbedded } from '../../utils';
import type { GitExplorerPageProps } from './types';
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

const isGitObjectId = (value: string | undefined): value is string =>
  value !== undefined && /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(value);

const isDirectMetadataNdjson = (entry: GeckoGitTreeEntry): boolean => {
  const pathParts = entry.path.split('/');
  return (
    entry.type === 'blob' &&
    pathParts.length === 2 &&
    pathParts[0] === 'META' &&
    pathParts[1] === entry.name &&
    entry.name !== '.' &&
    entry.name !== '..' &&
    entry.name.endsWith('.ndjson')
  );
};

const isTerminalFunnelTaskState = (state?: FunnelTaskState): boolean =>
  state === 'COMPLETE' ||
  state === 'EXECUTOR_ERROR' ||
  state === 'SYSTEM_ERROR' ||
  state === 'CANCELED';

const getPublishErrorMessage = (error: unknown): string => {
  if (typeof error === 'object' && error !== null && 'data' in error) {
    const errorData = error.data;
    if (typeof errorData === 'string') {
      return errorData;
    }
    if (
      typeof errorData === 'object' &&
      errorData !== null &&
      'message' in errorData &&
      typeof errorData.message === 'string'
    ) {
      return errorData.message;
    }
    return JSON.stringify(errorData) ?? 'The publish request failed.';
  }
  return 'The publish request failed.';
};

type MetadataSelection = {
  readonly scope: string;
  readonly paths: Array<string>;
};

type SubmittedFunnelTask = {
  readonly id: string;
  readonly organization: string;
  readonly project: string;
  readonly revision: string;
  readonly files: Array<string>;
};

type PublishMetadataPayload = {
  readonly organization: string;
  readonly project: string;
  readonly revision: string;
  readonly files: Array<string>;
};

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
  const [metadataSelection, setMetadataSelection] = useState<MetadataSelection>(
    { scope: '', paths: [] },
  );
  const [submittedFunnelTask, setSubmittedFunnelTask] =
    useState<SubmittedFunnelTask | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [visibleProjectError, setVisibleProjectError] = useState<string | null>(
    null,
  );
  const [downloadingChecksum, setDownloadingChecksum] = useState<string | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [hasCopiedRepoPath, setHasCopiedRepoPath] = useState(false);
  const [hasCopiedCloneCommand, setHasCopiedCloneCommand] = useState(false);
  const [hasCopiedRemoteCommand, setHasCopiedRemoteCommand] = useState(false);
  const hasHydratedTreeRef = useRef<string | null>(null);
  const publishRequestStartedRef = useRef(false);

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
          candidate.organization === organization &&
          candidate.project === project,
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
  const resolvedRevision = useMemo(() => {
    const requestedRevision = effectiveRef ?? undefined;
    if (isGitObjectId(requestedRevision)) {
      return requestedRevision;
    }
    const selectedRefData = refsData?.refs.find(
      (ref) => ref.name === effectiveRef,
    );
    return isGitObjectId(selectedRefData?.hash) ? selectedRefData.hash : null;
  }, [effectiveRef, refsData?.refs]);
  const treeRef = resolvedRevision ?? effectiveRef ?? undefined;
  const {
    data: treeData,
    isLoading: isTreeLoading,
    isFetching: isTreeFetching,
    isError: isTreeError,
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
      ref: treeRef,
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
  const [createFunnelTask, { isLoading: isCreatingFunnelTask }] =
    useCreateFunnelTaskMutation();
  const {
    data: funnelTaskStatus,
    isError: isFunnelTaskStatusError,
    isFetching: isFetchingFunnelTaskStatus,
    refetch: refetchFunnelTaskStatus,
  } = useGetFunnelTaskQuery(submittedFunnelTask?.id ?? '', {
    skip: !submittedFunnelTask,
  });
  const funnelTaskIsTerminal = isTerminalFunnelTaskState(
    funnelTaskStatus?.state,
  );
  const isPublishingMetadata =
    submittedFunnelTask !== null && !funnelTaskIsTerminal;

  useEffect(() => {
    if (
      !submittedFunnelTask ||
      funnelTaskIsTerminal ||
      isFetchingFunnelTaskStatus
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refetchFunnelTaskStatus();
    }, 15_000);

    return () => window.clearTimeout(timeout);
  }, [
    funnelTaskIsTerminal,
    isFetchingFunnelTaskStatus,
    refetchFunnelTaskStatus,
    submittedFunnelTask,
  ]);

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
    const nextError =
      projectStatus?.sync_state === 'updating' ||
      projectStatus?.sync_state === 'ready'
        ? null
        : projectStatus?.last_error?.trim() || null;
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
  }, [projectStatus?.last_error, projectStatus?.sync_state]);

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

    const hydrationKey = `${organization}/${project}/${treeRef ?? ''}/${currentPath}`;
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
    treeRef,
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
  const isMetadataDirectory =
    currentPathSegments.length === 1 && currentPathSegments[0] === 'META';
  const isTreeForDisplay =
    (!treeRef || treeData?.ref === treeRef) &&
    treeData?.path === currentPathSegments.join('/');
  const isTreeForResolvedRevision =
    Boolean(resolvedRevision) &&
    treeData?.ref === resolvedRevision &&
    treeData?.path === currentPathSegments.join('/');
  const metadataSelectionScope = JSON.stringify([
    organization,
    project,
    effectiveRef,
    currentPathSegments.join('/'),
    resolvedRevision,
  ]);
  const metadataEntries = useMemo(
    () =>
      isMetadataDirectory && isTreeForDisplay
        ? (treeData?.entries ?? []).filter(isDirectMetadataNdjson)
        : [],
    [isMetadataDirectory, isTreeForDisplay, treeData?.entries],
  );
  const selectedMetadataPaths = useMemo(
    () =>
      metadataSelection.scope === metadataSelectionScope
        ? new Set(metadataSelection.paths)
        : new Set<string>(),
    [metadataSelection, metadataSelectionScope],
  );
  const selectedMetadataFiles = useMemo(
    () =>
      metadataEntries
        .filter((entry) => selectedMetadataPaths.has(entry.path))
        .map((entry) => entry.path),
    [metadataEntries, selectedMetadataPaths],
  );
  useEffect(() => {
    setMetadataSelection((current) =>
      current.scope === metadataSelectionScope
        ? current
        : { scope: metadataSelectionScope, paths: [] },
    );
    setPublishError(null);
  }, [metadataSelectionScope]);
  const canPublishMetadata =
    isMetadataDirectory &&
    isTreeForResolvedRevision === true &&
    projectStatus?.installation_state === 'connected' &&
    projectStatus.mirror_ready &&
    selectedMetadataFiles.length > 0 &&
    !isCreatingFunnelTask &&
    !isPublishingMetadata;
  const currentRepoPath = [organization, project, ...currentPathSegments].join(
    '/',
  );
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
            candidate.organization === organization &&
            candidate.project === project,
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

  const toggleMetadataFile = (path: string, checked: boolean) => {
    if (!metadataEntries.some((entry) => entry.path === path)) {
      return;
    }

    setMetadataSelection((current) => {
      const paths =
        current.scope === metadataSelectionScope ? current.paths : [];
      if (checked) {
        return paths.includes(path)
          ? current
          : { scope: metadataSelectionScope, paths: [...paths, path] };
      }
      return {
        scope: metadataSelectionScope,
        paths: paths.filter((selectedPath) => selectedPath !== path),
      };
    });
  };

  const handlePublishMetadata = async () => {
    if (
      !canPublishMetadata ||
      !resolvedRevision ||
      selectedMetadataFiles.length === 0 ||
      publishRequestStartedRef.current
    ) {
      return;
    }

    publishRequestStartedRef.current = true;
    setPublishError(null);
    const files = [...selectedMetadataFiles];
    const payload: PublishMetadataPayload = {
      organization,
      project,
      revision: resolvedRevision,
      files,
    };

    try {
      const task = await createFunnelTask({
        name: 'Publish metadata',
        tags: {
          'calypr.publish': JSON.stringify(payload),
        },
      }).unwrap();
      setSubmittedFunnelTask({
        id: task.id,
        organization,
        project,
        revision: resolvedRevision,
        files,
      });
      setMetadataSelection({ scope: metadataSelectionScope, paths: [] });
    } catch (error) {
      setPublishError(getPublishErrorMessage(error));
    } finally {
      publishRequestStartedRef.current = false;
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
    window.open(
      `/image-viewer/view/${encodeURIComponent(checksum)}`,
      '_blank',
      'noopener,noreferrer',
    );
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

  const repositoryTableColumnCount = isMetadataDirectory ? 6 : 5;
  const isRepositoryTreeLoading =
    projectStatus?.installation_state === 'connected' &&
    projectStatus.mirror_ready &&
    !isTreeError &&
    (isTreeLoading || isTreeFetching || areRefsLoading);

  const repositoryTable = (
    <Card padding={0} radius="md" withBorder>
      <ScrollArea>
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              {isMetadataDirectory ? (
                <Table.Th className="px-2 py-1" w={36}>
                  <Checkbox
                    aria-label="Select all metadata files"
                    checked={
                      metadataEntries.length > 0 &&
                      selectedMetadataFiles.length === metadataEntries.length
                    }
                    indeterminate={
                      selectedMetadataFiles.length > 0 &&
                      selectedMetadataFiles.length < metadataEntries.length
                    }
                    disabled={metadataEntries.length === 0}
                    onChange={(event) =>
                      setMetadataSelection({
                        scope: metadataSelectionScope,
                        paths: event.currentTarget.checked
                          ? metadataEntries.map((entry) => entry.path)
                          : [],
                      })
                    }
                    size="xs"
                  />
                </Table.Th>
              ) : null}
              <Table.Th className="pl-3 pr-4 py-2 text-xs">Name</Table.Th>
              <Table.Th className="px-4 py-2 text-xs">Description</Table.Th>
              <Table.Th className="px-4 py-2 text-xs" w={120}>
                Size
              </Table.Th>
              <Table.Th className="px-4 py-2 text-xs" w={180}>
                Updated
              </Table.Th>
              <Table.Th className="pl-4 pr-3 py-2 text-xs" ta="right" w={96}>
                Actions
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isRepositoryTreeLoading ? (
              <Table.Tr>
                <Table.Td colSpan={repositoryTableColumnCount}>
                  <Text c="dimmed" py="xl" ta="center">
                    {resolvedRevision || !effectiveRef
                      ? 'Loading repository tree...'
                      : 'Loading repository tree. Metadata publishing needs a resolved commit SHA.'}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : isTreeError ? (
              <Table.Tr>
                <Table.Td colSpan={repositoryTableColumnCount}>
                  <Stack align="center" gap="sm" py="xl">
                    <Text c="red">Could not load this directory.</Text>
                    <Button
                      onClick={() => void refetchTree()}
                      size="xs"
                      variant="light"
                    >
                      Retry
                    </Button>
                  </Stack>
                </Table.Td>
              </Table.Tr>
            ) : isTreeForDisplay && treeData?.entries?.length ? (
              treeData.entries.map((entry) => (
                <Table.Tr
                  className="cursor-pointer"
                  key={`${entry.type}:${entry.path}`}
                  onClick={() => {
                    if (entry.type === 'tree') {
                      navigateToPath(entry.path.split('/').filter(Boolean));
                    } else {
                      handleOpenFile(entry.path);
                    }
                  }}
                >
                  {isMetadataDirectory ? (
                    <Table.Td
                      className="px-2 py-1"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {metadataEntries.some(
                        (metadataEntry) => metadataEntry.path === entry.path,
                      ) ? (
                        <Checkbox
                          aria-label={`Select ${entry.path} for metadata publishing`}
                          checked={selectedMetadataPaths.has(entry.path)}
                          onChange={(event) =>
                            toggleMetadataFile(
                              entry.path,
                              event.currentTarget.checked,
                            )
                          }
                          size="xs"
                        />
                      ) : null}
                    </Table.Td>
                  ) : null}
                  <Table.Td className="pl-3 pr-4 py-1">
                    <div className="flex w-full items-center gap-2.5 px-1.5 py-1">
                      {entry.type === 'tree' ? (
                        <IconFolder className="text-sky-600" size={16} />
                      ) : (
                        <IconFile className="text-slate-500" size={16} />
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
                        <Text c="violet" fw={700} size="xs" tt="uppercase">
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
                                downloadingChecksum === entry.lfs_pointer.oid
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
                <Table.Td colSpan={repositoryTableColumnCount}>
                  <Text c="dimmed" py="xl" ta="center">
                    {projectStatus?.installation_state !== 'connected'
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

  const funnelTaskStatusMessage =
    funnelTaskStatus?.state === 'COMPLETE'
      ? 'Metadata publishing completed.'
      : funnelTaskIsTerminal
        ? `Metadata publishing ended with ${funnelTaskStatus?.state}.`
        : funnelTaskStatus
          ? `Metadata publishing is ${funnelTaskStatus.state.toLowerCase()}.`
          : 'The publish task was submitted. Waiting for task status.';
  const funnelTaskAlertColor =
    funnelTaskStatus?.state === 'COMPLETE'
      ? 'green'
      : funnelTaskIsTerminal
        ? 'red'
        : isFunnelTaskStatusError
          ? 'yellow'
          : 'blue';

  const gitProjectContent = (
    <div className="min-h-screen bg-[#f6f8fa]">
      <Container py="md" size="xl">
        <Stack gap="sm">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            {isRootView ? (
              <Group className="min-w-0 flex-1" gap={6} wrap="nowrap">
                <Link
                  href={`/git/${encodeURIComponent(organization)}`}
                  className="min-w-0 no-underline text-primary hover:underline"
                >
                  <Title
                    className="truncate text-[1.1rem] leading-tight"
                    order={3}
                  >
                    {organization}
                  </Title>
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
            </Group>
          </Group>

          {!isRootView ? (
            <Card padding="md" radius="md" withBorder>
              <Group align="center" justify="space-between" wrap="nowrap">
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
                  <Popover withinPortal>
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

          {visibleProjectError &&
          projectStatus?.sync_state !== 'updating' &&
          projectStatus?.sync_state !== 'ready' ? (
            <Alert color="red" variant="light">
              {visibleProjectError}
            </Alert>
          ) : null}
          {publishError ? (
            <Alert color="red" variant="light">
              {publishError}
            </Alert>
          ) : null}
          {submittedFunnelTask ? (
            <Alert
              color={funnelTaskAlertColor}
              title={funnelTaskStatusMessage}
              variant="light"
            >
              <Stack gap={4}>
                <Text size="sm">
                  {submittedFunnelTask.organization}/
                  {submittedFunnelTask.project} at commit{' '}
                  <span className="font-mono">
                    {submittedFunnelTask.revision}
                  </span>{' '}
                  with {submittedFunnelTask.files.length} file(s).
                </Text>
                {isFunnelTaskStatusError ? (
                  <Text size="sm">
                    Task status could not be read. This page will keep checking.
                  </Text>
                ) : null}
                {funnelTaskStatus?.errorMessage ? (
                  <Text
                    component="pre"
                    size="sm"
                    style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {funnelTaskStatus.errorMessage}
                  </Text>
                ) : null}
                <Group gap="xs">
                  <Text className="font-mono" size="xs">
                    Task {submittedFunnelTask.id}
                  </Text>
                  <Button
                    variant="subtle"
                    size="xs"
                    loading={isFetchingFunnelTaskStatus}
                    onClick={() => void refetchFunnelTaskStatus()}
                  >
                    Refresh task status
                  </Button>
                </Group>
              </Stack>
            </Alert>
          ) : null}
          {projectStatus?.installation_state !== 'connected' ? (
            <Alert color="blue" variant="light">
              {projectStatus?.organization_app_installed
                ? 'GitHub is not connected for this project yet. Update repository access from '
                : 'This organization does not have the GitHub App installed yet. Connect it from '}
              <Link href="/git" className="font-medium underline">
                /git
              </Link>{' '}
              {projectStatus?.organization_app_installed
                ? 'to include this repository.'
                : 'before refreshing this repository mirror.'}
            </Alert>
          ) : null}

          {isMetadataDirectory ? (
            <Card padding="md" radius="md" withBorder>
              <Group align="center" justify="space-between" wrap="wrap">
                <Stack gap={4}>
                  <Text fw={700}>Publish metadata</Text>
                  <Text c="dimmed" size="sm">
                    Publish the selected .ndjson file versions from this commit.
                    Records removed from these files are removed from the
                    published data. Records from other source files are
                    retained.
                  </Text>
                  {resolvedRevision && isTreeForResolvedRevision ? (
                    <Text className="font-mono" size="xs">
                      Revision {resolvedRevision}
                    </Text>
                  ) : resolvedRevision ? (
                    <Text c="dimmed" size="sm">
                      Loading META files at the resolved commit...
                    </Text>
                  ) : areRefsLoading ? (
                    <Text c="dimmed" size="sm">
                      Resolving the selected ref to a commit SHA...
                    </Text>
                  ) : (
                    <Text c="orange" size="sm">
                      This ref has no resolved commit SHA. You can browse files,
                      but publishing stays disabled.
                    </Text>
                  )}
                </Stack>
                <Button
                  disabled={!canPublishMetadata}
                  loading={isCreatingFunnelTask}
                  onClick={() => void handlePublishMetadata()}
                >
                  {isPublishingMetadata
                    ? 'Publishing metadata...'
                    : `Publish metadata (${selectedMetadataFiles.length})`}
                </Button>
              </Group>
            </Card>
          ) : null}

          {isRootView ? (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <Stack gap="sm">
                <Card padding="md" radius="md" withBorder>
                  <Group align="center" justify="space-between" wrap="nowrap">
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
                                    <Text
                                      c="dimmed"
                                      className="truncate"
                                      size="xs"
                                    >
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
                              <Text
                                c="dimmed"
                                fw={700}
                                size="xs"
                                tt="uppercase"
                              >
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
                              <Group
                                className="mt-2"
                                justify="space-between"
                                wrap="nowrap"
                              >
                                <Text
                                  c="dimmed"
                                  className="pr-3 leading-4"
                                  size="xs"
                                >
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
                                  variant={
                                    hasCopiedCloneCommand ? 'light' : 'default'
                                  }
                                >
                                  {hasCopiedCloneCommand ? 'Copied' : 'Copy'}
                                </Button>
                              </Group>
                            </div>
                            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
                              <Text
                                c="dimmed"
                                fw={700}
                                size="xs"
                                tt="uppercase"
                              >
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
                              <Group
                                className="mt-2"
                                justify="space-between"
                                wrap="nowrap"
                              >
                                <Text
                                  c="dimmed"
                                  className="pr-3 leading-4"
                                  size="xs"
                                >
                                  Attach the Gen3-backed remote to an existing
                                  clone.
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
                                  variant={
                                    hasCopiedRemoteCommand ? 'light' : 'default'
                                  }
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
                  {projectStatus?.config.description ||
                    'No description provided.'}
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
