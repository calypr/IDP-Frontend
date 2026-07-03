import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import {
  useBulkDeleteSyfonDrsObjectsMutation,
  CALYPR_EXPLORER_CONFIG_API,
} from '@gen3/core';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Center,
  Checkbox,
  Container,
  Group,
  Loader,
  Menu,
  Modal,
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
  type AuditActionOption,
  type ProjectDiffFinding,
  type ProjectDiffFindingKind,
  type StorageApplyActionRequest,
  type StorageChainFinding,
  type StorageChainFindingKind,
  type StorageChainIssueGroup,
  type StorageCleanupApplyResult,
  type StorageCleanupFinding,
  type StorageCleanupFindingKind,
  useSyfonProjectDiff,
  useSyfonStorageChain,
  useSyfonPathStorageSummary,
  useSyfonStorageCleanup,
} from './hooks';
import {
  buildProjectOptions,
  splitProjectSelectionValue,
  type StoragePathRow,
} from './storageUtils';

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

const formatCount = (
  count: number,
  singular: string,
  plural = `${singular}s`,
): string => `${count.toLocaleString()} ${count === 1 ? singular : plural}`;

const joinPhrases = (phrases: Array<string>): string => {
  if (phrases.length <= 2) {
    return phrases.join(' and ');
  }

  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
};

const sentenceCase = (value: string): string =>
  value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;

const buildCleanupApplySummary = (
  result: StorageCleanupApplyResult,
): string => {
  const operations = [
    result.updatedRecordIds.length > 0
      ? `${result.dryRun ? 'update' : 'updated'} ${formatCount(
          result.updatedRecordIds.length,
          'Syfon record',
        )}`
      : '',
    result.deletedRecordIds.length > 0
      ? `${result.dryRun ? 'remove' : 'removed'} ${formatCount(
          result.deletedRecordIds.length,
          'Syfon record',
        )}`
      : '',
    result.deletedBucketObjectUrls.length > 0
      ? `${result.dryRun ? 'delete' : 'deleted'} ${formatCount(
          result.deletedBucketObjectUrls.length,
          'bucket object',
        )}`
      : '',
  ].filter(Boolean);

  const sentences: Array<string> = [];
  if (operations.length > 0) {
    const summary = joinPhrases(operations);
    sentences.push(
      result.dryRun ? `Would ${summary}.` : `${sentenceCase(summary)}.`,
    );
  } else {
    sentences.push(
      result.dryRun
        ? 'No cleanup changes were found for this dry run.'
        : 'No cleanup changes were needed.',
    );
  }

  if (result.repoDeletePaths.length > 0) {
    sentences.push(
      `${formatCount(result.repoDeletePaths.length, 'repo path')} may need follow-up.`,
    );
  }
  if (result.manualPaths.length > 0) {
    sentences.push(
      `${formatCount(
        result.manualPaths.length,
        'manual follow-up path',
      )} still needs review.`,
    );
  }
  if (result.skippedPaths.length > 0) {
    sentences.push(
      `${formatCount(result.skippedPaths.length, 'item')} skipped.`,
    );
  }

  return sentences.join(' ');
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

type IssueActionSummary = {
  readonly actionability?: string;
  readonly availableActions: Array<AuditActionOption>;
  readonly defaultAction?: AuditActionOption;
  readonly supportsDryRun: boolean;
};

type ActionIssueSource = 'chain' | 'cleanup' | 'diff';

type ActionableFinding =
  | ProjectDiffFinding
  | StorageCleanupFinding
  | StorageChainFinding;

const resolveProjectSelection = ({
  defaultProject,
  options,
}: {
  defaultProject?: string;
  options: Array<{
    project: string;
    value: string;
  }>;
}): string => {
  if (options.length === 0) {
    return '';
  }
  if (!defaultProject?.trim()) {
    return options[0].value;
  }

  const normalizedDefault = defaultProject.trim();
  const directMatch = options.find(
    (option) => option.value === normalizedDefault,
  );
  if (directMatch) {
    return directMatch.value;
  }

  const projectOnlyMatches = options.filter(
    (option) => option.project === normalizedDefault,
  );
  if (projectOnlyMatches.length === 1) {
    return projectOnlyMatches[0].value;
  }

  return options[0].value;
};

const summarizeIssueActions = <
  T extends {
    readonly actionability?: string;
    readonly availableActions: Array<AuditActionOption>;
    readonly defaultAction?: string;
    readonly supportsDryRun: boolean;
  },
>(
  findings: Array<T>,
  fallbackAction?: AuditActionOption,
): IssueActionSummary => {
  const availableActions = Array.from(
    new Map(
      findings
        .flatMap((finding) => finding.availableActions)
        .map((action) => [action.action, action]),
    ).values(),
  );

  const actionability = findings.find(
    (finding) => finding.actionability,
  )?.actionability;
  const defaultActionName =
    findings.find((finding) => finding.defaultAction)?.defaultAction ??
    fallbackAction?.action;
  const defaultAction =
    availableActions.find((action) => action.action === defaultActionName) ??
    fallbackAction ??
    availableActions[0];

  return {
    actionability,
    availableActions:
      fallbackAction && availableActions.length === 0
        ? [fallbackAction]
        : availableActions,
    defaultAction,
    supportsDryRun:
      findings.some((finding) => finding.supportsDryRun) ||
      Boolean(defaultAction?.supportsDryRun),
  };
};

const buildPathsByParentMap = (
  paths: Array<string>,
): Map<string, Array<ChainPathTreeNode>> => {
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
    list.sort((left, right) => {
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

const formatProbeResolution = (status?: string): string => {
  return status?.trim() || 'unknown';
};

const compareOptionalDates = (left?: string, right?: string): number => {
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

const getCleanupFindingColor = (kind: StorageCleanupFindingKind): string => {
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

const issueColorForDiffKind = (kind: ProjectDiffFindingKind): string => {
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
  readonly actionSummary: IssueActionSummary;
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

  return groups
    .map((group) => {
      const matched = findings.filter((finding) =>
        group.findingKinds.includes(finding.kind),
      );
      if (matched.length === 0) {
        return null;
      }

      return {
        actionSummary: summarizeIssueActions(
          matched,
          group.id === 'git-only'
            ? {
                action: 'view_paths',
                destructive: false,
                label: 'View paths',
                requiresConfirmation: false,
                supportsDryRun: false,
              }
            : undefined,
        ),
        color: group.color,
        description: group.description,
        findingKinds: group.findingKinds,
        id: group.id,
        objectCount: new Set(matched.flatMap((finding) => finding.objectIds))
          .size,
        pathCount: matched.length,
        recommendation: group.recommendation,
        recordCount: matched.reduce(
          (sum, finding) => sum + (finding.recordCount || 0),
          0,
        ),
        title: group.title,
        totalBytes: matched.reduce(
          (sum, finding) => sum + (finding.sizeBytes ?? 0),
          0,
        ),
      };
    })
    .filter((item): item is ProjectDiffIssueSummary => item !== null);
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
  readonly actionSummary: IssueActionSummary;
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
        actionSummary: summarizeIssueActions(matched),
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
  readonly actionSummary: IssueActionSummary;
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
    recommendation: 'Investigate metadata drift before applying deletion.',
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
  chainFindings,
  chainGroups,
}: {
  chainFindings: Array<StorageChainFinding>;
  chainGroups: Array<StorageChainIssueGroup>;
}): Array<ChainIssueSummary> => {
  const groupsByKind = new Map(chainGroups.map((group) => [group.kind, group]));

  return chainIssueDefinitions.reduce<Array<ChainIssueSummary>>(
    (summaries, definition) => {
      const group = groupsByKind.get(definition.id);
      if (!group || group.findingCount <= 0) {
        return summaries;
      }

      const matchingFindings = chainFindings.filter(
        (finding) => finding.kind === definition.id,
      );

      summaries.push({
        actionSummary: summarizeIssueActions(
          matchingFindings,
          definition.id === 'git_only_no_syfon'
            ? {
                action: 'view_paths',
                destructive: false,
                label: 'View paths',
                requiresConfirmation: false,
                supportsDryRun: false,
              }
            : definition.id === 'syfon_git_no_bucket' ||
                definition.id === 'syfon_missing_bucket_object'
              ? {
                  action: 'delete_records',
                  destructive: true,
                  label: 'Delete Syfon records',
                  requiresConfirmation: true,
                  supportsDryRun: false,
                }
              : definition.id === 'git_syfon_metadata_mismatch' ||
                  definition.id === 'probe_error' ||
                  definition.id === 'syfon_broken_bucket_mapping'
                ? {
                    action: 'view_paths',
                    destructive: false,
                    label: 'Show paths',
                    requiresConfirmation: false,
                    supportsDryRun: false,
                  }
                : undefined,
        ),
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
  const [projectOptions, setProjectOptions] = useState<
    Array<ReturnType<typeof buildProjectOptions>[number]>
  >([]);
  const [isProjectsLoading, setIsProjectsLoading] =
    useState(!isProjectScopedRoute);
  const defaultSelection = useMemo(() => {
    if (forcedProjectSelection) {
      return forcedProjectSelection;
    }
    return resolveProjectSelection({
      defaultProject: filesummaryConfig?.defaultProject,
      options: projectOptions,
    });
  }, [
    filesummaryConfig?.defaultProject,
    forcedProjectSelection,
    projectOptions,
  ]);
  const [selectedProject, setSelectedProject] = useState('');
  const [currentPath, setCurrentPath] = useState(
    filesummaryConfig?.defaultPath?.trim() ?? '',
  );
  const [selectedChainIssueId, setSelectedChainIssueId] = useState<
    string | null
  >(null);
  const [selectedDiffIssueId, setSelectedDiffIssueId] = useState<string | null>(
    null,
  );
  const [showCleanupDetails, setShowCleanupDetails] = useState(false);
  const [showDiffDetails, setShowDiffDetails] = useState(false);
  const [selectedChainPathsByIssue, setSelectedChainPathsByIssue] = useState<
    Record<string, Array<string>>
  >({});
  const [expandedChainTreeNodes, setExpandedChainTreeNodes] = useState<
    Record<string, boolean>
  >({});
  const [treeNodeLimit, setTreeNodeLimit] = useState<Record<string, number>>(
    {},
  );
  const [actionFeedbackMessage, setActionFeedbackMessage] = useState<
    string | null
  >(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [isBulkDeletingRecords, setIsBulkDeletingRecords] = useState(false);
  const [storageSortKey, setStorageSortKey] =
    useState<StorageSortKey>('sizeBytes');
  const [storageSortDirection, setStorageSortDirection] =
    useState<StorageSortDirection>('desc');

  useEffect(() => {
    if (isProjectScopedRoute) {
      setProjectOptions([]);
      setIsProjectsLoading(false);
      return;
    }

    let cancelled = false;

    const loadProjectOptions = async () => {
      setIsProjectsLoading(true);
      try {
        const response = await fetch(
          `${CALYPR_EXPLORER_CONFIG_API}/projects/summary`,
          {
            credentials: 'include',
            method: 'GET',
          },
        );

        if (response.status === 401 || response.status === 403) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!response.ok) {
          throw new Error('Failed to load project list.');
        }

        const summary = (await response.json()) as Array<{
          organization: string;
          project: string;
        }>;

        if (!cancelled) {
          setProjectOptions(buildProjectOptions(summary));
        }
      } catch {
        if (!cancelled) {
          setProjectOptions([]);
        }
      } finally {
        if (!cancelled) {
          setIsProjectsLoading(false);
        }
      }
    };

    void loadProjectOptions();

    return () => {
      cancelled = true;
    };
  }, [isProjectScopedRoute]);

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
      leadingItems: [breadcrumbItems[0], ...breadcrumbItems.slice(-4)],
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
    isApplying,
    isAuditing,
    rerunAudit,
    runAudit,
  } = useSyfonStorageCleanup({
    config: filesummaryConfig,
    currentPath,
    projectSelection: selectedProject,
  });
  const [bulkDeleteSyfonDrsObjects] = useBulkDeleteSyfonDrsObjectsMutation();

  useEffect(() => {
    clearChainAudit();
    clearDiffAudit();
    clearCleanupResults();
  }, [
    clearChainAudit,
    clearCleanupResults,
    clearDiffAudit,
    currentPath,
    selectedProject,
  ]);

  useEffect(() => {
    setActionFeedbackMessage(null);
    setSelectedChainIssueId(null);
    setSelectedDiffIssueId(null);
    setShowCleanupDetails(false);
    setShowDiffDetails(false);
    setSelectedChainPathsByIssue({});
    setExpandedChainTreeNodes({});
    setTreeNodeLimit({});
  }, [auditResult?.pathPrefix, currentPath, selectedProject]);

  const pageTitle = selectedProjectParts
    ? `${selectedProjectParts.organization}/${selectedProjectParts.project}`
    : 'Storage Monitor';
  const sortedRows = useMemo(
    () =>
      sortStorageRowsBy(data?.rows ?? [], storageSortKey, storageSortDirection),
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
  const chainIssueSummaries = useMemo(
    () =>
      summarizeStorageChainIssues({
        chainFindings: chainAuditResult?.findings ?? [],
        chainGroups: chainAuditResult?.groups ?? [],
      }),
    [chainAuditResult?.findings, chainAuditResult?.groups],
  );
  const cleanChainJoinCount =
    chainAuditResult?.summary.countsByKind.bucket_syfon_git_complete ?? 0;
  const hasChainIssues = chainIssueSummaries.length > 0;
  const selectedChainIssue = useMemo(
    () =>
      chainIssueSummaries.find((issue) => issue.id === selectedChainIssueId) ??
      null,
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
        ? (selectedChainPathsByIssue[selectedChainIssue?.id ?? ''] ?? [])
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
  const selectedChainApplyFindings = useMemo(
    () =>
      selectedChainFindings.filter((finding) =>
        selectedChainPathsSet.has(finding.normalizedPath),
      ),
    [selectedChainFindings, selectedChainPathsSet],
  );
  const chainPathTree = useMemo(
    () => pathsByParent.get('') ?? [],
    [pathsByParent],
  );
  const selectedDiffIssue =
    diffIssueSummaries.find((issue) => issue.id === selectedDiffIssueId) ??
    null;
  const selectedDiffFindings = useMemo(
    () =>
      selectedDiffIssue
        ? (diffAuditResult?.findings ?? []).filter((finding) =>
            selectedDiffIssue.findingKinds.includes(finding.kind),
          )
        : [],
    [diffAuditResult?.findings, selectedDiffIssue],
  );
  const cleanupIssueSummaries = useMemo(
    () => summarizeCleanupIssues(auditResult?.findings ?? []),
    [auditResult?.findings],
  );
  const hasCleanupFindings = (auditResult?.summary.totalFindings ?? 0) > 0;
  const isDuplicateVerificationContext =
    selectedDiffIssue?.id === 'duplicate-syfon-paths';
  const hasSafeDuplicateCleanup = cleanupIssueSummaries.some(
    (issue) => issue.id === 'stale-duplicates',
  );

  useEffect(() => {
    if (!actionableChainSelectionIssue || !selectedChainIssue) {
      return;
    }
    setSelectedChainPathsByIssue((current) => {
      const existing = current[selectedChainIssue.id];
      const available = new Set(selectableChainPaths);
      const next = (existing ?? []).filter((path) => available.has(path));
      if (
        existing &&
        existing.length === next.length &&
        existing.every((value, index) => value === next[index])
      ) {
        return current;
      }
      return {
        ...current,
        [selectedChainIssue.id]: next,
      };
    });
  }, [actionableChainSelectionIssue, selectableChainPaths, selectedChainIssue]);
  const buildActionRequests = useCallback(
    ({
      action,
      findings,
    }: {
      action: string;
      findings: Array<ActionableFinding>;
    }): Array<StorageApplyActionRequest> =>
      Array.from(
        new Map(
          findings
            .filter((finding) => finding.normalizedPath)
            .map((finding) => [
              `${finding.kind}:${finding.normalizedPath}:${action}`,
              {
                action,
                kind: finding.kind,
                normalized_path: finding.normalizedPath,
              },
            ]),
        ).values(),
      ),
    [],
  );

  const resolveIssueAction = useCallback(
    ({
      defaultAction,
      issueId,
      findings,
    }: {
      defaultAction?: AuditActionOption;
      issueId: string;
      findings: Array<ActionableFinding>;
    }): AuditActionOption | null => {
      const availableActions = Array.from(
        new Map(
          findings
            .flatMap((finding) => finding.availableActions)
            .map((action) => [action.action, action]),
        ).values(),
      );

      if (availableActions.length > 0) {
        return (
          availableActions.find(
            (action) => action.action === defaultAction?.action,
          ) ??
          defaultAction ??
          availableActions[0]
        );
      }

      if (issueId === 'git-only' || issueId === 'git_only_no_syfon') {
        return {
          action: 'view_paths',
          destructive: false,
          label: 'View paths',
          requiresConfirmation: false,
          supportsDryRun: false,
        };
      }

      if (
        issueId === 'syfon_git_no_bucket' ||
        issueId === 'syfon_missing_bucket_object'
      ) {
        return {
          action: 'delete_records',
          destructive: true,
          label: 'Delete Syfon records',
          requiresConfirmation: true,
          supportsDryRun: false,
        };
      }

      if (issueId === 'probe_error') {
        return {
          action: 'rerun_audit',
          destructive: false,
          label: 'Retry verification',
          requiresConfirmation: false,
          supportsDryRun: false,
        };
      }

      return {
        action: 'view_paths',
        destructive: false,
        label: 'View paths',
        requiresConfirmation: false,
        supportsDryRun: false,
      };
    },
    [],
  );

  const removeHealedChainFindings = useCallback(
    (issueId: string, paths: Array<string>) => {
      const pathSet = new Set(paths);
      setChainAuditResult((current) => {
        if (!current) {
          return current;
        }

        const findings = current.findings.filter(
          (finding) =>
            !(finding.kind === issueId && pathSet.has(finding.normalizedPath)),
        );

        const countsByKind = Object.keys(current.summary.countsByKind).reduce<
          Record<string, number>
        >((accumulator, key) => {
          accumulator[key] = 0;
          return accumulator;
        }, {});

        findings.forEach((finding) => {
          countsByKind[finding.kind] = (countsByKind[finding.kind] ?? 0) + 1;
        });

        const groupsMap = new Map<
          string,
          {
            findingCount: number;
            objectIds: Set<string>;
            pathCount: number;
            recordCount: number;
            totalBytes: number;
          }
        >();

        findings.forEach((finding) => {
          const existing = groupsMap.get(finding.kind) ?? {
            findingCount: 0,
            objectIds: new Set<string>(),
            pathCount: 0,
            recordCount: 0,
            totalBytes: 0,
          };
          existing.findingCount += 1;
          existing.pathCount += 1;
          existing.recordCount += finding.recordCount;
          existing.totalBytes += finding.sizeBytes ?? 0;
          finding.objectIds.forEach((objectId) =>
            existing.objectIds.add(objectId),
          );
          groupsMap.set(finding.kind, existing);
        });

        const groups = current.groups
          .map((group) => {
            const updated = groupsMap.get(group.kind);
            if (!updated) {
              return null;
            }

            return {
              kind: group.kind,
              findingCount: updated.findingCount,
              objectCount: updated.objectIds.size,
              pathCount: updated.pathCount,
              recordCount: updated.recordCount,
              totalBytes: updated.totalBytes,
            };
          })
          .filter(
            (group): group is NonNullable<typeof group> => group !== null,
          );

        return {
          ...current,
          findings,
          groups,
          summary: {
            ...current.summary,
            countsByKind,
            syfonRecordCount: Math.max(
              0,
              current.summary.syfonRecordCount - pathSet.size,
            ),
            totalFindings: findings.length,
          },
        };
      });
      setSelectedChainIssueId((current) =>
        current === issueId ? null : current,
      );
    },
    [setChainAuditResult],
  );

  const handleBulkDeleteSyfonRecords = useCallback(
    async ({
      findings,
      issueTitle,
      paths,
    }: {
      findings: Array<ActionableFinding>;
      issueTitle: string;
      paths: Array<string>;
    }) => {
      const objectIds = Array.from(
        new Set(
          findings.flatMap((finding) =>
            'objectIds' in finding && Array.isArray(finding.objectIds)
              ? finding.objectIds
              : [],
          ),
        ),
      ).filter(Boolean);

      if (objectIds.length === 0) {
        setActionFeedbackMessage(
          `${issueTitle} did not include any Syfon record ids to delete.`,
        );
        return;
      }

      const approved = window.confirm(
        `Delete ${objectIds.length.toLocaleString()} Syfon record${objectIds.length === 1 ? '' : 's'} across ${paths.length.toLocaleString()} path${paths.length === 1 ? '' : 's'}?\n\nThis removes Syfon metadata only. Bucket objects will not be deleted.`,
      );
      if (!approved) {
        return;
      }

      try {
        setIsBulkDeletingRecords(true);
        await bulkDeleteSyfonDrsObjects({
          bulk_object_ids: objectIds,
          delete_object_metadata: true,
          delete_storage_data: false,
        }).unwrap();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Syfon record deletion failed.';
        setActionFeedbackMessage(message);
        return;
      } finally {
        setIsBulkDeletingRecords(false);
      }

      setActionFeedbackMessage(
        `Deleted ${objectIds.length.toLocaleString()} Syfon record${objectIds.length === 1 ? '' : 's'} across ${paths.length.toLocaleString()} path${paths.length === 1 ? '' : 's'}.`,
      );
      setSelectedChainIssueId(null);
      removeHealedChainFindings(
        findings[0] && 'kind' in findings[0] ? findings[0].kind : '',
        paths,
      );
    },
    [bulkDeleteSyfonDrsObjects, removeHealedChainFindings],
  );

  const runIssueAction = useCallback(
    async ({
      defaultAction,
      findings,
      issueId,
      issueTitle,
      paths,
      source,
    }: {
      defaultAction?: AuditActionOption;
      findings: Array<ActionableFinding>;
      issueId: string;
      issueTitle: string;
      paths: Array<string>;
      source: ActionIssueSource;
    }) => {
      const resolvedAction = resolveIssueAction({
        defaultAction,
        findings,
        issueId,
      });

      if (!resolvedAction) {
        setActionFeedbackMessage(
          `${issueTitle} does not currently expose any backend action.`,
        );
        return;
      }

      const actionName = resolvedAction.action;
      const selectedPaths = paths;

      if (actionName === 'view_paths') {
        if (source === 'diff') {
          setSelectedDiffIssueId(issueId);
          setShowDiffDetails(true);
        }
        if (source === 'chain') {
          setSelectedChainIssueId(issueId);
        }
        return;
      }

      if (source === 'chain') {
        setSelectedChainIssueId(issueId);
        return;
      }

      if (actionName === 'rerun_audit') {
        await rerunAudit();
        return;
      }

      if (actionName === 'delete_records') {
        await handleBulkDeleteSyfonRecords({
          findings,
          issueTitle,
          paths: selectedPaths,
        });
        return;
      }

      if (
        actionName === 'verify_duplicates' ||
        actionName === 'prepare_delete'
      ) {
        if (source === 'diff') {
          setSelectedDiffIssueId(issueId);
        }
        setShowCleanupDetails(true);
        const result = await runAudit({
          includeRepoManifest: true,
          selectedPaths,
        });
        if (result) {
          const verifiedPathCount = new Set(
            result.findings
              .map((finding) => finding.normalizedPath)
              .filter(Boolean),
          ).size;
          setActionFeedbackMessage(
            result.summary.totalFindings > 0
              ? `${resolvedAction.label} returned ${result.summary.totalFindings.toLocaleString()} cleanup finding${result.summary.totalFindings === 1 ? '' : 's'} across ${verifiedPathCount.toLocaleString()} path${verifiedPathCount === 1 ? '' : 's'}.`
              : `${resolvedAction.label} completed, but Syfon did not return any cleanup findings for these paths.`,
          );
        }
        return;
      }

      if (resolvedAction.requiresConfirmation || resolvedAction.destructive) {
        let approved = true;
        if (resolvedAction.supportsDryRun) {
          const preview = await applyCleanup({
            actions: buildActionRequests({
              action: actionName,
              findings,
            }),
            findings: findings.filter(
              (
                finding,
              ): finding is StorageCleanupFinding | StorageChainFinding =>
                'records' in finding,
            ),
            deleteBucketOnlyObjects: false,
            deleteRepoOrphans: false,
            deleteStaleDuplicates: false,
            dryRun: true,
            selectedPaths,
          });

          if (!preview) {
            return;
          }

          approved = window.confirm(
            `${resolvedAction.label}\n\nDelete records: ${preview.deletedRecordIds.length.toLocaleString()}\nDelete bucket objects: ${preview.deletedBucketObjectUrls.length.toLocaleString()}\nSkipped paths: ${preview.skippedPaths.length.toLocaleString()}\n\nProceed?`,
          );
        } else {
          approved = window.confirm(
            `${resolvedAction.label}\n\nThis action will modify project state. Proceed?`,
          );
        }

        if (!approved) {
          return;
        }
      }

      const result = await applyCleanup({
        actions: buildActionRequests({
          action: actionName,
          findings,
        }),
        findings: findings.filter(
          (finding): finding is StorageCleanupFinding | StorageChainFinding =>
            'records' in finding,
        ),
        deleteBucketOnlyObjects: false,
        deleteRepoOrphans: false,
        deleteStaleDuplicates: false,
        dryRun: false,
        selectedPaths,
      });

      if (!result) {
        return;
      }

      setActionFeedbackMessage(
        `${resolvedAction.label} completed for ${selectedPaths.length.toLocaleString()} path${selectedPaths.length === 1 ? '' : 's'}.`,
      );
      refresh();
    },
    [
      applyCleanup,
      buildActionRequests,
      handleBulkDeleteSyfonRecords,
      refresh,
      resolveIssueAction,
      rerunAudit,
      runAudit,
    ],
  );

  const handleToggleChainIssueDetails = useCallback((issueId: string) => {
    setSelectedChainIssueId((current) =>
      current === issueId ? null : issueId,
    );
  }, []);

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
    [
      actionableChainSelectionIssue,
      selectableChainPaths,
      setSelectedChainPathsForIssue,
    ],
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

  const renderChainTreeNode = (
    node: ChainPathTreeNode,
    depth = 0,
  ): React.ReactNode => {
    const descendantLeafPaths = node.descendantLeafPaths;
    const selectedCount = descendantLeafPaths.filter((value) =>
      selectedChainPathsSet.has(value),
    ).length;
    const fullySelected =
      descendantLeafPaths.length > 0 &&
      selectedCount === descendantLeafPaths.length;
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
              onClick={() =>
                setExpandedChainTreeNodes((current) => ({
                  ...current,
                  [node.path]: !current[node.path],
                }))
              }
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
                nextSelected = Array.from(
                  new Set([...selectedChainPaths, ...descendantLeafPaths]),
                ).sort();
              } else {
                const descendantSet = new Set(descendantLeafPaths);
                nextSelected = selectedChainPaths.filter(
                  (path) => !descendantSet.has(path),
                );
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

  const handleApplySelectedChainObjects = useCallback(async () => {
    if (!selectedChainIssue || selectedChainPaths.length === 0) {
      return;
    }

    const isBucketOnlyIssue = selectedChainIssue.id === 'bucket_only_object';
    const isBucketSyfonNoGitIssue =
      selectedChainIssue.id === 'bucket_syfon_no_git';
    if (!isBucketOnlyIssue && !isBucketSyfonNoGitIssue) {
      return;
    }

    const approved = window.confirm(
      isBucketOnlyIssue
        ? `Delete ${selectedChainPaths.length.toLocaleString()} selected bucket-only path${selectedChainPaths.length === 1 ? '' : 's'}?\n\nThis will ask Syfon to delete the bucket objects in one bulk request.`
        : `Delete ${selectedChainPaths.length.toLocaleString()} selected Bucket + Syfon, No Git path${selectedChainPaths.length === 1 ? '' : 's'}?\n\nThis will ask Syfon to delete both the Syfon records and bucket objects in one bulk request.`,
    );
    if (!approved) {
      return;
    }

    const result = await applyCleanup({
      deleteBucketOnlyObjects: isBucketOnlyIssue,
      deleteRepoOrphans: isBucketSyfonNoGitIssue,
      deleteStaleDuplicates: false,
      findings: selectedChainApplyFindings,
      dryRun: false,
      selectedPaths: selectedChainPaths,
    });

    if (!result) {
      return;
    }

    setActionFeedbackMessage(
      isBucketOnlyIssue
        ? `Deleted ${selectedChainPaths.length.toLocaleString()} selected bucket-only path${selectedChainPaths.length === 1 ? '' : 's'} in one Syfon bulk request.`
        : `Deleted ${selectedChainPaths.length.toLocaleString()} selected Bucket + Syfon, No Git path${selectedChainPaths.length === 1 ? '' : 's'} in one Syfon bulk request.`,
    );
    removeHealedChainFindings(selectedChainIssue.id, selectedChainPaths);
  }, [
    applyCleanup,
    removeHealedChainFindings,
    selectedChainApplyFindings,
    selectedChainIssue,
    selectedChainPaths,
  ]);

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
        className={storageSortKey === key ? 'text-primary' : 'text-slate-400'}
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
                onClose={() => setAuditModalOpen(false)}
                opened={auditModalOpen}
                size="min(1680px, 96vw)"
                title="Storage Chain Audit"
              >
                <Stack gap="md">
                  <Text c="dimmed" size="sm">
                    Gecko audits the chain from bucket objects to Syfon records
                    to Git-tracked files. Anything that falls out of that chain
                    is surfaced here as a cleanup or ingest issue.
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

                  {actionFeedbackMessage ? (
                    <Alert
                      color="blue"
                      icon={<IconAlertCircle size={16} />}
                      title="Action complete"
                    >
                      {actionFeedbackMessage}
                    </Alert>
                  ) : null}

                  {chainAuditResult &&
                  !chainAuditResult.summary.bucketInventoryAvailable ? (
                    <Alert
                      color="orange"
                      icon={<IconAlertCircle size={16} />}
                      title="Bucket inventory unavailable"
                    >
                      Syfon could not enumerate the mapped bucket target for
                      this project. Gecko kept the audit running using
                      record-backed storage validation, but bucket-only object
                      detection and bucket object totals are limited to what
                      fallback validation could prove.
                      {chainAuditResult.summary.bucketInventoryError ? (
                        <Text mt={8} size="sm">
                          {chainAuditResult.summary.bucketInventoryError}
                        </Text>
                      ) : null}
                    </Alert>
                  ) : null}

                  {chainAuditResult &&
                  chainAuditResult.summary.bucketInventoryAvailable &&
                  !hasChainIssues &&
                  cleanChainJoinCount > 0 ? (
                    <Alert
                      color="green"
                      icon={<IconAlertCircle size={16} />}
                      title="Connected end-to-end"
                    >
                      {cleanChainJoinCount.toLocaleString()} bucket objects
                      currently join cleanly through Syfon into Git. Totals
                      scanned:{' '}
                      {chainAuditResult.summary.bucketObjectCount.toLocaleString()}{' '}
                      bucket objects,{' '}
                      {chainAuditResult.summary.syfonRecordCount.toLocaleString()}{' '}
                      Syfon records,{' '}
                      {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
                      Git-tracked files.
                    </Alert>
                  ) : null}

                  {chainAuditResult &&
                  chainAuditResult.summary.bucketInventoryAvailable &&
                  hasChainIssues ? (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title="Chain issues found"
                    >
                      {cleanChainJoinCount.toLocaleString()} bucket objects
                      currently join cleanly through Syfon into Git, but this
                      subtree also contains{' '}
                      {chainIssueSummaries
                        .reduce((sum, issue) => sum + issue.pathCount, 0)
                        .toLocaleString()}{' '}
                      issue paths that need attention. Totals scanned:{' '}
                      {chainAuditResult.summary.bucketObjectCount.toLocaleString()}{' '}
                      bucket objects,{' '}
                      {chainAuditResult.summary.syfonRecordCount.toLocaleString()}{' '}
                      Syfon records,{' '}
                      {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
                      Git-tracked files.
                    </Alert>
                  ) : null}

                  {chainAuditResult &&
                  !chainAuditResult.summary.bucketInventoryAvailable ? (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title="Record-backed connectivity only"
                    >
                      {cleanChainJoinCount.toLocaleString()} record-backed
                      storage objects currently validate cleanly through Syfon
                      into Git, but the default bucket-first audit is blocked
                      because the mapped bucket target could not be enumerated.{' '}
                      Totals scanned:{' '}
                      {chainAuditResult.summary.bucketObjectCount.toLocaleString()}{' '}
                      probe-backed bucket objects,{' '}
                      {chainAuditResult.summary.syfonRecordCount.toLocaleString()}{' '}
                      Syfon records,{' '}
                      {chainAuditResult.summary.gitTrackedFileCount.toLocaleString()}{' '}
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
                      <div>
                        <Title order={5}>Chain Findings</Title>
                        <Text c="dimmed" mt={4} size="sm">
                          Issues found in the files, records, and project
                          contents for this path.
                        </Text>
                      </div>

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
                                {actionableChainSelectionIssue &&
                                selectedChainIssue?.id === issue.id ? (
                                  <Button
                                    color="gray"
                                    onClick={() =>
                                      handleToggleChainIssueDetails(issue.id)
                                    }
                                    size="xs"
                                    variant="outline"
                                  >
                                    Hide paths
                                  </Button>
                                ) : issue.id === 'bucket_only_object' ||
                                  issue.id === 'bucket_syfon_no_git' ? (
                                  <Button
                                    color={issue.color}
                                    onClick={() =>
                                      handleToggleChainIssueDetails(issue.id)
                                    }
                                    size="xs"
                                    variant="light"
                                  >
                                    Select paths
                                  </Button>
                                ) : (
                                  (() => {
                                    const findings = (
                                      chainAuditResult?.findings ?? []
                                    ).filter(
                                      (finding) => finding.kind === issue.id,
                                    );
                                    const supportsDeleteRecords =
                                      issue.id === 'syfon_git_no_bucket' ||
                                      issue.id ===
                                        'syfon_missing_bucket_object';
                                    const isShowingPaths =
                                      selectedChainIssue?.id === issue.id;
                                    return (
                                      <Group gap="xs">
                                        {supportsDeleteRecords ? (
                                          <Button
                                            color={issue.color}
                                            loading={
                                              isApplying ||
                                              isAuditing ||
                                              isChainAuditing ||
                                              isBulkDeletingRecords
                                            }
                                            onClick={() => {
                                              void runIssueAction({
                                                defaultAction: {
                                                  action: 'delete_records',
                                                  destructive: true,
                                                  label: 'Delete Syfon records',
                                                  requiresConfirmation: true,
                                                  supportsDryRun: false,
                                                },
                                                findings,
                                                issueId: issue.id,
                                                issueTitle: issue.title,
                                                paths: findings.map(
                                                  (finding) =>
                                                    finding.normalizedPath,
                                                ),
                                                source: 'chain',
                                              });
                                            }}
                                            size="xs"
                                            variant="light"
                                          >
                                            Delete Syfon records
                                          </Button>
                                        ) : null}
                                        <Button
                                          color="gray"
                                          onClick={() =>
                                            handleToggleChainIssueDetails(
                                              issue.id,
                                            )
                                          }
                                          size="xs"
                                          variant="outline"
                                        >
                                          {isShowingPaths
                                            ? 'Hide paths'
                                            : 'Show paths'}
                                        </Button>
                                      </Group>
                                    );
                                  })()
                                )}
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>

                      {selectedChainIssue && actionableChainSelectionIssue ? (
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
                                Choose the exact paths to act on in this issue
                                set.
                              </Text>
                            </div>
                            <Button
                              color={selectedChainIssue.color}
                              disabled={selectedChainPaths.length === 0}
                              loading={isApplying || isAuditing}
                              onClick={() => {
                                void handleApplySelectedChainObjects();
                              }}
                              size="xs"
                              variant="light"
                            >
                              {selectedChainIssue.id === 'bucket_only_object'
                                ? 'Delete selected bucket objects'
                                : 'Delete selected objects'}
                              {selectedChainPaths.length > 0
                                ? ` (${selectedChainPaths.length.toLocaleString()})`
                                : ''}
                            </Button>
                          </Group>

                          <Stack
                            className="rounded-md border border-slate-200 bg-white px-3 py-3"
                            gap="xs"
                          >
                            <Group justify="space-between" wrap="wrap">
                              <Checkbox
                                checked={
                                  selectableChainPaths.length > 0 &&
                                  selectedChainPaths.length ===
                                    selectableChainPaths.length
                                }
                                indeterminate={
                                  selectedChainPaths.length > 0 &&
                                  selectedChainPaths.length <
                                    selectableChainPaths.length
                                }
                                label={`Select all loaded paths (${selectedChainPaths.length.toLocaleString()} / ${selectableChainPaths.length.toLocaleString()})`}
                                onChange={(event) => {
                                  handleToggleAllChainPaths(
                                    event.currentTarget.checked,
                                  );
                                }}
                              />
                              <Text c="dimmed" size="xs">
                                Expand folders and choose the exact paths to
                                heal.
                              </Text>
                            </Group>
                            <Stack gap={4}>
                              {chainPathTree
                                .slice(0, treeNodeLimit[''] ?? 100)
                                .map((node) => renderChainTreeNode(node))}
                              {chainPathTree.length >
                                (treeNodeLimit[''] ?? 100) && (
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
                                    chainPathTree.length -
                                    (treeNodeLimit[''] ?? 100)
                                  ).toLocaleString()}{' '}
                                  remaining)...
                                </Button>
                              )}
                            </Stack>
                          </Stack>
                        </Stack>
                      ) : null}

                      {selectedChainIssue && !actionableChainSelectionIssue ? (
                        <Stack
                          className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4"
                          gap="sm"
                        >
                          <div>
                            <Text fw={700} size="sm">
                              {selectedChainIssue.title}
                            </Text>
                            <Text c="dimmed" size="sm">
                              {selectedChainFindings.length.toLocaleString()}{' '}
                              paths in this issue set.
                            </Text>
                          </div>
                          <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white">
                            <Table highlightOnHover stickyHeader>
                              <Table.Thead>
                                <Table.Tr>
                                  <Table.Th>Path</Table.Th>
                                  <Table.Th>Checksum</Table.Th>
                                  <Table.Th>Records</Table.Th>
                                  <Table.Th>Objects</Table.Th>
                                </Table.Tr>
                              </Table.Thead>
                              <Table.Tbody>
                                {selectedChainFindings.map((finding) => (
                                  <Table.Tr
                                    key={`${finding.kind}:${finding.normalizedPath}`}
                                  >
                                    <Table.Td maw={720}>
                                      <Text
                                        className="break-all"
                                        fw={600}
                                        size="sm"
                                      >
                                        {finding.normalizedPath}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td maw={320}>
                                      <Text
                                        className="break-all font-mono"
                                        size="xs"
                                      >
                                        {finding.checksum || '—'}
                                      </Text>
                                    </Table.Td>
                                    <Table.Td>
                                      {finding.recordCount.toLocaleString()}
                                    </Table.Td>
                                    <Table.Td>
                                      {finding.objectIds.length.toLocaleString()}
                                    </Table.Td>
                                  </Table.Tr>
                                ))}
                              </Table.Tbody>
                            </Table>
                          </div>
                        </Stack>
                      ) : null}
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
                        applyResult.dryRun
                          ? 'Cleanup dry run'
                          : 'Cleanup applied'
                      }
                    >
                      {buildCleanupApplySummary(applyResult)}
                    </Alert>
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
                              <Table.Th>Action</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {diffIssueSummaries.map((issue) => (
                              <Table.Tr key={issue.id}>
                                <Table.Td miw={520}>
                                  <Stack gap={4}>
                                    <Group gap={8}>
                                      <Badge
                                        color={issue.color}
                                        variant="light"
                                      >
                                        {issue.pathCount.toLocaleString()} paths
                                      </Badge>
                                      <Text fw={700} size="sm">
                                        {issue.title}
                                      </Text>
                                    </Group>
                                    <Text c="dimmed" size="sm">
                                      {issue.description}
                                    </Text>
                                    <Text size="sm">
                                      {issue.recommendation}
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
                                <Table.Td>
                                  {(() => {
                                    const findings = (
                                      diffAuditResult?.findings ?? []
                                    ).filter((finding) =>
                                      issue.findingKinds.includes(finding.kind),
                                    );
                                    const action = resolveIssueAction({
                                      defaultAction:
                                        issue.actionSummary.defaultAction,
                                      findings,
                                      issueId: issue.id,
                                    });
                                    return action ? (
                                      <Button
                                        color={issue.color}
                                        loading={isAuditing}
                                        onClick={() => {
                                          void runIssueAction({
                                            defaultAction: action,
                                            findings,
                                            issueId: issue.id,
                                            issueTitle: issue.title,
                                            paths: findings.map(
                                              (finding) =>
                                                finding.normalizedPath,
                                            ),
                                            source: 'diff',
                                          });
                                        }}
                                        size="xs"
                                        variant="light"
                                      >
                                        {action.label}
                                      </Button>
                                    ) : null;
                                  })()}
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>

                        {selectedDiffIssue ? (
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
                                  {selectedDiffFindings.length.toLocaleString()}{' '}
                                  paths in this issue set.
                                </Text>
                              </div>
                              <Button
                                onClick={() => setSelectedDiffIssueId(null)}
                                size="xs"
                                variant="subtle"
                              >
                                Hide paths
                              </Button>
                            </Group>

                            <div className="max-h-[420px] overflow-auto rounded-md border border-slate-200 bg-white">
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
                                  {selectedDiffFindings.map((finding) => (
                                    <Table.Tr
                                      key={`${finding.kind}:${finding.normalizedPath}`}
                                    >
                                      <Table.Td maw={720}>
                                        <Text
                                          className="break-all"
                                          fw={600}
                                          size="sm"
                                        >
                                          {finding.normalizedPath}
                                        </Text>
                                      </Table.Td>
                                      <Table.Td>
                                        <Badge
                                          color={issueColorForDiffKind(
                                            finding.kind,
                                          )}
                                          variant="light"
                                        >
                                          {formatCleanupFindingLabel(
                                            finding.kind,
                                          )}
                                        </Badge>
                                      </Table.Td>
                                      <Table.Td>
                                        {finding.recordCount.toLocaleString()}
                                      </Table.Td>
                                      <Table.Td>
                                        {finding.objectIds.length.toLocaleString()}
                                      </Table.Td>
                                      <Table.Td>
                                        {(
                                          finding.downloadCount ?? 0
                                        ).toLocaleString()}
                                      </Table.Td>
                                    </Table.Tr>
                                  ))}
                                </Table.Tbody>
                              </Table>
                            </div>
                          </Stack>
                        ) : null}
                      </Stack>
                    ) : (
                      <Alert
                        color="green"
                        icon={<IconAlertCircle size={16} />}
                        title="No project diff issues"
                      >
                        Git and Syfon are aligned for this subtree. No
                        duplicate, Syfon-only, or Git-only paths were returned.
                      </Alert>
                    )
                  ) : null}

                  {showCleanupDetails &&
                  auditResult &&
                  isDuplicateVerificationContext &&
                  !hasSafeDuplicateCleanup ? (
                    <Alert
                      color="yellow"
                      icon={<IconAlertCircle size={16} />}
                      title="No safe duplicate delete yet"
                    >
                      Syfon confirmed duplicate paths, but this verification
                      pass did not prove which sibling record is stale.
                    </Alert>
                  ) : null}

                  {auditResult && showCleanupDetails ? (
                    <Stack gap="sm">
                      <div>
                        <Title order={5}>Storage Verification</Title>
                        <Text c="dimmed" mt={4} size="sm">
                          Syfon verification results for the issue set you just
                          inspected.
                        </Text>
                      </div>

                      {hasCleanupFindings &&
                      cleanupIssueSummaries.length > 0 ? (
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
                                      <Badge
                                        color={issue.color}
                                        variant="light"
                                      >
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
                                  {(() => {
                                    const findings = (
                                      auditResult?.findings ?? []
                                    ).filter((finding) =>
                                      issue.findingKinds.includes(finding.kind),
                                    );
                                    const action = resolveIssueAction({
                                      defaultAction:
                                        issue.actionSummary.defaultAction,
                                      findings,
                                      issueId: issue.id,
                                    });
                                    return action ? (
                                      <Button
                                        color={issue.color}
                                        loading={isApplying}
                                        onClick={() => {
                                          void runIssueAction({
                                            defaultAction: action,
                                            findings,
                                            issueId: issue.id,
                                            issueTitle: issue.title,
                                            paths: findings.map(
                                              (finding) =>
                                                finding.normalizedPath,
                                            ),
                                            source: 'cleanup',
                                          });
                                        }}
                                        size="xs"
                                        variant="light"
                                      >
                                        {action.label}
                                      </Button>
                                    ) : null;
                                  })()}
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
                          {index === 1 &&
                          collapsedBreadcrumb.hiddenItems.length > 0 ? (
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
                                  {collapsedBreadcrumb.hiddenItems.map(
                                    (hiddenItem) => (
                                      <Menu.Item
                                        key={hiddenItem.path}
                                        onClick={() =>
                                          setCurrentPath(hiddenItem.path)
                                        }
                                      >
                                        {hiddenItem.label}
                                      </Menu.Item>
                                    ),
                                  )}
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
                    <Group
                      align="center"
                      className="shrink-0 justify-self-end"
                      gap="xs"
                      wrap="nowrap"
                    >
                      <Button
                        loading={isChainAuditing}
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
                          {renderStorageSortHeader(
                            'Downloads',
                            'downloadCount',
                          )}
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
                                      <span className="break-all">
                                        {row.name}
                                      </span>
                                    </div>
                                  </button>
                                ) : (
                                  <div className="flex items-start gap-2">
                                    <IconFile className="mt-0.5" size={16} />
                                    <div className="min-w-0">
                                      <span className="break-all">
                                        {row.name}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={
                                    row.type === 'directory' ? 'blue' : 'gray'
                                  }
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
                              <Table.Td>
                                {row.fileCount.toLocaleString()}
                              </Table.Td>
                              <Table.Td>
                                {row.downloadCount.toLocaleString()}
                              </Table.Td>
                              <Table.Td>
                                {formatTimestamp(row.lastDownload)}
                              </Table.Td>
                              <Table.Td>
                                {formatTimestamp(row.lastUpdated)}
                              </Table.Td>
                            </Table.Tr>
                          );
                        })
                      ) : (
                        <Table.Tr>
                          <Table.Td colSpan={7}>
                            <Text c="dimmed" py="xl" ta="center">
                              No files or directories were returned for this
                              path.
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
