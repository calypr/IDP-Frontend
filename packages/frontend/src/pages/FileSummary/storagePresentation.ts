import type {
  AuditActionOption,
  ProjectDiffFinding,
  StorageChainFinding,
  StorageCleanupApplyResult,
  StorageCleanupFinding,
} from './hooks';
import type { StoragePathRow } from './storageUtils';

export const formatTimestamp = (value?: string): string => {
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

export const buildCleanupApplySummary = (
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

export const getPathSegments = (path: string): Array<string> =>
  path.split('/').filter(Boolean);

export type BreadcrumbItem = {
  readonly label: string;
  readonly path: string;
};

export type StorageSortKey =
  | 'name'
  | 'type'
  | 'sizeBytes'
  | 'fileCount'
  | 'downloadCount'
  | 'lastDownload'
  | 'lastUpdated';

export type StorageSortDirection = 'asc' | 'desc';

export type ActionIssueSource = 'chain' | 'cleanup' | 'diff';

export type ActionableFinding =
  ProjectDiffFinding | StorageCleanupFinding | StorageChainFinding;

export const resolveProjectSelection = ({
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

const repairActionRank = (action: string): number => {
  const order = [
    'remove_broken_access_urls',
    'delete_syfon_record',
    'delete_records',
    'delete_bucket_object',
    'delete_both',
  ];
  const index = order.indexOf(action);
  return index >= 0 ? index : order.length;
};

export const isInspectAction = (action: string): boolean =>
  action === 'view_paths' || action === 'inspect_evidence';

const isRepairAction = (action: AuditActionOption): boolean =>
  !isInspectAction(action.action) && action.action !== 'rerun_audit';

export const orderedRepairActions = (
  actions: Array<AuditActionOption>,
): Array<AuditActionOption> =>
  actions
    .filter(isRepairAction)
    .sort(
      (left, right) =>
        repairActionRank(left.action) - repairActionRank(right.action),
    );

export const resolveIssueAction = ({
  defaultAction,
  findings,
}: {
  defaultAction?: AuditActionOption;
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

  return null;
};

export const formatCleanupFindingLabel = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');

const compareOptionalDates = (left?: string, right?: string): number => {
  const leftTime = left ? new Date(left).getTime() : Number.NaN;
  const rightTime = right ? new Date(right).getTime() : Number.NaN;
  const normalizedLeft = Number.isNaN(leftTime) ? -Infinity : leftTime;
  const normalizedRight = Number.isNaN(rightTime) ? -Infinity : rightTime;
  return normalizedLeft - normalizedRight;
};

export const sortStorageRowsBy = (
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
        return (
          (left.downloadCount ?? -Infinity) - (right.downloadCount ?? -Infinity)
        );
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
