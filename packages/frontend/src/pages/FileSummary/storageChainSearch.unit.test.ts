import type { StorageChainFinding } from './storageTypes';
import type { ChainIssueSummary } from './storageIssueSummaries';
import {
  buildStorageChainIssueSearchViews,
  storageChainFindingMatchesQuery,
} from './storageChainSearch';

const finding: StorageChainFinding = {
  accessUrls: ['https://storage.example.org/public/file.tsv'],
  actionability: 'manual review',
  availableActions: [
    {
      action: 'delete_record',
      description: 'Remove the stale Syfon record',
      destructive: true,
      label: 'Delete record',
      requiresConfirmation: true,
      supportsDryRun: false,
    },
  ],
  bucketObjectUrl: 's3://bucket-a/data/file.tsv',
  bucketSizeBytes: 42,
  checksum: 'sha256-deadbeef',
  defaultAction: 'delete_record',
  error: 'HEAD request returned 503',
  errorKind: 'storage_unavailable',
  evidence: {
    accessUrls: ['https://evidence.example.org/file.tsv'],
    bucketEvaluation: 'bucket mapping failed',
    bucketObjectUrls: ['s3://evidence-bucket/file.tsv'],
    buckets: ['evidence-bucket'],
    checksum: 'sha256-evidence',
    errorKinds: ['probe_timeout'],
    errors: ['connection refused'],
    keys: ['nested/file.tsv'],
    objectIds: ['evidence-object-1'],
    probeStatuses: ['timeout'],
    sourcePaths: ['evidence/source/file.tsv'],
    validationStates: ['mismatch'],
  },
  kind: 'probe_error',
  normalizedPath: 'data/file.tsv',
  objectIds: ['object-1'],
  probeStatus: 'error',
  recordCount: 1,
  records: [
    {
      accessMethods: [
        {
          accessId: 'signed-access',
          headers: ['X-Test-Header'],
          type: 'presigned',
          url: 'https://signed.example.org/file.tsv',
        },
      ],
      accessProbes: [
        {
          bucket: 'probe-bucket',
          error: 'probe credential rejected',
          errorKind: 'credential_error',
          etag: 'etag-1',
          exists: false,
          key: 'probe/file.tsv',
          lastModified: '2026-01-01',
          metaSha256: 'sha256-probe',
          path: '/probe/file.tsv',
          provider: 'rgw',
          sha256Match: false,
          sizeBytes: 42,
          sizeMatch: false,
          status: '403',
          url: 'https://probe.example.org/file.tsv',
          validationMismatches: ['checksum'],
          validationStatus: 'failed',
        },
      ],
      accessUrls: ['https://record.example.org/file.tsv'],
      cleanupScope: 'access_url',
      error: 'record access failed',
      lastDownload: '2026-02-01',
      lastUpdated: '2026-02-02',
      normalizedPath: 'data/file.tsv',
      objectId: 'record-object-1',
      sizeBytes: 42,
      status: 'broken',
    },
  ],
  recommendedAction: 'Retry storage verification',
  resolvedBucket: 'bucket-a',
  resolvedKey: 'data/file.tsv',
  sizeBytes: 42,
  sourcePaths: ['src/file.tsv'],
  suggestedAction: 'rerun_audit',
  suggestedFix: 'Repair the bucket credential',
  supportsDryRun: false,
};

describe('storageChainFindingMatchesQuery', () => {
  it.each([
    'PROBE_ERROR',
    'data/file.tsv',
    'SHA256-DEADBEEF',
    'src/file.tsv',
    'object-1',
    'storage.example.org',
    's3://bucket-a/data/file.tsv',
    'bucket-a',
    '503',
    'retry storage verification',
    'rerun_audit',
    'repair the bucket credential',
    'probe_timeout',
    'signed-access',
    'X-Test-Header',
    'credential_error',
    'probe-bucket',
  ])('matches searchable finding text %s', (query) => {
    expect(storageChainFindingMatchesQuery(finding, query)).toBe(true);
  });

  it('does not match unrelated text and treats an empty query as unfiltered', () => {
    expect(storageChainFindingMatchesQuery(finding, 'not-present')).toBe(false);
    expect(storageChainFindingMatchesQuery(finding, '  ')).toBe(true);
  });
});

describe('buildStorageChainIssueSearchViews', () => {
  const issue: ChainIssueSummary = {
    actionSummary: {
      availableActions: [],
      supportsDryRun: false,
    },
    color: 'orange',
    description: 'A mapped object is missing from storage.',
    findingCount: 1,
    id: 'probe_error',
    objectCount: 1,
    pathCount: 1,
    recommendation: 'Inspect the provider error.',
    recordCount: 1,
    title: 'Probe Error',
    totalBytes: 42,
  };

  it('matches both issue labels and nested finding values', () => {
    const byTitle = buildStorageChainIssueSearchViews({
      auditFindings: [finding],
      chainIssueFindingsByKind: {},
      chainIssueSummaries: [issue],
      query: 'probe error',
    });
    const byObjectId = buildStorageChainIssueSearchViews({
      auditFindings: [finding],
      chainIssueFindingsByKind: {},
      chainIssueSummaries: [issue],
      query: 'record-object-1',
    });

    expect(byTitle[0]?.matchedFindings).toEqual([finding]);
    expect(byObjectId[0]?.matchedFindings).toEqual([finding]);
  });

  it('removes issue groups with no matching returned findings', () => {
    expect(
      buildStorageChainIssueSearchViews({
        auditFindings: [finding],
        chainIssueFindingsByKind: {},
        chainIssueSummaries: [issue],
        query: 'not-present',
      }),
    ).toEqual([]);
  });
});
