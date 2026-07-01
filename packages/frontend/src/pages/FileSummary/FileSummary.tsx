import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Alert,
  Badge,
  Checkbox,
  Button,
  Center,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
  Pagination,
  Progress,
  Select,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChevronRight,
  IconFile,
  IconFolder,
  IconRefresh,
  IconSelector,
} from '@tabler/icons-react';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout, ProjectWorkspaceTabs } from '../../features/Navigation';
import { formatBytes } from '../../utils/labels';
import { FileSummaryPageProps } from './types';
import {
  type ProjectDiffFinding,
  type ProjectDiffFindingKind,
  type StorageChainFindingKind,
  type StorageChainIssueGroup,
  type StorageCleanupFinding,
  type StorageCleanupFindingKind,
  useFileSummaryProjectOptions,
  useSyfonProjectDiff,
  useSyfonStorageChain,
  useSyfonPathStorageSummary,
  useSyfonStorageCleanup,
} from './hooks';
import { splitProjectSelectionValue, type StoragePathRow } from './storageUtils';

const formatTimestamp = (value?: string): string => {
  if (!value) return '—';

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
};

const getPathSegments = (path: string): Array<string> =>
  path.split('/').filter(Boolean);

type BreadcrumbItem = {
  readonly label: string;
  readonly path: string;
};

type ChainPathTreeNode = {
  label: string;
  path: string;
  isFolder: boolean;
  leafPath?: string;
  descendantLeafPaths: Array<string>;
};

type StorageSortKey =
  | 'name'
  | 'type'
  | 'sizeBytes'
  | 'fileCount'
  | 'downloadCount'
  | 'lastDownload'
  | 'lastUpdated';

type StorageSortDirection = 'asc' | 'desc';

const buildPathsByParentMap = (paths: Array<string>): Map<string, Array<ChainPathTreeNode>> => {
  const map = new Map<string, Array<ChainPathTreeNode>>();
  const seenPaths = new Set<string>();
  const nodesByPath = new Map<string, ChainPathTreeNode>();

  Array.from(new Set(paths.filter(Boolean))).forEach((value) => {
    const segments = value.split('/').filter(Boolean);
    let parentPath = '';
    const pathNodes: Array<ChainPathTreeNode> = [];

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const nodePath = parentPath ? `${parentPath}/${segment}` : segment;
      const isLast = index === segments.length - 1;

      const key = parentPath;
      const uniqKey = `${key}::${nodePath}`;
      let node: ChainPathTreeNode;

      if (!seenPaths.has(uniqKey)) {
        seenPaths.add(uniqKey);
        let list = map.get(key);
        if (!list) {
          list = [];
          map.set(key, list);
        }
        node = {
          label: segment,
          path: nodePath,
          isFolder: !isLast,
          leafPath: isLast ? value : undefined,
          descendantLeafPaths: [],
        };
        list.push(node);
        nodesByPath.set(nodePath, node);
      } else {
        node = nodesByPath.get(nodePath)!;
        if (!isLast) {
          node.isFolder = true;
        }
      }
      pathNodes.push(node);
      parentPath = nodePath;
    }

    pathNodes.forEach((node) => {
      node.descendantLeafPaths.push(value);
    });
  });

  map.forEach((list) => {
    list.sort((left: ChainPathTreeNode, right: ChainPathTreeNode) => {
      if (left.isFolder !== right.isFolder) {
        return left.isFolder ? -1 : 1;
      }
      return left.label.localeCompare(right.label, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  });

  return map;
};

const formatCleanupFindingLabel = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const formatProbeResolution = (
  status?: string,
): string => {
  return status?.trim() || 'unknown';
};

const compareOptionalDates = (
  left?: string,
  right?: string,
): number => {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;
  const normalizedLeft = Number.isNaN(leftTime) ? -Infinity : leftTime;
  const normalizedRight = Number.isNaN(rightTime) ? -Infinity : rightTime;
  return normalizedLeft - normalizedRight;
};

const sortStorageRowsBy = (
  rows: Array<StoragePathRow>,
  key: StorageSortKey,
  direction: StorageSortDirection,
): Array<StoragePathRow> => {
  const ordered = [...rows].sort((left, right) => {
    switch (key) {
      case 'name':
        return left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      case 'type':
        if (left.type !== right.type) {
          return left.type.localeCompare(right.type);
        }
        return left.name.localeCompare(right.name, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      case 'sizeBytes':
        return left.sizeBytes - right.sizeBytes;
      case 'fileCount':
        return left.fileCount - right.fileCount;
      case 'downloadCount':
        return left.downloadCount - right.downloadCount;
      case 'lastDownload':
        return compareOptionalDates(left.lastDownload, right.lastDownload);
      case 'lastUpdated':
        return compareOptionalDates(left.lastUpdated, right.lastUpdated);
      default:
        return 0;
    }
  });

  return direction === 'desc' ? ordered.reverse() : ordered;
};

const getCleanupFindingColor = (
  kind: StorageCleanupFindingKind,
): string => {
  switch (kind) {
    case 'stale_duplicate_record':
      return 'orange';
    case 'broken_access_url_error':
      return 'red';
    case 'broken_bucket_mapping':
      return 'orange';
    case 'bucket_only_object':
      return 'violet';
    case 'live_duplicate_conflict':
      return 'yellow';
    case 'storage_object_missing':
      return 'red';
    case 'storage_probe_error':
      return 'red';
    case 'storage_validation_mismatch':
      return 'orange';
    case 'repo_orphan_live_object':
    case 'repo_orphan_stale_record':
      return 'grape';
    default:
      return 'gray';
  }
};

const getProjectDiffFindingColor = (
  kind: ProjectDiffFindingKind,
): string => {
  switch (kind) {
    case 'duplicate_syfon_paths':
      return 'orange';
    case 'syfon_missing_in_repo':
      return 'red';
    case 'repo_missing_in_syfon':
      return 'blue';
    default:
      return 'gray';
  }
};

type ProjectDiffIssueSummary = {
  readonly id: string;
  readonly title: string;
  readonly color: string;
  readonly findingKinds: Array<ProjectDiffFindingKind>;
  readonly pathCount: number;
  readonly recordCount: number;
  readonly objectCount: number;
  readonly totalBytes: number;
  readonly description: string;
  readonly recommendation: string;
  readonly actionLabel?: string;
};

const summarizeProjectDiffIssues = (
  findings: Array<ProjectDiffFinding>,
): Array<ProjectDiffIssueSummary> => {
  const groups: Array<{
    readonly id: string;
    readonly title: string;
    readonly color: string;
    readonly findingKinds: Array<ProjectDiffFindingKind>;
    readonly description: string;
    readonly recommendation: string;
    readonly actionLabel?: string;
  }> = [
    {
      id: 'duplicate-syfon-paths',
      title: 'Duplicate Syfon Paths',
      color: 'orange',
      findingKinds: ['duplicate_syfon_paths'],
      description:
        'Multiple Syfon records share the same normalized path in this subtree.',
      recommendation:
        'Verify these duplicates first. Syfon can only auto-delete the stale side when storage verification proves one sibling is dead.',
      actionLabel: 'Verify duplicates',
    },
    {
      id: 'syfon-only',
      title: 'In Syfon Only',
      color: 'red',
      findingKinds: ['syfon_missing_in_repo'],
      description:
        'These indexed Syfon paths are not present in the Git tree for this project path.',
      recommendation:
        'Prepare delete to verify storage only for these Syfon-only paths before removing records or bucket objects.',
      actionLabel: 'Prepare delete',
    },
    {
      id: 'git-only',
      title: 'In Git Only',
      color: 'blue',
      findingKinds: ['repo_missing_in_syfon'],
      description:
        'These Git-tracked paths do not currently have matching Syfon records.',
      recommendation:
        'These are ingest or metadata gaps, not cleanup candidates.',
    },
  ];

  const summaries: Array<ProjectDiffIssueSummary | null> = groups.map((group) => {
      const matched = findings.filter((finding) =>
        group.findingKinds.includes(finding.kind),
      );
      if (matched.length === 0) {
        return null;
      }

      const pathCount = matched.length;
      const objectCount = new Set(
        matched.flatMap((finding) => finding.objectIds),
      ).size;
      const recordCount = matched.reduce(
        (sum, finding) => sum + (finding.recordCount || 0),
        0,
      );
      const totalBytes = matched.reduce(
        (sum, finding) => sum + (finding.sizeBytes ?? 0),
        0,
      );

      return {
        actionLabel: group.actionLabel,
        color: group.color,
        description: group.description,
        findingKinds: group.findingKinds,
        id: group.id,
        objectCount,
        pathCount,
        recommendation: group.recommendation,
        recordCount,
        title: group.title,
        totalBytes,
      };
    });

  return summaries.filter(
    (item): item is ProjectDiffIssueSummary => item !== null,
  );
};

type CleanupIssueSummary = {
  readonly id: string;
  readonly title: string;
  readonly color: string;
  readonly findingKinds: Array<StorageCleanupFindingKind>;
  readonly pathCount: number;
  readonly recordCount: number;
  readonly objectCount: number;
  readonly totalBytes: number;
  readonly bucketCount: number;
  readonly sampleBuckets: Array<string>;
  readonly description: string;
  readonly recommendation: string;
};

const summarizeCleanupIssues = (
  findings: Array<StorageCleanupFinding>,
): Array<CleanupIssueSummary> => {
  const groups: Array<{
    readonly id: string;
    readonly title: string;
    readonly color: string;
    readonly findingKinds: Array<StorageCleanupFindingKind>;
    readonly description: string;
    readonly recommendation: string;
  }> = [
    {
      id: 'stale-duplicates',
      title: 'Stale Duplicate Records',
      color: 'orange',
      findingKinds: ['stale_duplicate_record'],
      description:
        'These paths still have one live record, plus one or more stale siblings that no longer resolve in storage.',
      recommendation:
        'Delete the stale duplicate records. Syfon keeps the live sibling.',
    },
    {
      id: 'live-duplicate-conflicts',
      title: 'Live Duplicate Conflicts',
      color: 'yellow',
      findingKinds: ['live_duplicate_conflict'],
      description:
        'These duplicate paths still resolve through more than one live Syfon record.',
      recommendation:
        'Syfon could not choose a safe winner automatically. Manual conflict resolution is still required for these duplicates.',
    },
    {
      id: 'broken-access-urls',
      title: 'Broken Access URLs',
      color: 'red',
      findingKinds: ['broken_access_url_error'],
      description:
        'These records point at storage URLs Syfon cannot resolve, usually because the bucket credential or bucket name is wrong.',
      recommendation:
        'Treat these as admin cleanup candidates. Fix the missing bucket credential if the bucket should still exist; otherwise verify the file already exists elsewhere before removing the broken records.',
    },
    {
      id: 'broken-bucket-mappings',
      title: 'Broken Bucket Mappings',
      color: 'orange',
      findingKinds: ['broken_bucket_mapping'],
      description:
        'These records point at access URLs that Syfon can parse, but no bucket mapping is configured for them.',
      recommendation:
        'Fix the bucket mapping in Syfon or remove the bad access URL before treating these as missing bucket objects.',
    },
    {
      id: 'missing-storage-objects',
      title: 'Missing Storage Objects',
      color: 'red',
      findingKinds: ['storage_object_missing'],
      description:
        'These Git-backed Syfon records resolve, but the bucket object is missing.',
      recommendation:
        'Treat these as broken chains. Restore the object or delete the dead Syfon record after review.',
    },
    {
      id: 'validation-mismatches',
      title: 'Storage Validation Mismatches',
      color: 'orange',
      findingKinds: ['storage_validation_mismatch'],
      description:
        'These bucket objects exist, but their HEAD metadata no longer matches what Syfon expects.',
      recommendation:
        'Investigate drift before deleting anything. This usually means the bucket object or record metadata changed out of band.',
    },
    {
      id: 'probe-errors',
      title: 'Storage Probe Errors',
      color: 'red',
      findingKinds: ['storage_probe_error'],
      description:
        'Storage verification could not classify these paths because probing failed before Syfon could determine whether the object still exists.',
      recommendation:
        'Fix the underlying storage or credential problem and rerun verification before deleting anything.',
    },
    {
      id: 'bucket-only-objects',
      title: 'Bucket Only Objects',
      color: 'violet',
      findingKinds: ['bucket_only_object'],
      description:
        'These bucket objects were enumerated directly from storage and have no matching Syfon record.',
      recommendation:
        'Review these for deletion or backfill. They are outside the Syfon record chain today.',
    },
    {
      id: 'repo-orphans',
      title: 'Repo Orphans',
      color: 'grape',
      findingKinds: ['repo_orphan_live_object', 'repo_orphan_stale_record'],
      description:
        'These paths are absent from the project Git tree and should be reviewed as dead data or stale metadata.',
      recommendation:
        'Delete repo orphans when the Git tree is authoritative for this subtree.',
    },
  ];

  return groups
    .map((group) => {
      const matched = findings.filter((finding) =>
        group.findingKinds.includes(finding.kind),
      );
      if (matched.length === 0) {
        return null;
      }

      const paths = new Set<string>();
      const objects = new Set<string>();
      const buckets = new Set<string>();
      let recordCount = 0;
      let totalBytes = 0;

      matched.forEach((finding) => {
        paths.add(finding.normalizedPath);
        if (finding.sizeBytes) {
          totalBytes += finding.sizeBytes;
        }
        finding.objectIds.forEach((objectId) => objects.add(objectId));
        finding.records.forEach((record) => {
          recordCount += 1;
          if (!finding.sizeBytes && record.sizeBytes) {
            totalBytes += record.sizeBytes;
          }
          record.accessProbes.forEach((probe) => {
            if (probe.bucket?.trim()) {
              buckets.add(probe.bucket.trim());
            }
          });
        });
      });

      return {
        id: group.id,
        title: group.title,
        color: group.color,
        findingKinds: group.findingKinds,
        pathCount: paths.size,
        recordCount,
        objectCount: objects.size,
        totalBytes,
        bucketCount: buckets.size,
        sampleBuckets: Array.from(buckets).sort().slice(0, 3),
        description: group.description,
        recommendation: group.recommendation,
      };
    })
    .filter((item): item is CleanupIssueSummary => item !== null);
};

type ChainIssueKind = Exclude<StorageChainFindingKind, 'unknown'>;

type ChainIssueSummary = {
  readonly id: ChainIssueKind;
  readonly title: string;
  readonly color: string;
  readonly findingCount: number;
  readonly pathCount: number;
  readonly recordCount: number;
  readonly objectCount: number;
  readonly totalBytes: number;
  readonly description: string;
  readonly recommendation: string;
  readonly actionLabel?: string;
};

const chainIssueDefinitions: Array<{
  readonly id: ChainIssueKind;
  readonly title: string;
  readonly color: string;
  readonly description: string;
  readonly recommendation: string;
  readonly actionLabel?: string;
}> = [
  {
    id: 'bucket_only_object',
    title: 'Bucket Only',
    color: 'violet',
    description: 'Bucket object exists but no Syfon record matched it.',
    recommendation: 'Review these for deletion or metadata backfill.',
    actionLabel: 'Show bucket-only objects',
  },
  {
    id: 'bucket_syfon_no_git',
    title: 'Bucket + Syfon, No Git',
    color: 'grape',
    description:
      'Bucket object and Syfon record matched, but no Git-tracked file matched this checksum.',
    recommendation:
      'Review these as storage-backed data that is outside the Git-tracked set.',
    actionLabel: 'Show unmatched bucket chains',
  },
  {
    id: 'syfon_broken_bucket_mapping',
    title: 'Syfon Broken Bucket Mapping',
    color: 'orange',
    description:
      'Syfon record exists, but its access URL does not resolve to a configured bucket mapping.',
    recommendation:
      'Fix the Syfon bucket mapping or remove the bad access URL before treating this as a missing object.',
    actionLabel: 'Show mapping errors',
  },
  {
    id: 'syfon_missing_bucket_object',
    title: 'Syfon, Missing Bucket Object',
    color: 'orange',
    description:
      'Syfon record exists, but the mapped bucket object does not exist and no Git match was found.',
    recommendation:
      'Review stale metadata or restore the missing object before any cleanup.',
    actionLabel: 'Show missing objects',
  },
  {
    id: 'syfon_git_no_bucket',
    title: 'Git + Syfon, Missing Bucket Object',
    color: 'red',
    description:
      'Git and Syfon matched, but the mapped bucket object does not exist.',
    recommendation:
      'Restore the bucket object or delete the dead Syfon record after review.',
    actionLabel: 'Show bucket misses',
  },
  {
    id: 'git_only_no_syfon',
    title: 'Git Only, No Syfon',
    color: 'blue',
    description: 'Git checksum has no matching Syfon record.',
    recommendation:
      'These are ingest or metadata gaps, not bucket cleanup candidates.',
  },
  {
    id: 'git_syfon_metadata_mismatch',
    title: 'Git + Syfon, Metadata Mismatch',
    color: 'orange',
    description:
      'Bucket object exists, but its metadata does not match what Syfon expects.',
    recommendation:
      'Investigate metadata drift before applying deletion.',
    actionLabel: 'Show mismatches',
  },
  {
    id: 'probe_error',
    title: 'Probe Error',
    color: 'red',
    description:
      'Bucket verification failed before Gecko could classify the chain cleanly.',
    recommendation:
      'Fix the mapped bucket target, bucket credential, or provider access problem and rerun the audit.',
    actionLabel: 'Show probe errors',
  },
];

const summarizeStorageChainIssues = ({
  chainGroups,
}: {
  chainGroups: Array<StorageChainIssueGroup>;
}): Array<ChainIssueSummary> => {
  const groupsByKind = new Map(chainGroups.map((group) => [group.kind, group]));

  return chainIssueDefinitions.reduce<Array<ChainIssueSummary>>(
    (summaries, definition) => {
      const group = groupsByKind.get(definition.id);
      if (!group || group.findingCount <= 0) {
        return summaries;
      }

      summaries.push({
        actionLabel: definition.actionLabel,
        color: definition.color,
        description: definition.description,
        findingCount: group.findingCount,
        id: definition.id,
        objectCount: group.objectCount,
        pathCount: group.pathCount,
        recommendation: definition.recommendation,
        recordCount: group.recordCount,
        title: definition.title,
        totalBytes: group.totalBytes,
      });
      return summaries;
    },
    [],
  );
};

const computeGroupsFromFindings = (
  findings: Array<StorageChainFinding>,
): Array<StorageChainIssueGroup> => {
  const groupsByKind = new Map<
    string,
    {
      findingCount: number;
      pathCount: number;
      recordCount: number;
      objectCount: number;
      totalBytes: number;
    }
  >();

  findings.forEach((finding) => {
    let current = groupsByKind.get(finding.kind);
    if (!current) {
      current = {
        findingCount: 0,
        pathCount: 0,
        recordCount: 0,
        objectCount: 0,
        totalBytes: 0,
      };
      groupsByKind.set(finding.kind, current);
    }
    current.findingCount += 1;
    if (finding.normalizedPath) {
      current.pathCount += 1;
    }
    current.recordCount += finding.recordCount || 0;
    current.objectCount += finding.objectIds?.length || 0;
    current.totalBytes += finding.sizeBytes || 0;
  });

  return Array.from(groupsByKind.entries()).map(([kind, g]) => ({
    kind,
    findingCount: g.findingCount,
    pathCount: g.pathCount,
    recordCount: g.recordCount,
    objectCount: g.objectCount,
    totalBytes: g.totalBytes,
  }));
};

export const FileSummaryPage = ({
  headerProps,
  footerProps,
  filesummaryConfig,
}: FileSummaryPageProps) => {
  const router = useRouter();
  const routeOrganization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const routeProject =
    typeof router.query.project === 'string' ? router.query.project : '';
  const isProjectScopedRoute = Boolean(routeOrganization && routeProject);
  const forcedProjectSelection = isProjectScopedRoute
    ? `${routeOrganization}/${routeProject}`
    : '';
  const {
    defaultSelection,
    isLoading: isProjectsLoading,
    options: projectOptions,
  } = useFileSummaryProjectOptions(filesummaryConfig);
  const [selectedProject, setSelectedProject] = useState('');
  const [currentPath, setCurrentPath] = useState(
    filesummaryConfig?.defaultPath?.trim() ?? '',
  );
  const [selectedCleanupIssueId, setSelectedCleanupIssueId] = useState<string | null>(null);
  const [selectedChainIssueId, setSelectedChainIssueId] = useState<string | null>(
    null,
  );
  const [selectedChainPathsByIssue, setSelectedChainPathsByIssue] = useState<
    Record<string, Array<string>>
  >({});
  const [expandedChainTreeNodes, setExpandedChainTreeNodes] = useState<
    Record<string, boolean>
  >({});
  const [selectedDiffIssueId, setSelectedDiffIssueId] = useState<string | null>(null);
  const [showCleanupDetails, setShowCleanupDetails] = useState(false);
  const [showDiffDetails, setShowDiffDetails] = useState(false);
  const [repoOrphanDeleteModalOpen, setRepoOrphanDeleteModalOpen] =
    useState(false);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [storageSortKey, setStorageSortKey] = useState<StorageSortKey>('sizeBytes');
  const [storageSortDirection, setStorageSortDirection] =
    useState<StorageSortDirection>('desc');
  const [activeChainPage, setActiveChainPage] = useState(1);
  const [activeDiffPage, setActiveDiffPage] = useState(1);
  const [activeCleanupPage, setActiveCleanupPage] = useState(1);
  const [treeNodeLimit, setTreeNodeLimit] = useState<Record<string, number>>({});

  useEffect(() => {
    if (forcedProjectSelection) {
      setSelectedProject((current) =>
        current === forcedProjectSelection ? current : forcedProjectSelection,
      );
      return;
    }

    if (!selectedProject && defaultSelection) {
      setSelectedProject(defaultSelection);
    }
  }, [defaultSelection, forcedProjectSelection, selectedProject]);

  const selectedProjectParts = useMemo(
    () => splitProjectSelectionValue(selectedProject),
    [selectedProject],
  );
  const breadcrumbSegments = useMemo(
    () => getPathSegments(currentPath),
    [currentPath],
  );
  const breadcrumbItems = useMemo<Array<BreadcrumbItem>>(() => {
    if (!selectedProjectParts) {
      return [];
    }

    return [
      {
        label: selectedProjectParts.project,
        path: '',
      },
      ...breadcrumbSegments.map((segment, index) => ({
        label: segment,
        path: breadcrumbSegments.slice(0, index + 1).join('/'),
      })),
    ];
  }, [breadcrumbSegments, selectedProjectParts]);
  const collapsedBreadcrumb = useMemo(() => {
    if (breadcrumbItems.length <= 5) {
      return {
        leadingItems: breadcrumbItems,
        hiddenItems: [] as Array<BreadcrumbItem>,
      };
    }

    return {
      leadingItems: [
        breadcrumbItems[0],
        ...breadcrumbItems.slice(-4),
      ],
      hiddenItems: breadcrumbItems.slice(1, -4),
    };
  }, [breadcrumbItems]);
  const { data, error, isLoading, refresh } = useSyfonPathStorageSummary({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    auditError: chainAuditError,
    auditResult: chainAuditResult,
    clearAudit: clearChainAudit,
    isAuditing: isChainAuditing,
    runAudit: runChainAudit,
    setAuditResult: setChainAuditResult,
  } = useSyfonStorageChain({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    auditResult: diffAuditResult,
    clearAudit: clearDiffAudit,
    isAuditing: isDiffAuditing,
    runAudit: runProjectDiffAudit,
    setAuditResult: setDiffAuditResult,
  } = useSyfonProjectDiff({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const {
    applyCleanup,
    applyError,
    applyResult,
    auditError,
    auditResult,
    clearCleanupResults,
    deleteBrokenRecords,
    isApplying,
    isAuditing,
    rerunAudit,
    runAudit,
    setAuditResult: setCleanupAuditResult,
  } = useSyfonStorageCleanup({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });

  const removePathsFromLocalStates = useCallback((deletedPaths: Array<string>) => {
    const deletedSet = new Set(deletedPaths);

    // Update Storage Chain Audit local state
    setChainAuditResult((current) => {
      if (!current) return null;
      const newFindings = current.findings.filter(
        (f) => !deletedSet.has(f.normalizedPath),
      );
      const newGroups = computeGroupsFromFindings(newFindings);

      const deletedFindings = current.findings.filter(
        (f) => deletedSet.has(f.normalizedPath),
      );
      const deletedObjectCount = deletedFindings.reduce((sum, f) => sum + (f.objectIds?.length || 0), 0);
      const deletedRecordCount = deletedFindings.reduce((sum, f) => sum + (f.recordCount || 0), 0);

      const countsByKind: Record<string, number> = {};
      newFindings.forEach((f) => {
        countsByKind[f.kind] = (countsByKind[f.kind] || 0) + 1;
      });
      current.groups.forEach((group) => {
        if (!countsByKind[group.kind]) {
          countsByKind[group.kind] = 0;
        }
      });

      const newSummary = {
        ...current.summary,
        totalFindings: newFindings.length,
        countsByKind: {
          ...current.summary.countsByKind,
          ...countsByKind,
        },
        bucketObjectCount: Math.max(0, current.summary.bucketObjectCount - deletedObjectCount),
        syfonRecordCount: Math.max(0, current.summary.syfonRecordCount - deletedRecordCount),
      };

      return {
        ...current,
        findings: newFindings,
        groups: newGroups,
        summary: newSummary,
      };
    });

    // Update Storage Cleanup Audit (auditResult) local state
    setCleanupAuditResult((current) => {
      if (!current) return null;
      const newRecords = current.records.filter(
        (r) => !deletedSet.has(r.path),
      );
      const deletedRecords = current.records.filter(
        (r) => deletedSet.has(r.path),
      );
      const deletedBytes = deletedRecords.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);

      const newSummary = {
        ...current.summary,
        totalFindings: newRecords.length,
        totalRecords: newRecords.length,
        totalBytes: Math.max(0, current.summary.totalBytes - deletedBytes),
      };

      return {
        ...current,
        records: newRecords,
        summary: newSummary,
      };
    });

    // Reset selection for this issue
    if (selectedChainIssue) {
      setSelectedChainPathsByIssue((current) => ({
        ...current,
        [selectedChainIssue.id]: [],
      }));
    }
  }, [selectedChainIssue, setChainAuditResult, setCleanupAuditResult]);

  const removeObjectIdsFromLocalStates = useCallback((deletedIds: Array<string>) => {
    const deletedSet = new Set(deletedIds);

    // Update Storage Chain Audit local state
    setChainAuditResult((current) => {
      if (!current) return null;
      const newFindings = current.findings.filter(
        (f) => !f.objectIds.some((id) => deletedSet.has(id)),
      );
      const newGroups = computeGroupsFromFindings(newFindings);
      
      const deletedFindings = current.findings.filter(
        (f) => f.objectIds.some((id) => deletedSet.has(id)),
      );
      const deletedObjectCount = deletedFindings.reduce((sum, f) => sum + (f.objectIds?.length || 0), 0);
      const deletedRecordCount = deletedFindings.reduce((sum, f) => sum + (f.recordCount || 0), 0);

      const countsByKind: Record<string, number> = {};
      newFindings.forEach((f) => {
        countsByKind[f.kind] = (countsByKind[f.kind] || 0) + 1;
      });
      current.groups.forEach((group) => {
        if (!countsByKind[group.kind]) {
          countsByKind[group.kind] = 0;
        }
      });

      const newSummary = {
        ...current.summary,
        totalFindings: newFindings.length,
        countsByKind: {
          ...current.summary.countsByKind,
          ...countsByKind,
        },
        bucketObjectCount: Math.max(0, current.summary.bucketObjectCount - deletedObjectCount),
        syfonRecordCount: Math.max(0, current.summary.syfonRecordCount - deletedRecordCount),
      };

      return {
        ...current,
        findings: newFindings,
        groups: newGroups,
        summary: newSummary,
      };
    });

    // Update Storage Cleanup Audit (auditResult) local state
    setCleanupAuditResult((current) => {
      if (!current) return null;
      const newRecords = current.records.filter(
        (r) => !deletedSet.has(r.objectId),
      );
      const deletedRecords = current.records.filter(
        (r) => deletedSet.has(r.objectId),
      );
      const deletedBytes = deletedRecords.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);

      const newSummary = {
        ...current.summary,
        totalFindings: newRecords.length,
        totalRecords: newRecords.length,
        totalBytes: Math.max(0, current.summary.totalBytes - deletedBytes),
      };

      return {
        ...current,
        records: newRecords,
        summary: newSummary,
      };
    });
  }, [setChainAuditResult, setCleanupAuditResult]);

  useEffect(() => {
    clearChainAudit();
    clearDiffAudit();
    clearCleanupResults();
  }, [clearChainAudit, clearCleanupResults, clearDiffAudit, currentPath, selectedProject]);

  useEffect(() => {
    setSelectedChainIssueId(null);
    setSelectedCleanupIssueId(null);
    setSelectedDiffIssueId(null);
    setShowCleanupDetails(false);
    setShowDiffDetails(false);
    setSelectedChainPathsByIssue({});
    setExpandedChainTreeNodes({});
    setTreeNodeLimit({});
    setActiveChainPage(1);
    setActiveDiffPage(1);
    setActiveCleanupPage(1);
  }, [auditResult?.pathPrefix, chainAuditResult, currentPath, selectedProject]);

  useEffect(() => {
    setActiveChainPage(1);
    setTreeNodeLimit({});
  }, [selectedChainIssueId]);

  useEffect(() => {
    setActiveDiffPage(1);
  }, [selectedDiffIssueId]);

  useEffect(() => {
    setActiveCleanupPage(1);
  }, [selectedCleanupIssueId]);

  const pageTitle = selectedProjectParts
    ? `${selectedProjectParts.organization}/${selectedProjectParts.project}`
    : 'Storage Monitor';
  const sortedRows = useMemo(
    () =>
      sortStorageRowsBy(
        data?.rows ?? [],
        storageSortKey,
        storageSortDirection,
      ),
    [data?.rows, storageSortDirection, storageSortKey],
  );
  const largestRowSize = useMemo(
    () => Math.max(0, ...(data?.rows ?? []).map((row) => row.sizeBytes)),
    [data?.rows],
  );
  const diffIssueSummaries = useMemo(
    () => summarizeProjectDiffIssues(diffAuditResult?.findings ?? []),
    [diffAuditResult?.findings],
  );
  const selectedDiffIssue = diffIssueSummaries.find(
    (issue) => issue.id === selectedDiffIssueId,
  ) ?? null;
  const selectedDiffPaths = useMemo(
    () =>
      (diffAuditResult?.findings ?? [])
        .filter((finding) =>
          selectedDiffIssue
            ? selectedDiffIssue.findingKinds.includes(finding.kind)
            : false,
        )
        .map((finding) => finding.normalizedPath),
    [diffAuditResult?.findings, selectedDiffIssue],
  );
  const hasCleanupFindings = (auditResult?.summary.totalFindings ?? 0) > 0;
  const chainIssueSummaries = useMemo(
    () =>
      summarizeStorageChainIssues({
        chainGroups: chainAuditResult?.groups ?? [],
      }),
    [chainAuditResult?.groups],
  );
  const selectedChainIssue = useMemo(
    () =>
      chainIssueSummaries.find((issue) => issue.id === selectedChainIssueId) ?? null,
    [chainIssueSummaries, selectedChainIssueId],
  );
  const selectedChainFindings = useMemo(
    () =>
      selectedChainIssue
        ? (chainAuditResult?.findings ?? []).filter(
            (finding) => finding.kind === selectedChainIssue.id,
          )
        : [],
    [chainAuditResult?.findings, selectedChainIssue],
  );
  const selectedChainObjectIdsCount = useMemo(
    () =>
      selectedChainFindings
        .flatMap((finding) => finding.objectIds)
        .filter(Boolean).length,
    [selectedChainFindings],
  );
  const actionableChainSelectionIssue =
    selectedChainIssue?.id === 'bucket_only_object' ||
    selectedChainIssue?.id === 'bucket_syfon_no_git';
  const selectableChainPaths = useMemo(
    () =>
      actionableChainSelectionIssue
        ? Array.from(
            new Set(
              selectedChainFindings
                .map((finding) => finding.normalizedPath)
                .filter(Boolean),
            ),
          ).sort()
        : [],
    [actionableChainSelectionIssue, selectedChainFindings],
  );
  const selectedChainPaths = useMemo(
    () =>
      actionableChainSelectionIssue
        ? selectedChainPathsByIssue[selectedChainIssue?.id ?? ''] ?? []
        : [],
    [
      actionableChainSelectionIssue,
      selectedChainIssue?.id,
      selectedChainPathsByIssue,
    ],
  );
  const pathsByParent = useMemo(
    () => buildPathsByParentMap(selectableChainPaths),
    [selectableChainPaths],
  );
  const selectedChainPathsSet = useMemo(
    () => new Set(selectedChainPaths),
    [selectedChainPaths],
  );

  const chainPathTree = useMemo(
    () => pathsByParent.get('') ?? [],
    [pathsByParent],
  );
  useEffect(() => {
    if (!actionableChainSelectionIssue || !selectedChainIssue) {
      return;
    }
    setSelectedChainPathsByIssue((current) => {
      const existing = current[selectedChainIssue.id];
      const available = new Set(selectableChainPaths);
      const next = (existing ?? []).filter((path) =>
        available.has(path),
      );
      const normalized = next;
      if (
        existing &&
        existing.length === normalized.length &&
        existing.every((value, index) => value === normalized[index])
      ) {
        return current;
      }
      return {
        ...current,
        [selectedChainIssue.id]: normalized,
      };
    });
  }, [
    actionableChainSelectionIssue,
    selectableChainPaths,
    selectedChainIssue,
  ]);
  const canRepairBrokenBucketMappings =
    selectedChainIssue?.id === 'syfon_broken_bucket_mapping' &&
    selectedChainFindings.length > 0;
  const cleanupIssueSummaries = useMemo(
    () => summarizeCleanupIssues(auditResult?.findings ?? []),
    [auditResult?.findings],
  );
  const selectedCleanupIssue = cleanupIssueSummaries.find(
    (issue) => issue.id === selectedCleanupIssueId,
  ) ?? null;
  const visibleCleanupFindings = useMemo(() => {
    if (!auditResult) {
      return [];
    }

    if (!selectedCleanupIssue) {
      return auditResult.findings;
    }

    return auditResult.findings.filter((finding) =>
      selectedCleanupIssue.findingKinds.includes(finding.kind),
    );
  }, [auditResult, selectedCleanupIssue]);

  const selectedDiffFindings = useMemo(
    () =>
      diffAuditResult?.findings
        ? diffAuditResult.findings.filter((finding) =>
            selectedDiffIssue
              ? selectedDiffIssue.findingKinds.includes(finding.kind)
              : false,
          )
        : [],
    [diffAuditResult?.findings, selectedDiffIssue],
  );

  const totalChainPages = Math.ceil(selectedChainFindings.length / 100);
  const paginatedChainFindings = useMemo(() => {
    const start = (activeChainPage - 1) * 100;
    const end = start + 100;
    return selectedChainFindings.slice(start, end);
  }, [selectedChainFindings, activeChainPage]);

  const totalDiffPages = Math.ceil(selectedDiffFindings.length / 100);
  const paginatedDiffFindings = useMemo(() => {
    const start = (activeDiffPage - 1) * 100;
    const end = start + 100;
    return selectedDiffFindings.slice(start, end);
  }, [selectedDiffFindings, activeDiffPage]);

  const totalCleanupPages = Math.ceil(visibleCleanupFindings.length / 100);
  const paginatedCleanupFindings = useMemo(() => {
    const start = (activeCleanupPage - 1) * 100;
    const end = start + 100;
    return visibleCleanupFindings.slice(start, end);
  }, [visibleCleanupFindings, activeCleanupPage]);
  const brokenRecordObjectIds = useMemo(
    () =>
      Array.from(
        new Set(
          visibleCleanupFindings
            .filter((finding) => finding.kind === 'broken_access_url_error')
            .flatMap((finding) =>
              finding.records
                .filter((record) => record.cleanupScope !== 'access_url')
                .map((record) => record.objectId),
            ),
        ),
      ),
    [visibleCleanupFindings],
  );
  const canDeleteBrokenRecords =
    selectedDiffIssue?.id === 'syfon-only' &&
    selectedCleanupIssue?.id === 'broken-access-urls' &&
    brokenRecordObjectIds.length > 0;
  const isDuplicateVerificationContext =
    selectedDiffIssue?.id === 'duplicate-syfon-paths';
  const hasSafeDuplicateCleanup =
    cleanupIssueSummaries.some((issue) => issue.id === 'stale-duplicates');
  const hiddenCleanupFindingCount = useMemo(() => {
    if (!auditResult) {
      return 0;
    }

    const visibleKinds = new Set(
      cleanupIssueSummaries.flatMap((issue) => issue.findingKinds),
    );
    return auditResult.findings.filter((finding) => !visibleKinds.has(finding.kind))
      .length;
  }, [auditResult, cleanupIssueSummaries]);
  const repoOrphanDeletePlan = useMemo(() => {
    if (!auditResult) {
      return {
        metadataOnlyObjectIds: [] as Array<string>,
        purgeObjectIds: [] as Array<string>,
        purgeUrls: [] as Array<string>,
      };
    }

    const metadataOnlyObjectIds = new Set<string>();
    const purgeObjectIds = new Set<string>();
    const purgeUrls = new Set<string>();

    auditResult.findings.forEach((finding) => {
      if (
        finding.kind !== 'repo_orphan_live_object' &&
        finding.kind !== 'repo_orphan_stale_record'
      ) {
        return;
      }

      finding.records.forEach((record) => {
        if (record.cleanupScope === 'access_url') {
          return;
        }

        if (finding.kind === 'repo_orphan_live_object') {
          purgeObjectIds.add(record.objectId);
          record.accessProbes.forEach((probe) => {
            const url = probe.url?.trim();
            if (url) {
              purgeUrls.add(url);
            }
          });
          return;
        }

        metadataOnlyObjectIds.add(record.objectId);
      });
    });

    return {
      metadataOnlyObjectIds: Array.from(metadataOnlyObjectIds).sort(),
      purgeObjectIds: Array.from(purgeObjectIds).sort(),
      purgeUrls: Array.from(purgeUrls).sort(),
    };
  }, [auditResult]);

  const handleApplyCleanup = async ({
    deleteRepoOrphans,
    deleteStaleDuplicates,
    selectedPaths,
  }: {
    deleteRepoOrphans: boolean;
    deleteStaleDuplicates: boolean;
    selectedPaths?: Array<string>;
  }) => {
    const result = await applyCleanup({
      deleteRepoOrphans,
      deleteStaleDuplicates,
      selectedPaths,
    });

    if (result) {
      refresh();
      if (selectedPaths && selectedPaths.length > 0) {
        removePathsFromLocalStates(selectedPaths);
      } else {
        const pathsToRemove: Array<string> = [];
        if (deleteRepoOrphans) {
          (chainAuditResult?.findings ?? [])
            .filter((f) => f.kind === 'bucket_syfon_no_git')
            .forEach((f) => pathsToRemove.push(f.normalizedPath));
        }
        if (pathsToRemove.length > 0) {
          removePathsFromLocalStates(pathsToRemove);
        } else {
          await rerunAudit();
        }
      }
    }
  };

  const handleDeleteBrokenRecords = async () => {
    if (!canDeleteBrokenRecords) {
      return;
    }

    const result = await deleteBrokenRecords({
      objectIds: brokenRecordObjectIds,
    });

    if (result) {
      refresh();
      removeObjectIdsFromLocalStates(brokenRecordObjectIds);
    }
  };

  const handleRepairBrokenBucketMappings = async () => {
    if (
      !selectedChainIssue ||
      selectedChainIssue.id !== 'syfon_broken_bucket_mapping'
    ) {
      return;
    }

    const objectIds = Array.from(
      new Set(
        selectedChainFindings
          .flatMap((finding) => finding.objectIds)
          .filter(Boolean),
      ),
    );

    if (objectIds.length === 0) {
      return;
    }

    const result = await deleteBrokenRecords({
      objectIds,
    });

    if (result) {
      refresh();
      await runChainAudit();
      if (auditResult) {
        await rerunAudit();
      }
    }
  };

  const toggleExpandedChainTreeNode = useCallback((nodePath: string) => {
    setExpandedChainTreeNodes((current) => ({
      ...current,
      [nodePath]: !current[nodePath],
    }));
  }, []);

  const setSelectedChainPathsForIssue = useCallback(
    (paths: Array<string>) => {
      if (!selectedChainIssue) {
        return;
      }
      setSelectedChainPathsByIssue((current) => ({
        ...current,
        [selectedChainIssue.id]: Array.from(new Set(paths)).sort(),
      }));
    },
    [selectedChainIssue],
  );

  const handleToggleAllChainPaths = useCallback(
    (checked: boolean) => {
      if (!actionableChainSelectionIssue) {
        return;
      }
      setSelectedChainPathsForIssue(checked ? selectableChainPaths : []);
    },
    [actionableChainSelectionIssue, selectableChainPaths, setSelectedChainPathsForIssue],
  );

  const handleToggleChainPath = useCallback(
    (path: string, checked: boolean) => {
      const next = checked
        ? [...selectedChainPaths, path]
        : selectedChainPaths.filter((value) => value !== path);
      setSelectedChainPathsForIssue(next);
    },
    [selectedChainPaths, setSelectedChainPathsForIssue],
  );

  const handleApplySelectedChainDeletion = async () => {
    if (!selectedChainIssue || selectedChainPaths.length === 0) {
      return;
    }
    const result =
      selectedChainIssue.id === 'bucket_only_object'
        ? await applyCleanup({
            deleteRepoOrphans: false,
            deleteStaleDuplicates: false,
            deleteBucketOnlyObjects: true,
            selectedPaths: selectedChainPaths,
          })
        : selectedChainIssue.id === 'bucket_syfon_no_git'
          ? await applyCleanup({
              deleteRepoOrphans: true,
              deleteStaleDuplicates: false,
              selectedPaths: selectedChainPaths,
            })
          : null;

    if (result) {
      refresh();
      removePathsFromLocalStates(selectedChainPaths);
    }
  };

  const handleConfirmRepoOrphanDelete = async () => {
    setRepoOrphanDeleteModalOpen(false);
    await handleApplyCleanup({
      deleteRepoOrphans: true,
      deleteStaleDuplicates: false,
      selectedPaths: selectedDiffPaths,
    });
  };

  const handlePrepareCleanup = async (issue: ProjectDiffIssueSummary) => {
    setSelectedDiffIssueId(issue.id);
    setSelectedCleanupIssueId(null);
    setSelectedChainIssueId(null);
    setShowDiffDetails(true);
    setShowCleanupDetails(true);
    await runAudit({
      includeRepoManifest: true,
      selectedPaths: (diffAuditResult?.findings ?? [])
        .filter((finding) => issue.findingKinds.includes(finding.kind))
        .map((finding) => finding.normalizedPath),
    });
  };

  const ensureDiffAuditLoaded = async (): Promise<void> => {
    if (!diffAuditResult && !isDiffAuditing) {
      await runProjectDiffAudit();
    }
  };

  const ensureCleanupAuditLoaded = async ({
    selectedPaths,
  }: {
    selectedPaths?: Array<string>;
  } = {}): Promise<void> => {
    if (!auditResult && !isAuditing) {
      await runAudit({
        includeRepoManifest: true,
        selectedPaths,
      });
    }
  };

  const handleToggleChainIssueDetails = useCallback(
    (issue: ChainIssueSummary) => {
      const shouldOpen = selectedChainIssueId !== issue.id;
      setSelectedChainIssueId(shouldOpen ? issue.id : null);
      if (shouldOpen) {
        setSelectedDiffIssueId(null);
        setSelectedCleanupIssueId(null);
      }
    },
    [selectedChainIssueId],
  );

  const handleFocusChainIssue = async (issue: ChainIssueSummary) => {
    setSelectedChainIssueId(issue.id);
    setSelectedDiffIssueId(null);
    setSelectedCleanupIssueId(null);
  };

  const handleOpenAuditModal = async () => {
    setAuditModalOpen(true);
    const tasks: Array<Promise<unknown>> = [];
    if (!chainAuditResult && !isChainAuditing) {
      tasks.push(runChainAudit());
    }
    if (tasks.length > 0) {
      await Promise.all(tasks);
    }
  };

  const handleStorageSort = (key: StorageSortKey) => {
    setStorageSortDirection((currentDirection) =>
      storageSortKey === key
        ? currentDirection === 'asc'
          ? 'desc'
          : 'asc'
        : key === 'name' || key === 'type'
          ? 'asc'
          : 'desc',
    );
    setStorageSortKey(key);
  };

  const renderChainTreeNode = (node: ChainPathTreeNode, depth = 0): React.ReactNode => {
    const descendantLeafPaths = node.descendantLeafPaths;
    const selectedCount = descendantLeafPaths.filter((value) =>
      selectedChainPathsSet.has(value),
    ).length;
    const fullySelected =
      descendantLeafPaths.length > 0 && selectedCount === descendantLeafPaths.length;
    const partiallySelected =
      selectedCount > 0 && selectedCount < descendantLeafPaths.length;
    const isLeaf = !node.isFolder;
    const isExpanded = expandedChainTreeNodes[node.path] ?? false;
    const children = pathsByParent.get(node.path) ?? [];

    return (
      <Stack gap={4} key={node.path}>
        <Group gap="xs" style={{ paddingLeft: depth * 16 }}>
          {isLeaf ? (
            <div style={{ width: 28 }} />
          ) : (
            <ActionIcon
              onClick={() => toggleExpandedChainTreeNode(node.path)}
              size="sm"
              variant="subtle"
            >
              <IconChevronRight
                size={14}
                style={{
                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 120ms ease',
                }}
              />
            </ActionIcon>
          )}
          <Checkbox
            checked={fullySelected}
            indeterminate={partiallySelected}
            label={node.label}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              if (isLeaf && node.leafPath) {
                handleToggleChainPath(node.leafPath, checked);
                return;
              }
              let nextSelected: Array<string>;
              if (checked) {
                const set = new Set([...selectedChainPaths, ...descendantLeafPaths]);
                nextSelected = Array.from(set).sort();
              } else {
                const descendantSet = new Set(descendantLeafPaths);
                nextSelected = selectedChainPaths.filter((path) => !descendantSet.has(path));
              }
              setSelectedChainPathsForIssue(nextSelected);
            }}
          />
        </Group>
        {!isLeaf && isExpanded ? (
          <>
            {children
              .slice(0, treeNodeLimit[node.path] ?? 100)
              .map((child) => renderChainTreeNode(child, depth + 1))}
            {children.length > (treeNodeLimit[node.path] ?? 100) && (
              <Button
                onClick={() =>
                  setTreeNodeLimit((current) => ({
                    ...current,
                    [node.path]: (current[node.path] ?? 100) + 100,
                  }))
                }
                size="xs"
                style={{
                  alignSelf: 'flex-start',
                  marginLeft: (depth + 1) * 16 + 28,
                }}
                variant="subtle"
              >
                Show more (
                {(
                  children.length - (treeNodeLimit[node.path] ?? 100)
                ).toLocaleString()}{' '}
                remaining)...
              </Button>
            )}
          </>
        ) : null}
      </Stack>
    );
  };

  const renderStorageSortHeader = (
    label: string,
    key: StorageSortKey,
  ): JSX.Element => (
    <button
      className="flex items-center gap-1 text-left font-semibold text-slate-900"
      onClick={() => handleStorageSort(key)}
      type="button"
    >
      <span>{label}</span>
      <IconSelector
        className={
          storageSortKey === key ? 'text-primary' : 'text-slate-400'
        }
        size={14}
      />
    </button>
  );

  const pageContent = (
    <div className="min-h-screen bg-[#f6f8fa]">
      <Container className="max-w-[1680px]" py="xl" size="100%">
        <Stack gap="lg">
          <Stack gap="md" px="sm">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>Storage Monitor</Title>
                <Text c="dimmed" mt={4} size="sm">
                  Gecko-backed storage view by project path using repository
                  analytics plus Syfon-backed object verification.
                </Text>
              </div>
            </Group>

            {!isProjectScopedRoute ? (
              <Select
                data={projectOptions.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                disabled={isProjectsLoading || projectOptions.length === 0}
                label="Project"
                onChange={(value) => {
                  setSelectedProject(value ?? '');
                  setCurrentPath(filesummaryConfig?.defaultPath?.trim() ?? '');
                }}
                placeholder="Select a project"
                searchable
                value={selectedProject}
              />
            ) : null}

            {!selectedProject && !isProjectsLoading && !isProjectScopedRoute ? (
              <Alert
                color="yellow"
                icon={<IconAlertCircle size={16} />}
                title="No projects"
              >
                No Gecko projects are available for this storage monitor.
              </Alert>
            ) : null}

            {error ? (
              <Alert
                color="red"
                icon={<IconAlertCircle size={16} />}
                title="Storage load failed"
              >
                {error}
              </Alert>
            ) : null}

            {data?.truncated ? (
              <Alert
                color="yellow"
                icon={<IconAlertCircle size={16} />}
                title="Partial summary"
              >
                This path has more direct children than the current page limit
                returned by Syfon metrics. The totals are still exact, but not
                every child row is shown yet.
              </Alert>
            ) : null}
          </Stack>

          {isProjectsLoading || isLoading ? (
            <Center h="45vh">
              <Loader size={32} />
            </Center>
          ) : selectedProjectParts ? (
            <>
              <Modal
                centered
                onClose={() => setRepoOrphanDeleteModalOpen(false)}
                opened={repoOrphanDeleteModalOpen}
                size="lg"
                title="Delete repo orphans and purge bucket files"
              >
                <Stack gap="md">
                  <Alert
                    color="red"
                    icon={<IconAlertCircle size={16} />}
                    title="This action cannot be undone"
                  >
                    Syfon will delete the selected repo-orphan records. For live
                    repo orphans, it will also attempt to delete the backing
                    storage objects from the bucket.
                  </Alert>

                  <Text size="sm">
                    Metadata-only deletions:{' '}
                    {repoOrphanDeletePlan.metadataOnlyObjectIds.length.toLocaleString()}
                    {' · '}
                    Bucket purge attempts:{' '}
                    {repoOrphanDeletePlan.purgeObjectIds.length.toLocaleString()}
                  </Text>

                  {repoOrphanDeletePlan.purgeUrls.length > 0 ? (
                    <Stack gap={6}>
                      <Text fw={700} size="sm">
                        Storage URLs scheduled for purge
                      </Text>
                      <div className="max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <Stack gap={6}>
                          {repoOrphanDeletePlan.purgeUrls.map((url) => (
                            <Text
                              className="break-all font-mono"
                              key={url}
                              size="xs"
                            >
                              {url}
                            </Text>
                          ))}
                        </Stack>
                      </div>
                    </Stack>
                  ) : (
                    <Alert
                      color="blue"
                      icon={<IconAlertCircle size={16} />}
                      title="No bucket purge targets in this selection"
                    >
                      This delete will remove Syfon metadata only.
                    </Alert>
                  )}

                  <Group justify="flex-end">
                    <Button
                      onClick={() => setRepoOrphanDeleteModalOpen(false)}
                      variant="default"
                    >
                      Cancel
                    </Button>
                    <Button
                      color="red"
                      loading={isApplying}
                      onClick={() => {
                        void handleConfirmRepoOrphanDelete();
                      }}
                    >
                      Delete records and purge files
                    </Button>
                  </Group>
                </Stack>
              </Modal>

              <Modal
                onClose={() => setAuditModalOpen(false)}
                opened={auditModalOpen}
                size="min(1680px, 96vw)"
                title="Storage Chain Audit"
              >
                <Stack gap="md">
                  <Text c="dimmed" size="sm">
                    Gecko audits the chain from bucket objects to Syfon
                    records to Git-tracked files. Anything that falls out of that
                    chain is surfaced here as a cleanup or ingest issue.
                  </Text>

                  {chainAuditError ? (
                    <Alert
                      color="red"
                      icon={<IconAlertCircle size={16} />}
                      title="Chain audit failed"
                    >
                      {chainAuditError}
                    </Alert>
                  ) : null}

                  {chainAuditResult && !chainAuditResult.summary.bucketInventoryAvailable ? (
                    <Alert
                      color="orange"
                      icon={<IconAlertCircle size={16} />}
                      title="Bucket inventory unavailable"
                    >
                      Syfon could not enumerate the mapped bucket target for this project. Gecko kept the audit running using probe-backed Syfon record evidence, but bucket-only object detection and bucket object totals are limited to what record probes could prove.
                      {chainAuditResult.summary.bucketInventoryError ? (
                        <Text mt={8} size="sm">
                          {chainAuditResult.summary.bucketInventoryError}
                        </Text>
                      ) : null}
                    </Alert>
                  ) : null}

                  {chainAuditResult && chainAuditResult.summary.bucketInventoryAvailable ? (
                    <Alert
                      color="green"
                      icon={<IconAlertCircle size={16} />}
                      title="Connected end-to-end"
                    >
                      {(chainAuditResult.summary.countsByKind.bucket_syfon_git_complete ?? 0).toLocaleString()}
                      {' '}
                      bucket objects currently join cleanly through Syfon into Git.
                      {' '}
                      Totals scanned:
                      {' '}
                      {chainAuditResult.summary.bucketObjectCount.toLocaleString()}
                      {' '}
                      bucket objects,
                      {' '}
                      {chainAuditResult.summary.syfonRecordCount.toLocaleString()}
                      {' '}
                      Syfon records,
                      {' '}
                      {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}
                      {' '}
                      Git-tracked files.
                    </Alert>
                  ) : null}

                  {chainAuditResult && !chainAuditResult.summary.bucketInventoryAvailable ? (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title="Record-backed connectivity only"
                    >
                      {(chainAuditResult.summary.countsByKind.bucket_syfon_git_complete ?? 0).toLocaleString()}
                      {' '}
                      record-backed bucket objects currently probe cleanly through Syfon into Git, but the full bucket-first audit is blocked because the mapped bucket target could not be enumerated.
                      {' '}
                      Totals scanned:
                      {' '}
                      {chainAuditResult.summary.bucketObjectCount.toLocaleString()}
                      {' '}
                      probe-backed bucket objects,
                      {' '}
                      {chainAuditResult.summary.syfonRecordCount.toLocaleString()}
                      {' '}
                      Syfon records,
                      {' '}
                      {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}
                      {' '}
                      Git-tracked files.
                    </Alert>
                  ) : null}

                  {isChainAuditing && !chainAuditResult && !chainAuditError ? (
                    <Center py="xl">
                      <Stack align="center" gap="xs">
                        <Loader size="sm" />
                        <Text c="dimmed" size="sm">
                          Running bucket, Syfon, and Git chain audit...
                        </Text>
                      </Stack>
                    </Center>
                  ) : chainIssueSummaries.length > 0 ? (
                    <Stack gap="sm">
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Title order={5}>Chain Findings</Title>
                          <Text c="dimmed" mt={4} size="sm">
                            High-level issues across the
                            {' '}
                            <span className="font-mono">bucket -&gt; Syfon -&gt; Git</span>
                            {' '}
                            chain.
                          </Text>
                        </div>
                        <Button
                          loading={isChainAuditing}
                          onClick={() => {
                            void runChainAudit();
                          }}
                          size="xs"
                          variant="light"
                        >
                          Refresh chain audit
                        </Button>
                      </Group>

                      <Table highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Chain Issue</Table.Th>
                            <Table.Th>Impact</Table.Th>
                            <Table.Th>Action</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {chainIssueSummaries.map((issue) => (
                            <Table.Tr key={issue.id}>
                              <Table.Td miw={420}>
                                <Stack gap={4}>
                                  <Group gap={8}>
                                    <Badge color={issue.color} variant="light">
                                      {issue.pathCount.toLocaleString()} paths
                                    </Badge>
                                    <Text fw={700} size="sm">
                                      {issue.title}
                                    </Text>
                                  </Group>
                                  <Text c="dimmed" size="sm">
                                    {issue.description}
                                  </Text>
                                  <Text size="sm">{issue.recommendation}</Text>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {issue.recordCount.toLocaleString()} records
                                  {' · '}
                                  {issue.objectCount.toLocaleString()} objects
                                  {' · '}
                                  {formatBytes(issue.totalBytes)}
                                </Text>
                              </Table.Td>
                              <Table.Td miw={260}>
                                <Group gap="xs">
                                  <Button
                                    color={selectedChainIssueId === issue.id ? 'gray' : issue.color}
                                    loading={isAuditing || isDiffAuditing || isChainAuditing}
                                    onClick={() => {
                                      void handleToggleChainIssueDetails(issue);
                                    }}
                                    size="xs"
                                    variant={selectedChainIssueId === issue.id ? 'outline' : 'light'}
                                  >
                                    {selectedChainIssueId === issue.id
                                      ? 'Hide paths'
                                      : issue.actionLabel
                                        ? `${issue.actionLabel} (${issue.pathCount.toLocaleString()})`
                                        : `See paths (${issue.pathCount.toLocaleString()})`}
                                  </Button>
                                </Group>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    </Stack>
                  ) : chainAuditResult ? (
                    <Alert
                      color="green"
                      icon={<IconAlertCircle size={16} />}
                      title="No chain issues"
                    >
                      Gecko did not find any broken Git-to-Syfon-to-bucket links
                      in this subtree.
                    </Alert>
                  ) : null}

                  {selectedChainIssue ? (
                    <Stack
                      className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                      gap="sm"
                    >
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Text fw={700} size="sm">
                            {selectedChainIssue.title}
                          </Text>
                          <Text c="dimmed" size="sm">
                            {selectedChainIssue.pathCount.toLocaleString()} paths in
                            this chain issue. Showing{' '}
                            {selectedChainFindings.length.toLocaleString()} findings.
                          </Text>
                        </div>
                        <Group gap="xs">
                          {actionableChainSelectionIssue ? (
                            <Button
                              color={selectedChainIssue?.id === 'bucket_only_object' ? 'red' : 'orange'}
                              disabled={selectedChainPaths.length === 0}
                              loading={isApplying}
                              onClick={() => {
                                void handleApplySelectedChainDeletion();
                              }}
                              size="xs"
                              variant="light"
                            >
                              {selectedChainIssue?.id === 'bucket_only_object'
                                ? `Delete selected bucket objects (${selectedChainPaths.length.toLocaleString()})`
                                : `Delete selected Syfon + bucket objects (${selectedChainPaths.length.toLocaleString()})`}
                            </Button>
                          ) : null}
                          {canRepairBrokenBucketMappings ? (
                            <Button
                              color="red"
                              loading={isApplying}
                              onClick={() => {
                                void handleRepairBrokenBucketMappings();
                              }}
                              size="xs"
                              variant="light"
                            >
                              Delete broken Syfon records ({selectedChainObjectIdsCount.toLocaleString()})
                            </Button>
                          ) : null}
                          <Button
                            onClick={() => setSelectedChainIssueId(null)}
                            size="xs"
                            variant="subtle"
                          >
                            Hide paths
                          </Button>
                        </Group>
                      </Group>

                      {actionableChainSelectionIssue &&
                      selectedChainFindings.length > 0 ? (
                        <Stack
                          className="rounded-md border border-slate-200 bg-white px-3 py-3"
                          gap="xs"
                        >
                          <Group justify="space-between" wrap="wrap">
                            <Checkbox
                              checked={
                                selectableChainPaths.length > 0 &&
                                selectedChainPaths.length === selectableChainPaths.length
                              }
                              indeterminate={
                                selectedChainPaths.length > 0 &&
                                selectedChainPaths.length < selectableChainPaths.length
                              }
                              label={`Select all loaded paths (${selectedChainPaths.length.toLocaleString()} / ${selectableChainPaths.length.toLocaleString()})`}
                              onChange={(event) => {
                                handleToggleAllChainPaths(event.currentTarget.checked);
                              }}
                            />
                            <Text c="dimmed" size="xs">
                              Expand folders and choose the exact bucket-backed paths to delete.
                            </Text>
                          </Group>
                          <Stack gap={4}>
                            {chainPathTree
                              .slice(0, treeNodeLimit[''] ?? 100)
                              .map((node) => renderChainTreeNode(node))}
                            {chainPathTree.length > (treeNodeLimit[''] ?? 100) && (
                              <Button
                                onClick={() =>
                                  setTreeNodeLimit((current) => ({
                                    ...current,
                                    '': (current[''] ?? 100) + 100,
                                  }))
                                }
                                size="xs"
                                style={{
                                  alignSelf: 'flex-start',
                                  marginLeft: 28,
                                }}
                                variant="subtle"
                              >
                                Show more (
                                {(
                                  chainPathTree.length - (treeNodeLimit[''] ?? 100)
                                ).toLocaleString()}{' '}
                                remaining)...
                              </Button>
                            )}
                          </Stack>
                        </Stack>
                      ) : null}

                      {selectedChainFindings.length > 0 ? (
                        !actionableChainSelectionIssue ? (
                          <>
                            <Table highlightOnHover stickyHeader>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Path</Table.Th>
                                  <Table.Th>Checksum</Table.Th>
                                  <Table.Th>Bucket Object</Table.Th>
                                  <Table.Th>Access URL</Table.Th>
                                  <Table.Th>Resolved Bucket/Key</Table.Th>
                                  <Table.Th>Probe</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {paginatedChainFindings.map((finding) => (
                                  <Table.Tr
                                    key={`${finding.kind}:${finding.normalizedPath}:${finding.objectIds.join(',')}`}
                                  >
                                    <Table.Td maw={360}>
                                      <Text className="break-all" fw={600} size="sm">
                                        {finding.normalizedPath}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td maw={220}>
                                      <Text className="break-all font-mono" size="xs">
                                        {finding.checksum || '—'}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td maw={280}>
                                      <Text className="break-all font-mono" size="xs">
                                        {finding.bucketObjectUrl ||
                                          finding.evidence?.bucketObjectUrls[0] ||
                                          '—'}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td maw={280}>
                                      <Stack gap={4}>
                                        {(finding.accessUrls.length > 0
                                          ? finding.accessUrls
                                          : finding.evidence?.accessUrls ?? []
                                        )
                                          .slice(0, 2)
                                          .map((accessUrl) => (
                                            <Text
                                              className="break-all font-mono"
                                              key={accessUrl}
                                              size="xs"
                                            >
                                              {accessUrl}
                                            </Text>
                                          ))}
                                      </Stack>
                                    </Table.Td>
                                    <Table.Td maw={260}>
                                      <Stack gap={4}>
                                        <Text className="break-all font-mono" size="xs">
                                          {finding.resolvedBucket || '—'}
                                        </Text>
                                        <Text className="break-all font-mono" size="xs">
                                          {finding.resolvedKey || '—'}
                                        </Text>
                                      </Stack>
                                    </Table.Td>
                                    <Table.Td maw={260}>
                                      <Stack gap={4}>
                                        <Badge color={selectedChainIssue.color} variant="light">
                                          {finding.probeStatus || 'unknown'}
                                        </Badge>
                                        <Text className="break-all" size="xs">
                                          {finding.errorKind || '—'}
                                        </Text>
                                        <Text className="break-all" size="xs">
                                          {finding.error || '—'}
                                        </Text>
                                      </Stack>
                                    </Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                            {totalChainPages > 1 ? (
                              <Group justify="center" mt="md">
                                <Pagination
                                  value={activeChainPage}
                                  onChange={setActiveChainPage}
                                  total={totalChainPages}
                                  size="sm"
                                />
                              </Group>
                            ) : null}
                          </>
                        ) : null
                      ) : (
                        <Alert
                          color="blue"
                          icon={<IconAlertCircle size={16} />}
                          title="No chain findings loaded"
                        >
                          Gecko did not return any chain detail rows for this issue.
                        </Alert>
                      )}
                    </Stack>
                  ) : null}

                  {(diffAuditResult || auditResult) ? (
                    <Stack gap="xs">
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Title order={5}>Supporting Details</Title>
                          <Text c="dimmed" mt={4} size="sm">
                            Open the lower-level diff or cleanup audits only when
                            you need the supporting evidence or delete actions.
                          </Text>
                        </div>
                        <Group gap="xs">
                          <Button
                            onClick={() => {
                              if (!showDiffDetails) {
                                void ensureDiffAuditLoaded();
                              }
                              setShowDiffDetails((current) => !current);
                            }}
                            size="xs"
                            variant="subtle"
                          >
                            {showDiffDetails
                              ? 'Hide project diff'
                              : `Show project diff${diffAuditResult ? ` (${diffAuditResult.summary.totalFindings.toLocaleString()})` : ''}`}
                          </Button>
                          <Button
                            onClick={() => {
                              if (!showCleanupDetails) {
                                void ensureCleanupAuditLoaded();
                              }
                              setShowCleanupDetails((current) => !current);
                            }}
                            size="xs"
                            variant="subtle"
                          >
                            {showCleanupDetails
                              ? 'Hide cleanup audit'
                              : `Show cleanup audit${auditResult ? ` (${auditResult.summary.totalFindings.toLocaleString()})` : ''}`}
                          </Button>
                        </Group>
                      </Group>
                    </Stack>
                  ) : null}

                  {showDiffDetails && diffAuditResult ? (
                    diffIssueSummaries.length > 0 ? (
                      <Stack gap="sm">
                        <div>
                          <Title order={5}>Project Diff</Title>
                          <Text c="dimmed" mt={4} size="sm">
                            Checksum join evidence between Git and Syfon.
                          </Text>
                        </div>
                        <Table highlightOnHover>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Issue</Table.Th>
                            <Table.Th>Impact</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {diffIssueSummaries.map((issue) => (
                            <Table.Tr key={issue.id}>
                              <Table.Td miw={520}>
                                <Stack gap={4}>
                                  <Group gap={8}>
                                    <Badge color={issue.color} variant="light">
                                      {issue.pathCount.toLocaleString()} paths
                                    </Badge>
                                    <Text fw={700} size="sm">
                                      {issue.title}
                                    </Text>
                                  </Group>
                                  <Text c="dimmed" size="sm">
                                    {issue.description}
                                  </Text>
                                  <Text size="sm">{issue.recommendation}</Text>
                                  <Group gap="xs">
                                    {issue.actionLabel ? (
                                      <Button
                                        color={issue.color}
                                        loading={isAuditing}
                                        onClick={() => {
                                          void handlePrepareCleanup(issue);
                                        }}
                                        size="xs"
                                        variant="light"
                                      >
                                        {issue.actionLabel}
                                      </Button>
                                    ) : null}
                                    <Button
                                      onClick={() => {
                                        setSelectedDiffIssueId((current) =>
                                          current === issue.id ? null : issue.id,
                                        );
                                      }}
                                      size="xs"
                                      variant="subtle"
                                    >
                                      {selectedDiffIssueId === issue.id
                                        ? 'Hide details'
                                        : `See details (${issue.pathCount.toLocaleString()})`}
                                    </Button>
                                  </Group>
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Text size="sm">
                                  {issue.recordCount.toLocaleString()} records
                                  {' · '}
                                  {issue.objectCount.toLocaleString()} objects
                                  {' · '}
                                  {formatBytes(issue.totalBytes)}
                                </Text>
                              </Table.Td>
                            </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Stack>
                    ) : (
                      <Alert
                        color="green"
                        icon={<IconAlertCircle size={16} />}
                        title="No project diff issues"
                      >
                        Git and Syfon are aligned for this subtree. No duplicate,
                        Syfon-only, or Git-only paths were returned.
                      </Alert>
                    )
                  ) : isDiffAuditing ? (
                    <Center h={140}>
                      <Loader size={28} />
                    </Center>
                  ) : null}

                  {showDiffDetails && diffAuditResult && selectedDiffIssue ? (
                    <Stack
                      className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                      gap="sm"
                    >
                      <Group justify="space-between" wrap="wrap">
                        <div>
                          <Text fw={700} size="sm">
                            {selectedDiffIssue.title}
                          </Text>
                          <Text c="dimmed" size="sm">
                            {selectedDiffIssue.pathCount.toLocaleString()} paths in
                            this issue set.
                          </Text>
                        </div>
                        <Button
                          onClick={() => setSelectedDiffIssueId(null)}
                          size="xs"
                          variant="subtle"
                        >
                          Hide details
                        </Button>
                      </Group>

                      <Table highlightOnHover stickyHeader>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Path</Table.Th>
                            <Table.Th>Issue</Table.Th>
                            <Table.Th>Records</Table.Th>
                            <Table.Th>Objects</Table.Th>
                            <Table.Th>Downloads</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {paginatedDiffFindings.map((finding) => (
                            <Table.Tr
                              key={`${finding.kind}:${finding.normalizedPath}`}
                            >
                              <Table.Td maw={560}>
                                <Text className="break-all" fw={600} size="sm">
                                  {finding.normalizedPath}
                                </Text>
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={getProjectDiffFindingColor(
                                    finding.kind,
                                  )}
                                  variant="light"
                                >
                                  {formatCleanupFindingLabel(finding.kind)}
                                </Badge>
                              </Table.Td>
                              <Table.Td>
                                {finding.recordCount.toLocaleString()}
                              </Table.Td>
                              <Table.Td maw={420}>
                                <Stack gap={4}>
                                  <Text c="dimmed" size="sm">
                                    {finding.objectIds.length.toLocaleString()}{' '}
                                    object ids
                                  </Text>
                                  {finding.objectIds
                                    .slice(0, 2)
                                    .map((objectId) => (
                                      <Text
                                        c="dimmed"
                                        className="break-all"
                                        key={objectId}
                                        size="xs"
                                      >
                                        {objectId}
                                      </Text>
                                    ))}
                                  {finding.objectIds.length > 2 ? (
                                    <Text c="dimmed" size="xs">
                                      +
                                      {(
                                        finding.objectIds.length - 2
                                      ).toLocaleString()}{' '}
                                      more
                                    </Text>
                                  ) : null}
                                  {finding.sourcePaths.slice(0, 2).map((sourcePath) => (
                                    <Text
                                      c="dimmed"
                                      className="break-all"
                                      key={sourcePath}
                                      size="xs"
                                    >
                                      {sourcePath}
                                    </Text>
                                  ))}
                                  {finding.sourcePaths.length > 2 ? (
                                    <Text c="dimmed" size="xs">
                                      +
                                      {(
                                        finding.sourcePaths.length - 2
                                      ).toLocaleString()}{' '}
                                      more source paths
                                    </Text>
                                  ) : null}
                                </Stack>
                              </Table.Td>
                              <Table.Td>
                                <Stack gap={4}>
                                  <Text size="sm">
                                    {(finding.downloadCount ?? 0).toLocaleString()}
                                  </Text>
                                  <Text c="dimmed" size="xs">
                                    {formatTimestamp(finding.lastDownload)}
                                  </Text>
                                </Stack>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                      {totalDiffPages > 1 ? (
                        <Group justify="center" mt="md">
                          <Pagination
                            value={activeDiffPage}
                            onChange={setActiveDiffPage}
                            total={totalDiffPages}
                            size="sm"
                          />
                        </Group>
                      ) : null}
                    </Stack>
                  ) : null}

                  {applyError ? (
                    <Alert
                      color="red"
                      icon={<IconAlertCircle size={16} />}
                      title="Cleanup apply failed"
                    >
                      {applyError}
                    </Alert>
                  ) : null}

                  {auditError ? (
                    <Alert
                      color="red"
                      icon={<IconAlertCircle size={16} />}
                      title="Delete preparation failed"
                    >
                      {auditError}
                    </Alert>
                  ) : null}

                  {applyResult ? (
                    <Alert
                      color={applyResult.dryRun ? 'blue' : 'green'}
                      icon={<IconAlertCircle size={16} />}
                      title={
                        applyResult.dryRun ? 'Cleanup dry run' : 'Cleanup applied'
                      }
                    >
                      Updated{' '}
                      {applyResult.updatedRecordIds.length.toLocaleString()} Syfon
                      records and removed{' '}
                      {applyResult.deletedRecordIds.length.toLocaleString()} Syfon
                      records.
                      {applyResult.deletedBucketObjectUrls.length > 0
                        ? ` Deleted bucket objects: ${applyResult.deletedBucketObjectUrls.length.toLocaleString()}.`
                        : ''}
                      {applyResult.purgeResults.length > 0
                        ? ` Storage purge attempts: ${applyResult.purgeResults.length.toLocaleString()}.`
                        : ''}
                      {applyResult.repoDeletePaths.length > 0
                        ? ` Repo follow-up paths: ${applyResult.repoDeletePaths.length.toLocaleString()}.`
                        : ''}
                      {applyResult.manualPaths.length > 0
                        ? ` Manual follow-up paths: ${applyResult.manualPaths.length.toLocaleString()}.`
                        : ''}
                      {applyResult.skippedPaths.length > 0
                        ? ` Skipped items: ${applyResult.skippedPaths.length.toLocaleString()}.`
                        : ''}
                    </Alert>
                  ) : null}

                  {showCleanupDetails && auditResult && isDuplicateVerificationContext && !hasSafeDuplicateCleanup ? (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title="No safe duplicate delete yet"
                    >
                      Syfon confirmed duplicate paths, but this verification pass
                      did not prove which sibling record is stale. The page will
                      only expose duplicate deletion when Syfon returns stale
                      duplicate findings.
                    </Alert>
                  ) : null}

                  {auditResult && showCleanupDetails ? (
                    <Stack gap="sm">
                      <div>
                        <Title order={5}>Cleanup Audit</Title>
                        <Text c="dimmed" mt={4} size="sm">
                          {selectedDiffIssue
                            ? `Storage verification for ${selectedDiffIssue.title.toLowerCase()} in this subtree.`
                            : 'Storage verification for the selected issue set.'}
                        </Text>
                      </div>

                      {showCleanupDetails && hiddenCleanupFindingCount > 0 ? (
                        <Alert
                          color="yellow"
                          icon={<IconAlertCircle size={16} />}
                          title="Additional verification details"
                        >
                          {hiddenCleanupFindingCount.toLocaleString()} findings are
                          not split into their own issue rows here. Use raw audit
                          only if you need the object-level detail.
                        </Alert>
                      ) : null}

                      {hasCleanupFindings && cleanupIssueSummaries.length > 0 ? (
                        <Table highlightOnHover>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Verification Result</Table.Th>
                              <Table.Th>Impact</Table.Th>
                              <Table.Th>Action</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {cleanupIssueSummaries.map((issue) => (
                              <Table.Tr key={issue.id}>
                                <Table.Td miw={260}>
                                  <Stack gap={4}>
                                    <Group gap={8}>
                                      <Badge color={issue.color} variant="light">
                                        {issue.pathCount.toLocaleString()} paths
                                      </Badge>
                                      <Text fw={700} size="sm">
                                        {issue.title}
                                      </Text>
                                    </Group>
                                    <Text c="dimmed" size="sm">
                                      {issue.description}
                                    </Text>
                                  </Stack>
                                </Table.Td>
                                <Table.Td>
                                  <Text size="sm">
                                    {issue.recordCount.toLocaleString()} records
                                    {' · '}
                                    {issue.objectCount.toLocaleString()} objects
                                    {' · '}
                                    {formatBytes(issue.totalBytes)}
                                  </Text>
                                </Table.Td>
                                <Table.Td miw={340}>
                                  <Group gap="xs">
                                    {issue.id === 'stale-duplicates' ? (
                                      <Button
                                        color="orange"
                                        loading={isApplying}
                                        onClick={() => {
                                          void handleApplyCleanup({
                                            deleteRepoOrphans: false,
                                            deleteStaleDuplicates: true,
                                            selectedPaths: selectedDiffPaths,
                                          });
                                        }}
                                        size="xs"
                                      >
                                        Delete duplicate records
                                      </Button>
                                    ) : null}

                                    {issue.id === 'repo-orphans' ? (
                                      <Button
                                        color="red"
                                        loading={isApplying}
                                        onClick={() => {
                                          setRepoOrphanDeleteModalOpen(true);
                                        }}
                                        size="xs"
                                      >
                                        Delete repo orphans
                                      </Button>
                                    ) : null}

                                    {issue.id === 'broken-access-urls' &&
                                    canDeleteBrokenRecords ? (
                                      <Button
                                        color="red"
                                        loading={isApplying}
                                        onClick={() => {
                                          void handleDeleteBrokenRecords();
                                        }}
                                        size="xs"
                                        variant="outline"
                                      >
                                        Delete broken records
                                      </Button>
                                    ) : null}

                                    <Button
                                      onClick={() => {
                                        setSelectedCleanupIssueId((current) =>
                                          current === issue.id ? null : issue.id,
                                        );
                                      }}
                                      size="xs"
                                      variant="subtle"
                                    >
                                      {selectedCleanupIssueId === issue.id
                                        ? 'Hide raw audit'
                                        : `See raw audit (${issue.pathCount.toLocaleString()})`}
                                    </Button>
                                  </Group>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      ) : (
                        <Alert
                          color="blue"
                          icon={<IconAlertCircle size={16} />}
                          title="No delete candidates after verification"
                        >
                          Storage verification did not return any safe cleanup
                          findings for the selected issue set.
                        </Alert>
                      )}

                      {hasCleanupFindings && selectedCleanupIssue ? (
                        <Stack
                          className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                          gap="sm"
                        >
                          <Group justify="space-between" wrap="wrap">
                            <div>
                              <Text fw={700} size="sm">
                                {selectedCleanupIssue.title}
                              </Text>
                              <Text c="dimmed" size="sm">
                                {selectedCleanupIssue.pathCount.toLocaleString()} paths in
                                this verification set.
                              </Text>
                            </div>
                            <Button
                              onClick={() => setSelectedCleanupIssueId(null)}
                              size="xs"
                              variant="subtle"
                            >
                              Hide raw audit
                            </Button>
                          </Group>

                          <Table highlightOnHover stickyHeader>
                            <Table.Thead>
                              <Table.Tr>
                                <Table.Th>Path</Table.Th>
                                <Table.Th>Finding</Table.Th>
                                <Table.Th>Objects</Table.Th>
                                <Table.Th>Downloads</Table.Th>
                                <Table.Th>Recommended Action</Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {paginatedCleanupFindings.map((finding) => (
                                <Table.Tr
                                  key={`${finding.kind}:${finding.normalizedPath}`}
                                >
                                  <Table.Td maw={380}>
                                    <Stack gap={4}>
                                      <Text className="break-all" fw={600} size="sm">
                                        {finding.normalizedPath}
                                      </Text>
                                      <Group gap={6}>
                                        {finding.repoDeleteCandidate ? (
                                          <Badge color="grape" variant="light">
                                            Repo Delete Candidate
                                          </Badge>
                                        ) : null}
                                        {finding.cleanupScope !== 'unknown' ? (
                                          <Badge
                                            color={
                                              finding.cleanupScope === 'access_url'
                                                ? 'red'
                                                : 'gray'
                                            }
                                            variant="light"
                                          >
                                            {finding.cleanupScope === 'access_url'
                                              ? 'Audit Only Partial'
                                              : 'Whole Record'}
                                          </Badge>
                                        ) : null}
                                        {finding.sizeBytes !== undefined ? (
                                          <Badge color="gray" variant="light">
                                            {formatBytes(finding.sizeBytes)}
                                          </Badge>
                                        ) : null}
                                      </Group>
                                    </Stack>
                                  </Table.Td>
                                  <Table.Td>
                                    <Badge
                                      color={getCleanupFindingColor(finding.kind)}
                                      variant="light"
                                    >
                                      {formatCleanupFindingLabel(finding.kind)}
                                    </Badge>
                                  </Table.Td>
                                  <Table.Td maw={360}>
                                    <Stack gap={4}>
                                      {finding.records.length > 0 ? (
                                        finding.records.map((record) => (
                                          <Stack gap={2} key={record.objectId}>
                                            <Text className="break-all" size="sm">
                                              {record.objectId}:&nbsp;
                                              {formatProbeResolution(record.status)}
                                              {record.cleanupScope === 'access_url'
                                                ? ' (partial)'
                                                : ''}
                                              {record.error
                                                ? ` (${record.error})`
                                                : ''}
                                            </Text>
                                            {record.accessProbes.map((probe) => (
                                              <Text
                                                c="dimmed"
                                                className="break-all"
                                                key={`${record.objectId}:${probe.url}`}
                                                size="xs"
                                              >
                                                {probe.url}:&nbsp;
                                                {formatProbeResolution(
                                                  probe.status,
                                                )}
                                                {probe.exists !== undefined
                                                  ? ` exists=${String(probe.exists)}`
                                                  : ''}
                                                {probe.bucket
                                                  ? ` bucket=${probe.bucket}`
                                                  : ''}
                                                {probe.key ? ` key=${probe.key}` : ''}
                                                {probe.sizeBytes !== undefined
                                                  ? ` size=${probe.sizeBytes}`
                                                  : ''}
                                                {probe.validationStatus
                                                  ? ` validation=${probe.validationStatus}`
                                                  : ''}
                                                {probe.validationMismatches.length > 0
                                                  ? ` mismatches=${probe.validationMismatches.join(',')}`
                                                  : ''}
                                                {probe.errorKind
                                                  ? ` error=${probe.errorKind}`
                                                  : ''}
                                                {probe.error
                                                  ? ` (${probe.error})`
                                                  : ''}
                                              </Text>
                                            ))}
                                          </Stack>
                                        ))
                                      ) : (
                                        <Text c="dimmed" size="sm">
                                          {finding.objectIds.length.toLocaleString()}{' '}
                                          object ids
                                        </Text>
                                      )}
                                    </Stack>
                                  </Table.Td>
                                  <Table.Td>
                                    <Stack gap={4}>
                                      <Text size="sm">
                                        {(finding.downloadCount ?? 0).toLocaleString()}
                                      </Text>
                                      <Text c="dimmed" size="xs">
                                        {formatTimestamp(finding.lastDownload)}
                                      </Text>
                                    </Stack>
                                  </Table.Td>
                                  <Table.Td maw={300}>
                                    <Text size="sm">
                                      {finding.recommendedAction}
                                    </Text>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                          {totalCleanupPages > 1 ? (
                            <Group justify="center" mt="md">
                              <Pagination
                                value={activeCleanupPage}
                                onChange={setActiveCleanupPage}
                                total={totalCleanupPages}
                                size="sm"
                              />
                            </Group>
                          ) : null}
                        </Stack>
                      ) : null}
                    </Stack>
                  ) : null}
                </Stack>
              </Modal>

              <Stack gap="md" px="sm">
                <div className="overflow-x-auto">
                  <div className="flex min-w-[1320px] items-center justify-between gap-6">
                    <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap overflow-x-auto pb-1">
                    {collapsedBreadcrumb.leadingItems.map((item, index) => (
                      <React.Fragment key={item.path || item.label}>
                        {index > 0 ? (
                          <IconChevronRight
                            className="shrink-0 text-slate-400"
                            size={14}
                          />
                        ) : null}
                        {index === 1 && collapsedBreadcrumb.hiddenItems.length > 0 ? (
                          <>
                            <Menu shadow="md" width={260} withinPortal>
                              <Menu.Target>
                                <button
                                  className="max-w-[220px] shrink-0 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                                  type="button"
                                >
                                  ...
                                </button>
                              </Menu.Target>
                              <Menu.Dropdown>
                                {collapsedBreadcrumb.hiddenItems.map((hiddenItem) => (
                                  <Menu.Item
                                    key={hiddenItem.path}
                                    onClick={() => setCurrentPath(hiddenItem.path)}
                                  >
                                    {hiddenItem.label}
                                  </Menu.Item>
                                ))}
                              </Menu.Dropdown>
                            </Menu>
                            <IconChevronRight
                              className="shrink-0 text-slate-400"
                              size={14}
                            />
                          </>
                        ) : null}
                        <button
                          className={`max-w-[240px] truncate rounded-md border px-3 py-1.5 text-sm font-semibold transition ${
                            item.path === currentPath
                              ? 'border-slate-200 bg-slate-100 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                          }`}
                          onClick={() => setCurrentPath(item.path)}
                          title={item.label}
                          type="button"
                        >
                          {item.label}
                        </button>
                      </React.Fragment>
                    ))}
                    </div>
                    <Group align="center" className="shrink-0 justify-self-end" gap="xs" wrap="nowrap">
                      <Button
                        loading={isDiffAuditing}
                        onClick={() => {
                          void handleOpenAuditModal();
                        }}
                        size="xs"
                        variant="light"
                      >
                        Audit Project
                      </Button>
                      <ActionIcon
                        aria-label="Refresh metrics"
                        disabled={!selectedProject}
                        onClick={() => refresh()}
                        size="lg"
                        variant="subtle"
                      >
                        <IconRefresh size={16} />
                      </ActionIcon>
                    </Group>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <div className="grid min-w-[1320px] grid-cols-[260px_140px_180px_120px_220px] items-end gap-x-8">
                    <div className="min-w-[220px]">
                      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                        Project
                      </Text>
                      <Text
                        className="mt-1 truncate"
                        fw={700}
                        size="sm"
                        title={pageTitle}
                      >
                        {pageTitle}
                      </Text>
                    </div>

                    <div className="min-w-[140px]">
                      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                        Size
                      </Text>
                      <Text className="mt-1" fw={700} size="sm">
                        {formatBytes(data?.sizeBytes ?? 0)}
                      </Text>
                    </div>

                    <div className="min-w-[140px]">
                      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                        Files
                      </Text>
                      <Text className="mt-1" fw={700} size="sm">
                        {(data?.fileCount ?? 0).toLocaleString()}
                        {' · '}
                        {data?.childCount ?? 0} children
                      </Text>
                    </div>

                    <div className="min-w-[120px]">
                      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                        Downloads
                      </Text>
                      <Text className="mt-1" fw={700} size="sm">
                        {(data?.downloadCount ?? 0).toLocaleString()}
                      </Text>
                    </div>

                    <div className="min-w-[200px]">
                      <Text c="dimmed" fw={700} size="xs" tt="uppercase">
                        Last Download
                      </Text>
                      <Text
                        className="mt-1 truncate"
                        fw={700}
                        size="sm"
                        title={formatTimestamp(data?.lastDownload)}
                      >
                        {formatTimestamp(data?.lastDownload)}
                      </Text>
                    </div>
                  </div>
                </div>

                <Stack gap="sm" pt="sm">
                  <Table highlightOnHover stickyHeader>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>
                          {renderStorageSortHeader('Name', 'name')}
                        </Table.Th>
                        <Table.Th>
                          {renderStorageSortHeader('Type', 'type')}
                        </Table.Th>
                        <Table.Th>
                          {renderStorageSortHeader('Size', 'sizeBytes')}
                        </Table.Th>
                        <Table.Th>
                          {renderStorageSortHeader('Files', 'fileCount')}
                        </Table.Th>
                        <Table.Th>
                          {renderStorageSortHeader('Downloads', 'downloadCount')}
                        </Table.Th>
                        <Table.Th>
                          {renderStorageSortHeader(
                            'Last Download',
                            'lastDownload',
                          )}
                        </Table.Th>
                        <Table.Th>
                          {renderStorageSortHeader(
                            'Latest Update',
                            'lastUpdated',
                          )}
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {sortedRows.length ? (
                        sortedRows.map((row) => {
                          const relativeWidth =
                            largestRowSize > 0
                              ? Math.max(
                                  4,
                                  Math.round(
                                    (row.sizeBytes / largestRowSize) * 100,
                                  ),
                                )
                              : 0;

                          return (
                            <Table.Tr key={`${row.type}:${row.path}`}>
                              <Table.Td>
                                {row.type === 'directory' ? (
                                  <button
                                    className="flex w-full items-start gap-2 text-left text-primary hover:underline"
                                    onClick={() => setCurrentPath(row.path)}
                                    type="button"
                                  >
                                    <IconFolder className="mt-0.5" size={16} />
                                    <div className="min-w-0">
                                      <span className="break-all">{row.name}</span>
                                    </div>
                                  </button>
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <IconFile className="mt-0.5" size={16} />
                                    <div className="min-w-0">
                                      <span className="break-all">{row.name}</span>
                                    </div>
                                  </div>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={row.type === 'directory' ? 'blue' : 'gray'}
                                  variant="light"
                                >
                                  {row.type}
                                </Badge>
                              </Table.Td>
                              <Table.Td miw={220}>
                                <Stack gap={6}>
                                  <Text fw={600} size="sm">
                                    {formatBytes(row.sizeBytes)}
                                  </Text>
                                  <Progress
                                    color={
                                      filesummaryConfig?.barChartColor || 'blue'
                                    }
                                    radius="xl"
                                    size="sm"
                                    value={relativeWidth}
                                  />
                                </Stack>
                              </Table.Td>
                              <Table.Td>{row.fileCount.toLocaleString()}</Table.Td>
                              <Table.Td>
                                {row.downloadCount.toLocaleString()}
                              </Table.Td>
                              <Table.Td>
                                {formatTimestamp(row.lastDownload)}
                              </Table.Td>
                              <Table.Td>{formatTimestamp(row.lastUpdated)}</Table.Td>
                            </Table.Tr>
                          );
                        })
                      ) : (
                        <Table.Tr>
                          <Table.Td colSpan={7}>
                            <Text c="dimmed" py="xl" ta="center">
                              No files or directories were returned for this path.
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      )}
                    </Table.Tbody>
                  </Table>
                </Stack>
              </Stack>
            </>
          ) : null}
        </Stack>
      </Container>
    </div>
  );

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR Storage Monitor',
        content: 'Storage Monitor',
        key: 'calypr-storage-monitor',
      }}
      mainProps={{ className: 'bg-[#f6f8fa]' }}
    >
      <ProtectedContent>
        {isProjectScopedRoute ? (
          <ProjectWorkspaceTabs
            activeTab="storage"
            hasExplorerConfig
            organization={routeOrganization}
            project={routeProject}
          >
            {pageContent}
          </ProjectWorkspaceTabs>
        ) : (
          pageContent
        )}
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default FileSummaryPage;
