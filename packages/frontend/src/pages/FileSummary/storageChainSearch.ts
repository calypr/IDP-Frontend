import type { ChainIssueSummary } from './storageIssueSummaries';
import type { StorageChainFinding } from './storageTypes';

export type StorageChainIssueSearchView = {
  readonly issue: ChainIssueSummary;
  readonly findings: Array<StorageChainFinding>;
  readonly matchedFindings: Array<StorageChainFinding>;
};

const findingSearchText = (finding: StorageChainFinding): string =>
  [
    finding.kind,
    finding.normalizedPath,
    finding.checksum,
    ...finding.sourcePaths,
    ...finding.objectIds,
    ...finding.accessUrls,
    finding.bucketObjectUrl,
    finding.resolvedBucket,
    finding.resolvedKey,
    finding.probeStatus,
    finding.errorKind,
    finding.error,
    finding.recommendedAction,
    finding.suggestedFix,
    finding.suggestedAction,
    finding.actionability,
    ...finding.availableActions.flatMap((action) => [
      action.action,
      action.label,
      action.description,
    ]),
    finding.evidence?.checksum,
    finding.evidence?.bucketEvaluation,
    ...(finding.evidence?.sourcePaths ?? []),
    ...(finding.evidence?.objectIds ?? []),
    ...(finding.evidence?.accessUrls ?? []),
    ...(finding.evidence?.bucketObjectUrls ?? []),
    ...(finding.evidence?.buckets ?? []),
    ...(finding.evidence?.keys ?? []),
    ...(finding.evidence?.probeStatuses ?? []),
    ...(finding.evidence?.validationStates ?? []),
    ...(finding.evidence?.errorKinds ?? []),
    ...(finding.evidence?.errors ?? []),
    ...finding.records.flatMap((record) => [
      record.objectId,
      record.normalizedPath,
      record.cleanupScope,
      ...record.accessUrls,
      record.status,
      record.error,
      record.lastUpdated,
      record.lastDownload,
      ...record.accessMethods.flatMap((method) => [
        method.accessId,
        method.type,
        method.url,
        ...method.headers,
      ]),
      ...record.accessProbes.flatMap((probe) => [
        probe.url,
        probe.provider,
        probe.bucket,
        probe.key,
        probe.path,
        probe.status,
        probe.error,
        probe.errorKind,
        probe.metaSha256,
        probe.etag,
        probe.lastModified,
        probe.validationStatus,
        ...probe.validationMismatches,
      ]),
    ]),
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n')
    .toLowerCase();

export const storageChainFindingMatchesQuery = (
  finding: StorageChainFinding,
  query: string,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  return findingSearchText(finding).includes(normalizedQuery);
};

export const buildStorageChainIssueSearchViews = ({
  auditFindings,
  chainIssueFindingsByKind,
  chainIssueSummaries,
  query,
}: {
  readonly auditFindings: Array<StorageChainFinding>;
  readonly chainIssueFindingsByKind: Record<string, Array<StorageChainFinding>>;
  readonly chainIssueSummaries: Array<ChainIssueSummary>;
  readonly query: string;
}): Array<StorageChainIssueSearchView> => {
  const isSearching = query.trim().length > 0;

  return chainIssueSummaries.flatMap((issue) => {
    const findings =
      chainIssueFindingsByKind[issue.id] ??
      auditFindings.filter((finding) => finding.kind === issue.id);
    const issueSearchText = [
      issue.id,
      issue.title,
      issue.description,
      issue.recommendation,
    ]
      .join('\n')
      .toLowerCase();
    const issueMatches = isSearching
      ? issueSearchText.includes(query.trim().toLowerCase())
      : false;
    const matchedFindings =
      isSearching && !issueMatches
        ? findings.filter((finding) =>
            storageChainFindingMatchesQuery(finding, query),
          )
        : findings;

    if (isSearching && matchedFindings.length === 0) {
      return [];
    }

    return [{ findings, issue, matchedFindings }];
  });
};
