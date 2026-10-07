export type ProjectDiffFindingKind =
  | 'duplicate_syfon_paths'
  | 'syfon_missing_in_repo'
  | 'repo_missing_in_syfon'
  | 'unknown';

export interface AuditActionOption {
  readonly action: string;
  readonly label: string;
  readonly description?: string;
  readonly destructive: boolean;
  readonly requiresConfirmation: boolean;
  readonly supportsDryRun: boolean;
}

export interface ProjectDiffFinding {
  readonly kind: ProjectDiffFindingKind;
  readonly normalizedPath: string;
  readonly sourcePaths: Array<string>;
  readonly objectIds: Array<string>;
  readonly recordCount: number;
  readonly sizeBytes?: number;
  readonly downloadCount?: number;
  readonly lastDownload?: string;
  readonly recommendedAction: string;
  readonly actionability?: string;
  readonly availableActions: Array<AuditActionOption>;
  readonly defaultAction?: string;
  readonly supportsDryRun: boolean;
}

export interface ProjectDiffSummary {
  readonly countsByKind: Record<ProjectDiffFindingKind, number>;
  readonly totalFindings: number;
  readonly indexedPathCount: number;
  readonly expectedPathCount: number;
  readonly matchedPathCount: number;
  readonly includesRepoManifest: boolean;
  readonly scannedRecordCount: number;
}

export interface ProjectDiffAuditResult {
  readonly findings: Array<ProjectDiffFinding>;
  readonly summary: ProjectDiffSummary;
  readonly pathPrefix: string;
}

export interface AuditEvidence {
  readonly checksum?: string;
  readonly sourcePaths: Array<string>;
  readonly objectIds: Array<string>;
  readonly accessUrls: Array<string>;
  readonly bucketObjectUrls: Array<string>;
  readonly buckets: Array<string>;
  readonly keys: Array<string>;
  readonly probeStatuses: Array<string>;
  readonly validationStates: Array<string>;
  readonly errorKinds: Array<string>;
  readonly errors: Array<string>;
  readonly bucketEvaluation?: string;
}

export type StorageChainFindingKind =
  | 'bucket_only_object'
  | 'bucket_syfon_no_git'
  | 'syfon_broken_bucket_mapping'
  | 'syfon_missing_bucket_object'
  | 'syfon_git_no_bucket'
  | 'git_only_no_syfon'
  | 'git_syfon_metadata_mismatch'
  | 'probe_error'
  | 'unknown';

export interface StorageChainFinding {
  readonly kind: StorageChainFindingKind;
  readonly normalizedPath: string;
  readonly checksum?: string;
  readonly sourcePaths: Array<string>;
  readonly objectIds: Array<string>;
  readonly records: Array<StorageCleanupRecordAudit>;
  readonly accessUrls: Array<string>;
  readonly bucketObjectUrl?: string;
  readonly resolvedBucket?: string;
  readonly resolvedKey?: string;
  readonly probeStatus?: string;
  readonly errorKind?: string;
  readonly error?: string;
  readonly recordCount: number;
  readonly sizeBytes?: number;
  readonly bucketSizeBytes?: number;
  readonly recommendedAction: string;
  readonly suggestedFix?: string;
  readonly suggestedAction?: string;
  readonly evidence?: AuditEvidence;
  readonly actionability?: string;
  readonly availableActions: Array<AuditActionOption>;
  readonly defaultAction?: string;
  readonly supportsDryRun: boolean;
}

export interface StorageChainAuditSummary {
  readonly countsByKind: Record<string, number>;
  readonly findingLimit?: number;
  readonly returnedFindings: number;
  readonly totalFindings: number;
  readonly bucketObjectCount: number;
  readonly syfonRecordCount: number;
  readonly gitTrackedFileCount: number;
  readonly gitRevision?: string;
  readonly bucketInventoryAvailable: boolean;
  readonly bucketInventoryError?: string;
  readonly auditCacheHit?: boolean;
  readonly auditCachedAt?: string;
  readonly auditCacheAgeSeconds?: number;
  readonly auditRefreshDurationMs?: number;
  readonly auditCacheSource?: string;
  readonly auditCacheError?: string;
}

export interface GitOnlySyfonRegistrationResult {
  readonly normalizedPath: string;
  readonly checksum?: string;
  readonly gitSizeBytes?: number;
  readonly bucketObjectUrl?: string;
  readonly bucketSizeBytes?: number;
  readonly status: 'created' | 'eligible' | 'skipped' | string;
  readonly reason?: string;
  readonly objectId?: string;
}

export interface GitOnlySyfonRegistrationResponse {
  readonly gitRevision: string;
  readonly results: Array<GitOnlySyfonRegistrationResult>;
}

export interface StorageChainIssueGroup {
  readonly kind: string;
  readonly findingCount: number;
  readonly pathCount: number;
  readonly recordCount: number;
  readonly objectCount: number;
  readonly totalBytes: number;
}

export interface StorageChainAuditResult {
  readonly auditId?: string;
  readonly findings: Array<StorageChainFinding>;
  readonly groups: Array<StorageChainIssueGroup>;
  readonly summary: StorageChainAuditSummary;
  readonly pathPrefix: string;
  readonly bucketPathPrefix?: string;
}

export type StorageCleanupFindingKind =
  | 'stale_duplicate_record'
  | 'live_duplicate_conflict'
  | 'broken_access_url_error'
  | 'broken_bucket_mapping'
  | 'bucket_only_object'
  | 'repo_orphan_live_object'
  | 'repo_orphan_stale_record'
  | 'storage_object_missing'
  | 'storage_validation_mismatch'
  | 'storage_probe_error'
  | 'unknown';

export type StorageCleanupScope =
  | 'record'
  | 'access_url'
  | 'bucket_object'
  | 'unknown';

export interface StorageCleanupAccessProbe {
  readonly url: string;
  readonly operation?: string;
  readonly provider?: string;
  readonly bucket?: string;
  readonly key?: string;
  readonly path?: string;
  readonly exists?: boolean;
  readonly status?: string;
  readonly error?: string;
  readonly errorKind?: string;
  readonly sizeBytes?: number;
  readonly metaSha256?: string;
  readonly etag?: string;
  readonly lastModified?: string;
  readonly validationStatus?: string;
  readonly sizeMatch?: boolean;
  readonly sha256Match?: boolean;
  readonly validationMismatches: Array<string>;
}

export interface StorageCleanupAccessMethod {
  readonly accessId?: string;
  readonly type?: string;
  readonly url?: string;
  readonly headers: Array<string>;
}

export interface StorageCleanupRecordAudit {
  readonly objectId: string;
  readonly normalizedPath?: string;
  readonly cleanupScope: StorageCleanupScope;
  readonly accessUrls: Array<string>;
  readonly accessMethods: Array<StorageCleanupAccessMethod>;
  readonly accessProbes: Array<StorageCleanupAccessProbe>;
  readonly status?: string;
  readonly error?: string;
  readonly sizeBytes?: number;
  readonly lastUpdated?: string;
  readonly downloadCount?: number;
  readonly lastDownload?: string;
}

export interface StorageCleanupFinding {
  readonly kind: StorageCleanupFindingKind;
  readonly normalizedPath: string;
  readonly objectIds: Array<string>;
  readonly records: Array<StorageCleanupRecordAudit>;
  readonly accessUrls: Array<string>;
  readonly recommendedAction: string;
  readonly repoDeleteCandidate: boolean;
  readonly cleanupScope: StorageCleanupScope;
  readonly sizeBytes?: number;
  readonly lastUpdated?: string;
  readonly downloadCount?: number;
  readonly lastDownload?: string;
  readonly actionability?: string;
  readonly availableActions: Array<AuditActionOption>;
  readonly defaultAction?: string;
  readonly supportsDryRun: boolean;
  readonly evidence?: AuditEvidence;
}

export interface StorageCleanupAuditSummary {
  readonly countsByKind: Record<StorageCleanupFindingKind, number>;
  readonly totalFindings: number;
  readonly manualFindingCount: number;
  readonly repoDeleteCandidateCount: number;
  readonly staleDuplicateCount: number;
  readonly repoOrphanCount: number;
}

export interface StorageCleanupAuditResult {
  readonly findings: Array<StorageCleanupFinding>;
  readonly summary: StorageCleanupAuditSummary;
  readonly expectedPathCount: number;
  readonly includesRepoManifest: boolean;
  readonly pathPrefix: string;
}

export interface StorageCleanupPurgeResult {
  readonly objectId: string;
  readonly success: boolean | null;
  readonly status?: string;
  readonly error?: string;
}

export interface StorageApplyActionRequest {
  readonly kind: string;
  readonly normalized_path: string;
  readonly action: string;
}

export interface StorageApplyFindingRequest {
  readonly kind: string;
  readonly normalized_path: string;
  readonly object_ids?: Array<string>;
  readonly records?: Array<{
    readonly object_id: string;
    readonly normalized_path?: string;
    readonly cleanup_scope: string;
    readonly access_urls?: Array<string>;
    readonly access_methods?: Array<{
      readonly access_id?: string;
      readonly type?: string;
      readonly url?: string;
      readonly headers?: Array<string>;
    }>;
    readonly access_probes?: Array<{
      readonly url: string;
      readonly operation?: string;
      readonly provider?: string;
      readonly bucket?: string;
      readonly key?: string;
      readonly path?: string;
      readonly exists?: boolean;
      readonly status?: string;
      readonly error_kind?: string;
      readonly error?: string;
      readonly size_bytes?: number;
      readonly meta_sha256?: string;
      readonly etag?: string;
      readonly last_modified?: string;
      readonly validation_status?: string;
      readonly size_match?: boolean;
      readonly sha256_match?: boolean;
      readonly validation_mismatches?: Array<string>;
    }>;
  }>;
  readonly bucket_object_url?: string;
  readonly bucket_object_urls?: Array<string>;
  readonly access_urls?: Array<string>;
  readonly available_actions?: Array<string>;
  readonly default_action?: string;
  readonly suggested_action?: string;
  readonly evidence?: {
    readonly object_ids?: Array<string>;
    readonly access_urls?: Array<string>;
    readonly bucket_object_urls?: Array<string>;
    readonly source_paths?: Array<string>;
  };
}

export interface StorageCleanupApplyResult {
  readonly deletedRecordIds: Array<string>;
  readonly deletedBucketObjectUrls: Array<string>;
  readonly updatedRecordIds: Array<string>;
  readonly purgeResults: Array<StorageCleanupPurgeResult>;
  readonly repoDeletePaths: Array<string>;
  readonly manualPaths: Array<string>;
  readonly skippedPaths: Array<string>;
  readonly dryRun: boolean;
}
