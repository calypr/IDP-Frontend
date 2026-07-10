import type {
  AuditActionOption,
  ProjectDiffFinding,
  ProjectDiffFindingKind,
  StorageChainFinding,
  StorageChainFindingKind,
  StorageChainIssueGroup,
  StorageCleanupFinding,
  StorageCleanupFindingKind,
} from './hooks';

export type IssueActionSummary = {
  readonly actionability?: string;
  readonly availableActions: Array<AuditActionOption>;
  readonly defaultAction?: AuditActionOption;
  readonly supportsDryRun: boolean;
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

export const issueColorForDiffKind = (kind: ProjectDiffFindingKind): string => {
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

export type ProjectDiffIssueSummary = {
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

export const summarizeProjectDiffIssues = (
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

export type CleanupIssueSummary = {
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

export const summarizeCleanupIssues = (
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
        bucketCount: buckets.size,
        color: group.color,
        description: group.description,
        findingKinds: group.findingKinds,
        id: group.id,
        objectCount: objects.size,
        pathCount: paths.size,
        recommendation: group.recommendation,
        recordCount,
        sampleBuckets: Array.from(buckets).sort().slice(0, 3),
        title: group.title,
        totalBytes,
      };
    })
    .filter((item): item is CleanupIssueSummary => item !== null);
};

type ChainIssueKind = Exclude<StorageChainFindingKind, 'unknown'>;

export type ChainIssueSummary = {
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
      'Git and Syfon map to a bucket object, but checksum or size evidence does not agree.',
    recommendation:
      'Recompute or verify the bucket SHA-256 and reconcile the stale side manually; deletion is intentionally disabled.',
    actionLabel: 'Show mismatches',
  },
  {
    id: 'probe_error',
    title: 'Probe Error',
    color: 'red',
    description:
      'Bucket verification failed before Gecko could classify the chain cleanly.',
    recommendation:
      'Review the paths, then delete the affected Syfon records if they are unwanted remnants.',
    actionLabel: 'Delete Syfon records',
  },
];

export const summarizeStorageChainIssues = ({
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
                  action: 'delete_syfon_record',
                  destructive: true,
                  label: 'Delete Syfon records',
                  requiresConfirmation: true,
                  supportsDryRun: true,
                }
              : definition.id === 'syfon_broken_bucket_mapping'
                ? {
                    action: 'remove_broken_access_urls',
                    destructive: true,
                    label: 'Repair access URLs',
                    requiresConfirmation: true,
                    supportsDryRun: true,
                  }
                : definition.id === 'probe_error'
                  ? {
                      action: 'delete_syfon_record',
                      destructive: true,
                      label: 'Delete Syfon records',
                      requiresConfirmation: true,
                      supportsDryRun: true,
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
