import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CoreState,
  GEN3_API,
  selectCSRFToken,
  useCoreSelector,
  useGetCSRFQuery,
  useGetGeckoProjectSummaryQuery,
} from '@gen3/core';
import type { FilesummaryConfig } from './types';
import {
  buildProjectOptions,
  normalizeStoragePath,
  splitProjectSelectionValue,
  sortStorageRows,
  type ProjectStorageOption,
  type StoragePathRow,
  type StoragePathSummary,
} from './storageUtils';
import { requestSessionLogout } from '../../lib/session/session';

const DEFAULT_CHILD_LIMIT = 1000;

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
  readonly accessUrls: Array<string>;
  readonly bucketObjectUrl?: string;
  readonly resolvedBucket?: string;
  readonly resolvedKey?: string;
  readonly probeStatus?: string;
  readonly errorKind?: string;
  readonly error?: string;
  readonly recordCount: number;
  readonly sizeBytes?: number;
  readonly recommendedAction: string;
  readonly evidence?: AuditEvidence;
  readonly actionability?: string;
  readonly availableActions: Array<AuditActionOption>;
  readonly defaultAction?: string;
  readonly supportsDryRun: boolean;
}

export interface StorageChainAuditSummary {
  readonly countsByKind: Record<string, number>;
  readonly totalFindings: number;
  readonly bucketObjectCount: number;
  readonly syfonRecordCount: number;
  readonly gitTrackedFileCount: number;
  readonly bucketInventoryAvailable: boolean;
  readonly bucketInventoryError?: string;
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

export interface StorageCleanupRecordAudit {
  readonly objectId: string;
  readonly normalizedPath?: string;
  readonly cleanupScope: StorageCleanupScope;
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

interface StorageSummaryResponse {
  direct_child_count?: number;
  download_count?: number;
  duplicate_path_count?: number;
  file_count?: number;
  last_download_time?: string;
  latest_update_time?: string;
  path?: string;
  record_count?: number;
  total_bytes?: number;
}

interface StorageChildResponseItem {
  download_count?: number;
  file_count?: number;
  last_download_time?: string;
  latest_update_time?: string;
  name?: string;
  path?: string;
  record_count?: number;
  total_bytes?: number;
  type?: 'directory' | 'file';
}

interface StorageChildrenResponse {
  items?: Array<StorageChildResponseItem>;
}

const buildGeckoGitProjectBaseUrl = ({
  organization,
  project,
}: {
  organization: string;
  project: string;
}): string =>
  `${GEN3_API}/gecko/git/projects/${encodeURIComponent(
    organization.trim(),
  )}/${encodeURIComponent(project.trim())}`;

const buildStorageSummaryUrl = ({
  organization,
  path,
  project,
}: {
  organization: string;
  path?: string;
  project: string;
}): string => {
  const query = new URLSearchParams();
  const normalizedPath = normalizeStoragePath(path);

  if (normalizedPath) {
    query.set('git_subpath', normalizedPath);
  }

  const querySuffix = query.toString() ? `?${query.toString()}` : '';
  return `${buildGeckoGitProjectBaseUrl({
    organization,
    project,
  })}/storage/summary${querySuffix}`;
};

const buildStorageChildrenUrl = ({
  limit,
  organization,
  path,
  project,
}: {
  limit: number;
  organization: string;
  path?: string;
  project: string;
}): string => {
  const query = new URLSearchParams({
    limit: String(limit),
    sort_by: 'bytes',
    sort_order: 'desc',
  });
  const normalizedPath = normalizeStoragePath(path);

  if (normalizedPath) {
    query.set('git_subpath', normalizedPath);
  }

  return `${buildGeckoGitProjectBaseUrl({
    organization,
    project,
  })}/storage/children?${query.toString()}`;
};

const buildStorageCleanupUrl = ({
  action,
  organization,
  project,
}: {
  action: 'apply' | 'audit';
  organization: string;
  project: string;
}): string =>
  `${buildGeckoGitProjectBaseUrl({
    organization,
    project,
  })}/repair/storage-cleanup/${action}`;

const buildProjectDiffUrl = ({
  organization,
  project,
}: {
  organization: string;
  project: string;
}): string =>
  `${buildGeckoGitProjectBaseUrl({
    organization,
    project,
  })}/repair/project-diff/audit`;

const buildStorageChainUrl = ({
  organization,
  project,
}: {
  organization: string;
  project: string;
}): string =>
  `${buildGeckoGitProjectBaseUrl({
    organization,
    project,
  })}/repair/storage-chain/audit`;

const emptyCleanupCounts = (): Record<StorageCleanupFindingKind, number> => ({
  broken_access_url_error: 0,
  broken_bucket_mapping: 0,
  bucket_only_object: 0,
  live_duplicate_conflict: 0,
  repo_orphan_live_object: 0,
  repo_orphan_stale_record: 0,
  stale_duplicate_record: 0,
  storage_object_missing: 0,
  storage_probe_error: 0,
  storage_validation_mismatch: 0,
  unknown: 0,
});

const emptyProjectDiffCounts = (): Record<ProjectDiffFindingKind, number> => ({
  duplicate_syfon_paths: 0,
  repo_missing_in_syfon: 0,
  syfon_missing_in_repo: 0,
  unknown: 0,
});

const emptyStorageChainCounts = (): Record<string, number> => ({
  bucket_only_object: 0,
  bucket_syfon_git_complete: 0,
  bucket_syfon_no_git: 0,
  git_only_no_syfon: 0,
  git_syfon_metadata_mismatch: 0,
  probe_error: 0,
  syfon_broken_bucket_mapping: 0,
  syfon_git_no_bucket: 0,
  syfon_missing_bucket_object: 0,
  unknown: 0,
});

const normalizeAuditEvidence = (
  item: Record<string, unknown> | null | undefined,
): AuditEvidence | undefined => {
  if (!item) {
    return undefined;
  }

  return {
    accessUrls: toStringArray(item.access_urls),
    bucketEvaluation:
      typeof item.bucket_evaluation === 'string'
        ? item.bucket_evaluation
        : undefined,
    bucketObjectUrls: toStringArray(item.bucket_object_urls),
    buckets: toStringArray(item.buckets),
    checksum:
      typeof item.checksum === 'string' ? item.checksum : undefined,
    errorKinds: toStringArray(item.error_kinds),
    errors: toStringArray(item.errors),
    keys: toStringArray(item.keys),
    objectIds: toStringArray(item.object_ids),
    probeStatuses: toStringArray(item.probe_statuses),
    sourcePaths: toStringArray(item.source_paths),
    validationStates: toStringArray(item.validation_states),
  };
};

const readJsonResponse = async <T,>(response: Response): Promise<T | null> => {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

const handleUnauthorizedResponse = (response: Response): boolean => {
  if (response.status !== 401) {
    return false;
  }

  requestSessionLogout();
  return true;
};

const isUnauthorizedMutationError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'status' in error &&
      (error as { status?: unknown }).status === 401,
  );

const getErrorMessage = async (
  response: Response,
  fallback: string,
): Promise<string> => {
  const body = await readJsonResponse<Record<string, unknown>>(response);
  const fromBody =
    typeof body?.message === 'string'
      ? body.message
      : typeof body?.error === 'string'
        ? body.error
        : typeof body?.detail === 'string'
          ? body.detail
          : null;

  return fromBody ? `${fallback}: ${fromBody}` : fallback;
};

const toStringArray = (value: unknown): Array<string> => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
};

const normalizeAuditActionOption = (
  item: unknown,
): AuditActionOption | null => {
  if (typeof item === 'string') {
    const action = item.trim();
    if (!action) {
      return null;
    }

    return {
      action,
      destructive: false,
      label: action
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (value) => value.toUpperCase()),
      requiresConfirmation: false,
      supportsDryRun: false,
    };
  }

  if (!item || typeof item !== 'object') {
    return null;
  }

  const record = item as Record<string, unknown>;
  const actionValue =
    typeof record.action === 'string'
      ? record.action.trim()
      : typeof record.kind === 'string'
        ? record.kind.trim()
        : typeof record.id === 'string'
          ? record.id.trim()
          : '';

  if (!actionValue) {
    return null;
  }

  const labelValue =
    typeof record.label === 'string'
      ? record.label.trim()
      : typeof record.title === 'string'
        ? record.title.trim()
        : typeof record.display_name === 'string'
          ? record.display_name.trim()
          : '';

  return {
    action: actionValue,
    description:
      typeof record.description === 'string'
        ? record.description
        : typeof record.help_text === 'string'
          ? record.help_text
          : undefined,
    destructive:
      typeof record.destructive === 'boolean'
        ? record.destructive
        : typeof record.is_destructive === 'boolean'
          ? record.is_destructive
          : false,
    label:
      labelValue ||
      actionValue
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (value) => value.toUpperCase()),
    requiresConfirmation:
      typeof record.requires_confirmation === 'boolean'
        ? record.requires_confirmation
        : typeof record.requiresConfirmation === 'boolean'
          ? record.requiresConfirmation
          : false,
    supportsDryRun:
      typeof record.supports_dry_run === 'boolean'
        ? record.supports_dry_run
        : typeof record.supportsDryRun === 'boolean'
          ? record.supportsDryRun
          : false,
  };
};

const normalizeAvailableActions = (
  item: Record<string, unknown>,
): Array<AuditActionOption> => {
  const rawActions = Array.isArray(item.available_actions)
    ? item.available_actions
    : Array.isArray(item.availableActions)
      ? item.availableActions
      : [];

  const normalized = rawActions
    .map((action) => normalizeAuditActionOption(action))
    .filter((action): action is AuditActionOption => action !== null);

  return Array.from(
    new Map(normalized.map((action) => [action.action, action])).values(),
  );
};

const normalizeDefaultAction = (
  item: Record<string, unknown>,
): string | undefined => {
  if (typeof item.default_action === 'string' && item.default_action.trim()) {
    return item.default_action.trim();
  }
  if (typeof item.defaultAction === 'string' && item.defaultAction.trim()) {
    return item.defaultAction.trim();
  }

  const defaultActionRecord =
    item.default_action && typeof item.default_action === 'object'
      ? normalizeAuditActionOption(item.default_action)
      : item.defaultAction && typeof item.defaultAction === 'object'
        ? normalizeAuditActionOption(item.defaultAction)
        : null;

  return defaultActionRecord?.action;
};

const parseCleanupFindingKind = (
  value: unknown,
): StorageCleanupFindingKind => {
  switch (value) {
    case 'stale_duplicate_record':
    case 'live_duplicate_conflict':
    case 'broken_access_url_error':
    case 'broken_bucket_mapping':
    case 'bucket_only_object':
    case 'repo_orphan_live_object':
    case 'repo_orphan_stale_record':
    case 'storage_object_missing':
    case 'storage_probe_error':
    case 'storage_validation_mismatch':
      return value;
    default:
      return 'unknown';
  }
};

const parseProjectDiffFindingKind = (
  value: unknown,
): ProjectDiffFindingKind => {
  switch (value) {
    case 'duplicate_syfon_paths':
    case 'syfon_missing_in_repo':
    case 'repo_missing_in_syfon':
      return value;
    default:
      return 'unknown';
  }
};

const parseStorageChainFindingKind = (
  value: unknown,
): StorageChainFindingKind => {
  switch (value) {
    case 'bucket_only_object':
    case 'bucket_syfon_no_git':
    case 'syfon_broken_bucket_mapping':
    case 'syfon_missing_bucket_object':
    case 'syfon_git_no_bucket':
    case 'git_only_no_syfon':
    case 'git_syfon_metadata_mismatch':
    case 'probe_error':
      return value;
    default:
      return 'unknown';
  }
};

const normalizeStorageRow = (
  item: StorageChildResponseItem,
): StoragePathRow | null => {
  const path = item.path?.trim();
  const type = item.type;

  if (!path || (type !== 'directory' && type !== 'file')) {
    return null;
  }

  return {
    downloadCount: item.download_count ?? 0,
    fileCount: item.file_count ?? 0,
    lastDownload: item.last_download_time,
    lastUpdated: item.latest_update_time,
    name: item.name?.trim() || path.split('/').filter(Boolean).pop() || path,
    path,
    recordCount: item.record_count ?? 0,
    sizeBytes: item.total_bytes ?? 0,
    type,
  };
};

const parseCleanupScope = (value: unknown): StorageCleanupScope => {
  switch (value) {
    case 'record':
    case 'access_url':
    case 'bucket_object':
      return value;
    default:
      return 'unknown';
  }
};

const normalizeCleanupAccessProbe = (
  record: Record<string, unknown>,
): StorageCleanupAccessProbe | null => {
  const url =
    typeof record.url === 'string'
      ? record.url.trim()
      : typeof record.object_url === 'string'
        ? record.object_url.trim()
        : '';

  if (!url) {
    return null;
  }

  return {
    bucket:
      typeof record.bucket === 'string' ? record.bucket : undefined,
    etag:
      typeof record.etag === 'string' ? record.etag : undefined,
    error:
      typeof record.storage_message === 'string'
        ? record.storage_message
        : typeof record.error === 'string'
          ? record.error
          : undefined,
    errorKind:
      typeof record.error_kind === 'string' ? record.error_kind : undefined,
    exists:
      typeof record.exists === 'boolean' ? record.exists : undefined,
    key:
      typeof record.key === 'string' ? record.key : undefined,
    lastModified:
      typeof record.last_modified === 'string'
        ? record.last_modified
        : undefined,
    metaSha256:
      typeof record.meta_sha256 === 'string'
        ? record.meta_sha256
        : undefined,
    path:
      typeof record.path === 'string' ? record.path : undefined,
    provider:
      typeof record.provider === 'string' ? record.provider : undefined,
    sha256Match:
      typeof record.sha256_match === 'boolean'
        ? record.sha256_match
        : undefined,
    sizeBytes:
      typeof record.size_bytes === 'number' ? record.size_bytes : undefined,
    sizeMatch:
      typeof record.size_match === 'boolean'
        ? record.size_match
        : undefined,
    status:
      typeof record.storage_status === 'string'
        ? record.storage_status
        : typeof record.status === 'string'
          ? record.status
          : undefined,
    validationMismatches: toStringArray(record.validation_mismatches),
    validationStatus:
      typeof record.validation_status === 'string'
        ? record.validation_status
        : undefined,
    url,
  };
};

const normalizeCleanupRecordAudit = (
  item: Record<string, unknown>,
): StorageCleanupRecordAudit | null => {
  const objectId =
    typeof item.object_id === 'string'
      ? item.object_id.trim()
      : typeof item.objectId === 'string'
        ? item.objectId.trim()
        : typeof item.id === 'string'
          ? item.id.trim()
          : '';
  if (!objectId) {
    return null;
  }

  const accessProbeItems = Array.isArray(item.access_probes)
    ? item.access_probes
    : Array.isArray(item.access_urls)
      ? item.access_urls.map((url) => ({ url }))
      : [];
  const accessProbes = accessProbeItems
    .map((probe) =>
      probe && typeof probe === 'object'
        ? normalizeCleanupAccessProbe(probe as Record<string, unknown>)
        : null,
    )
    .filter((probe): probe is StorageCleanupAccessProbe => probe !== null);

  return {
    accessProbes,
    cleanupScope: parseCleanupScope(item.cleanup_scope),
    downloadCount:
      typeof item.download_count === 'number'
        ? item.download_count
        : typeof item.downloadCount === 'number'
          ? item.downloadCount
          : undefined,
    error:
      typeof item.storage_message === 'string'
        ? item.storage_message
        : typeof item.error === 'string'
          ? item.error
          : undefined,
    lastDownload:
      typeof item.last_download_time === 'string'
        ? item.last_download_time
        : typeof item.lastDownload === 'string'
          ? item.lastDownload
          : undefined,
    lastUpdated:
      typeof item.updated_time === 'string'
        ? item.updated_time
        : typeof item.latest_update_time === 'string'
          ? item.latest_update_time
          : typeof item.last_updated === 'string'
            ? item.last_updated
            : undefined,
    normalizedPath:
      typeof item.normalized_path === 'string' ? item.normalized_path : undefined,
    objectId,
    sizeBytes:
      typeof item.size === 'number'
        ? item.size
        : typeof item.total_bytes === 'number'
          ? item.total_bytes
          : undefined,
    status:
      typeof item.storage_status === 'string'
        ? item.storage_status
        : typeof item.status === 'string'
          ? item.status
          : undefined,
  };
};

const normalizeCleanupFinding = (
  item: Record<string, unknown>,
): StorageCleanupFinding | null => {
  const normalizedPath = normalizeStoragePath(
    typeof item.normalized_path === 'string'
      ? item.normalized_path
      : typeof item.path === 'string'
        ? item.path
        : '',
  );

  if (!normalizedPath) {
    return null;
  }

  const recordItems = Array.isArray(item.records) ? item.records : [];
  const records = recordItems
    .map((record) =>
      record && typeof record === 'object'
        ? normalizeCleanupRecordAudit(record as Record<string, unknown>)
        : null,
    )
    .filter((record): record is StorageCleanupRecordAudit => record !== null);
  const objectIds = Array.from(
    new Set([
      ...toStringArray(item.object_ids),
      ...toStringArray(item.objectIds),
      ...records.map((record) => record.objectId),
    ]),
  );
  const kind = parseCleanupFindingKind(item.kind ?? item.finding_kind);
  const availableActions = normalizeAvailableActions(item);
  const defaultAction = normalizeDefaultAction(item);
  const defaultRecommendation =
    kind === 'stale_duplicate_record'
      ? 'Delete stale duplicate records'
      : kind === 'broken_access_url_error'
        ? 'Manual review required for broken access URLs'
        : kind === 'broken_bucket_mapping'
          ? 'Fix or remove the Syfon access URL because no bucket mapping is configured for it.'
          : kind === 'bucket_only_object'
            ? 'Review and delete bucket object that has no Syfon record.'
        : kind === 'repo_orphan_live_object'
          ? 'Delete Syfon record and purge storage object'
        : kind === 'repo_orphan_stale_record'
          ? 'Delete stale Syfon record'
          : kind === 'storage_object_missing'
            ? 'Bucket object is missing from storage.'
            : kind === 'storage_validation_mismatch'
              ? 'Bucket object metadata does not match the Syfon record.'
          : kind === 'storage_probe_error'
            ? 'Retry once storage probing is healthy'
            : 'Manual review required';

  return {
    actionability:
      typeof item.actionability === 'string' ? item.actionability : undefined,
    availableActions,
    downloadCount:
      typeof item.download_count === 'number'
        ? item.download_count
        : typeof item.downloadCount === 'number'
          ? item.downloadCount
          : undefined,
    kind,
    lastDownload:
      typeof item.last_download_time === 'string'
        ? item.last_download_time
        : typeof item.lastDownload === 'string'
          ? item.lastDownload
          : undefined,
    lastUpdated:
      typeof item.latest_update_time === 'string'
        ? item.latest_update_time
        : typeof item.last_updated === 'string'
          ? item.last_updated
          : typeof item.lastUpdated === 'string'
            ? item.lastUpdated
            : undefined,
    cleanupScope: parseCleanupScope(item.cleanup_scope),
    normalizedPath,
    objectIds,
    records,
    defaultAction,
    recommendedAction:
      typeof item.recommended_action === 'string' &&
      item.recommended_action.trim().length > 0
        ? item.recommended_action
        : defaultRecommendation,
    repoDeleteCandidate:
      typeof item.repo_delete_candidate === 'boolean'
        ? item.repo_delete_candidate
        : kind === 'repo_orphan_live_object' || kind === 'repo_orphan_stale_record',
    sizeBytes:
      typeof item.total_bytes === 'number'
        ? item.total_bytes
        : typeof item.size_bytes === 'number'
          ? item.size_bytes
          : typeof item.sizeBytes === 'number'
          ? item.sizeBytes
          : undefined,
    supportsDryRun:
      typeof item.supports_dry_run === 'boolean'
        ? item.supports_dry_run
        : availableActions.some((action) => action.supportsDryRun),
  };
};

const normalizeStorageChainFinding = (
  item: Record<string, unknown>,
): StorageChainFinding | null => {
  const normalizedPath = normalizeStoragePath(
    typeof item.normalized_path === 'string'
      ? item.normalized_path
      : typeof item.path === 'string'
        ? item.path
        : '',
  );
  if (!normalizedPath) {
    return null;
  }

  const kind = parseStorageChainFindingKind(item.kind ?? item.finding_kind);
  const availableActions = normalizeAvailableActions(item);
  const defaultAction = normalizeDefaultAction(item);
  const defaultRecommendation =
    kind === 'bucket_only_object'
      ? 'Bucket object exists, but no Syfon record matched it.'
      : kind === 'bucket_syfon_no_git'
        ? 'Bucket object and Syfon record matched, but no Git-tracked file matched this checksum.'
        : kind === 'syfon_broken_bucket_mapping'
          ? 'Syfon record exists, but its access URL does not resolve to a configured bucket mapping.'
          : kind === 'syfon_missing_bucket_object'
            ? 'Syfon record points to a mapped bucket location, but the object does not exist.'
            : kind === 'syfon_git_no_bucket'
              ? 'Git and Syfon matched, but the mapped bucket object does not exist.'
              : kind === 'git_only_no_syfon'
                ? 'Git checksum has no matching Syfon record.'
                : kind === 'git_syfon_metadata_mismatch'
                  ? 'Bucket object exists, but its metadata does not match what Syfon expects.'
                  : 'Bucket verification failed before Gecko could classify this record cleanly.';

  return {
    accessUrls: Array.from(
      new Set([
        ...toStringArray(item.access_urls),
        ...toStringArray(
          item.evidence && typeof item.evidence === 'object'
            ? (item.evidence as Record<string, unknown>).access_urls
            : [],
        ),
      ]),
    ),
    bucketObjectUrl:
      typeof item.bucket_object_url === 'string'
        ? item.bucket_object_url
        : undefined,
    checksum:
      typeof item.checksum === 'string' ? item.checksum : undefined,
    error:
      typeof item.error === 'string' ? item.error : undefined,
    errorKind:
      typeof item.error_kind === 'string' ? item.error_kind : undefined,
    evidence:
      item.evidence && typeof item.evidence === 'object'
        ? normalizeAuditEvidence(item.evidence as Record<string, unknown>)
        : undefined,
    actionability:
      typeof item.actionability === 'string' ? item.actionability : undefined,
    availableActions,
    kind,
    normalizedPath,
    objectIds: Array.from(
      new Set([
        ...toStringArray(item.object_ids),
        ...toStringArray(
          item.evidence && typeof item.evidence === 'object'
            ? (item.evidence as Record<string, unknown>).object_ids
            : [],
        ),
      ]),
    ),
    probeStatus:
      typeof item.probe_status === 'string' ? item.probe_status : undefined,
    defaultAction,
    recommendedAction:
      typeof item.recommended_action === 'string' &&
      item.recommended_action.trim().length > 0
        ? item.recommended_action
        : defaultRecommendation,
    recordCount:
      typeof item.record_count === 'number'
        ? item.record_count
        : typeof item.recordCount === 'number'
          ? item.recordCount
          : 0,
    resolvedBucket:
      typeof item.resolved_bucket === 'string'
        ? item.resolved_bucket
        : undefined,
    resolvedKey:
      typeof item.resolved_key === 'string' ? item.resolved_key : undefined,
    sizeBytes:
      typeof item.size_bytes === 'number'
        ? item.size_bytes
        : typeof item.total_bytes === 'number'
          ? item.total_bytes
          : undefined,
    sourcePaths: Array.from(
      new Set([
        ...toStringArray(item.source_paths),
        ...toStringArray(
          item.evidence && typeof item.evidence === 'object'
            ? (item.evidence as Record<string, unknown>).source_paths
            : [],
        ),
      ]),
    ),
    supportsDryRun:
      typeof item.supports_dry_run === 'boolean'
        ? item.supports_dry_run
        : availableActions.some((action) => action.supportsDryRun),
  };
};

const normalizeProjectDiffFinding = (
  item: Record<string, unknown>,
): ProjectDiffFinding | null => {
  const normalizedPath = normalizeStoragePath(
    typeof item.normalized_path === 'string'
      ? item.normalized_path
      : typeof item.path === 'string'
        ? item.path
        : '',
  );

  if (!normalizedPath) {
    return null;
  }

  const kind = parseProjectDiffFindingKind(item.kind ?? item.finding_kind);
  const availableActions = normalizeAvailableActions(item);
  const defaultAction = normalizeDefaultAction(item);
  const defaultRecommendation =
    kind === 'duplicate_syfon_paths'
      ? 'Review duplicate Syfon records before deleting anything.'
      : kind === 'syfon_missing_in_repo'
        ? 'Prepare delete to verify storage before removing Syfon-only records.'
        : kind === 'repo_missing_in_syfon'
          ? 'Review missing Syfon records for this Git-tracked path.'
          : 'Review this path.';

  return {
    actionability:
      typeof item.actionability === 'string' ? item.actionability : undefined,
    availableActions,
    downloadCount:
      typeof item.download_count === 'number'
        ? item.download_count
        : undefined,
    kind,
    lastDownload:
      typeof item.last_download_time === 'string'
        ? item.last_download_time
        : undefined,
    normalizedPath,
    sourcePaths: Array.from(
      new Set([
        ...toStringArray(item.source_paths),
        ...toStringArray(item.sourcePaths),
      ]),
    ),
    objectIds: Array.from(
      new Set([
        ...toStringArray(item.object_ids),
        ...toStringArray(item.objectIds),
      ]),
    ),
    recordCount:
      typeof item.record_count === 'number'
        ? item.record_count
        : typeof item.recordCount === 'number'
          ? item.recordCount
          : 0,
    defaultAction,
    recommendedAction:
      typeof item.recommended_action === 'string' &&
      item.recommended_action.trim().length > 0
        ? item.recommended_action
        : defaultRecommendation,
    sizeBytes:
      typeof item.size_bytes === 'number'
        ? item.size_bytes
        : typeof item.total_bytes === 'number'
          ? item.total_bytes
          : undefined,
    supportsDryRun:
      typeof item.supports_dry_run === 'boolean'
        ? item.supports_dry_run
        : availableActions.some((action) => action.supportsDryRun),
  };
};

const normalizeProjectDiffAuditResult = ({
  expectedPathCount,
  pathPrefix,
  response,
}: {
  expectedPathCount: number;
  pathPrefix: string;
  response: Record<string, unknown> | null;
}): ProjectDiffAuditResult => {
  const findingItems = Array.isArray(response?.findings)
    ? response.findings
    : Array.isArray(response?.items)
      ? response.items
      : [];
  const findings = findingItems
    .map((item) =>
      item && typeof item === 'object'
        ? normalizeProjectDiffFinding(item as Record<string, unknown>)
        : null,
    )
    .filter((finding): finding is ProjectDiffFinding => finding !== null);
  const countsByKind = emptyProjectDiffCounts();

  findings.forEach((finding) => {
    countsByKind[finding.kind] += 1;
  });

  return {
    findings,
    pathPrefix,
    summary: {
      countsByKind,
      expectedPathCount:
        typeof response?.summary === 'object' &&
        response.summary &&
        typeof (response.summary as Record<string, unknown>).expected_path_count ===
          'number'
          ? ((response.summary as Record<string, unknown>).expected_path_count as number)
          : expectedPathCount,
      includesRepoManifest:
        typeof response?.summary === 'object' &&
        response.summary &&
        typeof (response.summary as Record<string, unknown>)
          .includes_repo_manifest === 'boolean'
          ? ((response.summary as Record<string, unknown>)
              .includes_repo_manifest as boolean)
          : expectedPathCount > 0,
      indexedPathCount:
        typeof response?.summary === 'object' &&
        response.summary &&
        typeof (response.summary as Record<string, unknown>).indexed_path_count ===
          'number'
          ? ((response.summary as Record<string, unknown>).indexed_path_count as number)
          : 0,
      matchedPathCount:
        typeof response?.summary === 'object' &&
        response.summary &&
        typeof (response.summary as Record<string, unknown>).matched_path_count ===
          'number'
          ? ((response.summary as Record<string, unknown>).matched_path_count as number)
          : 0,
      scannedRecordCount:
        typeof response?.summary === 'object' &&
        response.summary &&
        typeof (response.summary as Record<string, unknown>)
          .scanned_record_count === 'number'
          ? ((response.summary as Record<string, unknown>)
              .scanned_record_count as number)
          : 0,
      totalFindings:
        typeof response?.summary === 'object' &&
        response.summary &&
        typeof (response.summary as Record<string, unknown>).total_findings ===
          'number'
          ? ((response.summary as Record<string, unknown>).total_findings as number)
          : findings.length,
    },
  };
};

const normalizeStorageChainIssueGroup = (
  item: Record<string, unknown>,
): StorageChainIssueGroup | null => {
  const kind = typeof item.kind === 'string' ? item.kind.trim() : '';
  if (!kind) {
    return null;
  }

  return {
    kind,
    findingCount:
      typeof item.finding_count === 'number' ? item.finding_count : 0,
    objectCount:
      typeof item.object_count === 'number' ? item.object_count : 0,
    pathCount:
      typeof item.path_count === 'number' ? item.path_count : 0,
    recordCount:
      typeof item.record_count === 'number' ? item.record_count : 0,
    totalBytes:
      typeof item.total_bytes === 'number' ? item.total_bytes : 0,
  };
};

const normalizeStorageChainAuditResult = ({
  pathPrefix,
  response,
}: {
  pathPrefix: string;
  response: Record<string, unknown> | null;
}): StorageChainAuditResult => {
  const findingItems = Array.isArray(response?.findings) ? response.findings : [];
  const findings = findingItems
    .map((item) =>
      item && typeof item === 'object'
        ? normalizeStorageChainFinding(item as Record<string, unknown>)
        : null,
    )
    .filter((finding): finding is StorageChainFinding => finding !== null);
  const summary =
    response?.summary && typeof response.summary === 'object'
      ? (response.summary as Record<string, unknown>)
      : null;
  const groupItems = Array.isArray(response?.groups) ? response.groups : [];
  const groups = groupItems
    .map((item) =>
      item && typeof item === 'object'
        ? normalizeStorageChainIssueGroup(item as Record<string, unknown>)
        : null,
    )
    .filter((group): group is StorageChainIssueGroup => group !== null);
  const countsByKind: Record<string, number> = emptyStorageChainCounts();
  if (summary?.counts_by_kind && typeof summary.counts_by_kind === 'object') {
    Object.entries(summary.counts_by_kind as Record<string, unknown>).forEach(
      ([key, value]) => {
        if (typeof value === 'number') {
          countsByKind[key] = value;
        }
      },
    );
  }

  findings.forEach((finding) => {
    countsByKind[finding.kind] = (countsByKind[finding.kind] ?? 0) + 1;
  });

  return {
    auditId:
      typeof response?.audit_id === 'string' ? response.audit_id : undefined,
    bucketPathPrefix:
      typeof response?.bucket_path_prefix === 'string'
        ? response.bucket_path_prefix
        : undefined,
    findings,
    groups,
    pathPrefix:
      typeof response?.path_prefix === 'string'
        ? response.path_prefix
        : pathPrefix,
    summary: {
      bucketInventoryAvailable:
        typeof summary?.bucket_inventory_available === 'boolean'
          ? summary.bucket_inventory_available
          : true,
      bucketInventoryError:
        typeof summary?.bucket_inventory_error === 'string'
          ? summary.bucket_inventory_error
          : undefined,
      bucketObjectCount:
        typeof summary?.bucket_object_count === 'number'
          ? summary.bucket_object_count
          : 0,
      countsByKind,
      gitTrackedFileCount:
        typeof summary?.git_tracked_file_count === 'number'
          ? summary.git_tracked_file_count
          : 0,
      syfonRecordCount:
        typeof summary?.syfon_record_count === 'number'
          ? summary.syfon_record_count
          : 0,
      totalFindings:
        typeof summary?.total_findings === 'number'
          ? summary.total_findings
          : findings.length,
    },
  };
};

const normalizeCleanupAuditResult = ({
  expectedPathCount,
  includesRepoManifest,
  pathPrefix,
  response,
}: {
  expectedPathCount: number;
  includesRepoManifest: boolean;
  pathPrefix: string;
  response: Record<string, unknown> | null;
}): StorageCleanupAuditResult => {
  const findingItems = Array.isArray(response?.findings)
    ? response.findings
    : Array.isArray(response?.items)
      ? response.items
      : [];
  const findings = findingItems
    .map((item) =>
      item && typeof item === 'object'
        ? normalizeCleanupFinding(item as Record<string, unknown>)
        : null,
    )
    .filter((finding): finding is StorageCleanupFinding => finding !== null);
  const countsByKind = emptyCleanupCounts();

  findings.forEach((finding) => {
    countsByKind[finding.kind] += 1;
  });

  return {
    expectedPathCount:
      typeof response?.expected_path_count === 'number'
        ? response.expected_path_count
        : expectedPathCount,
    findings,
    includesRepoManifest,
    pathPrefix,
    summary: {
      countsByKind,
      manualFindingCount:
        countsByKind.broken_access_url_error +
        countsByKind.live_duplicate_conflict +
        countsByKind.storage_object_missing +
        countsByKind.storage_probe_error +
        countsByKind.storage_validation_mismatch +
        countsByKind.unknown,
      repoDeleteCandidateCount: findings.filter(
        (finding) => finding.repoDeleteCandidate,
      ).length,
      repoOrphanCount:
        countsByKind.repo_orphan_live_object +
        countsByKind.repo_orphan_stale_record,
      staleDuplicateCount: countsByKind.stale_duplicate_record,
      totalFindings: findings.length,
    },
  };
};

const normalizeCleanupApplyResult = (
  response: Record<string, unknown> | null,
): StorageCleanupApplyResult => {
  const rawPurgeResults = Array.isArray(response?.storage_purge_results)
    ? response.storage_purge_results
    : Array.isArray(response?.purge_results)
      ? response.purge_results
      : [];

  return {
    deletedRecordIds: Array.from(
      new Set([
        ...toStringArray(response?.deleted_record_ids),
        ...toStringArray(response?.deletedRecordIds),
      ]),
    ),
    deletedBucketObjectUrls: Array.from(
      new Set([
        ...toStringArray(response?.deleted_bucket_object_urls),
        ...toStringArray(response?.deletedBucketObjectUrls),
      ]),
    ),
    updatedRecordIds: Array.from(
      new Set([
        ...toStringArray(response?.updated_record_ids),
        ...toStringArray(response?.updatedRecordIds),
      ]),
    ),
    dryRun:
      typeof response?.dry_run === 'boolean'
        ? response.dry_run
        : typeof response?.dryRun === 'boolean'
          ? response.dryRun
          : false,
    manualPaths: Array.from(
      new Set([
        ...toStringArray(response?.manual_paths),
        ...toStringArray(response?.manual_findings),
      ]),
    ),
    purgeResults: rawPurgeResults
      .map<StorageCleanupPurgeResult | null>((item) => {
        if (!item || typeof item !== 'object') {
          return null;
        }

        const record = item as Record<string, unknown>;
        const objectId =
          typeof record.object_id === 'string'
            ? record.object_id.trim()
            : typeof record.objectId === 'string'
              ? record.objectId.trim()
              : '';

        if (!objectId) {
          return null;
        }

        return {
          error:
            typeof record.error === 'string' ? record.error : undefined,
          objectId,
          status:
            typeof record.status === 'string' ? record.status : undefined,
          success:
            typeof record.success === 'boolean' ? record.success : null,
        };
      })
      .filter((result): result is StorageCleanupPurgeResult => result !== null),
    repoDeletePaths: Array.from(
      new Set([
        ...toStringArray(response?.repo_delete_paths),
        ...toStringArray(response?.paths_requiring_repo_delete),
      ]),
    ),
    skippedPaths: Array.from(
      new Set([
        ...toStringArray(response?.skipped_paths),
        ...toStringArray(response?.skipped_findings),
      ]),
    ),
  };
};

const resolveInitialProjectSelection = ({
  defaultProject,
  options,
}: {
  defaultProject?: string;
  options: Array<ProjectStorageOption>;
}): string => {
  if (options.length === 0) return '';
  if (!defaultProject?.trim()) return options[0].value;

  const normalizedDefault = defaultProject.trim();
  const directMatch = options.find((option) => option.value === normalizedDefault);
  if (directMatch) return directMatch.value;

  const projectOnlyMatches = options.filter(
    (option) => option.project === normalizedDefault,
  );
  if (projectOnlyMatches.length === 1) {
    return projectOnlyMatches[0].value;
  }

  return options[0].value;
};

export const useFileSummaryProjectOptions = (
  config?: FilesummaryConfig,
) => {
  const { data: projectSummary = [], isLoading } = useGetGeckoProjectSummaryQuery();

  const options = useMemo(
    () => buildProjectOptions(projectSummary),
    [projectSummary],
  );

  const defaultSelection = useMemo(
    () =>
      resolveInitialProjectSelection({
        defaultProject: config?.defaultProject,
        options,
      }),
    [config?.defaultProject, options],
  );

  return {
    defaultSelection,
    isLoading,
    options,
  };
};

export const useSyfonPathStorageSummary = ({
  currentPath,
  projectSelection,
}: {
  currentPath: string;
  projectSelection: string;
  config?: FilesummaryConfig;
}) => {
  const [data, setData] = useState<StoragePathSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return undefined;
    }

    const { organization, project } = selection;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [summaryResponse, childrenResponse] = await Promise.all([
          fetch(
            buildStorageSummaryUrl({
              organization,
              path: currentPath,
              project,
            }),
            {
              credentials: 'include',
              method: 'GET',
            },
          ),
          fetch(
            buildStorageChildrenUrl({
              limit: DEFAULT_CHILD_LIMIT,
              organization,
              path: currentPath,
              project,
            }),
            {
              credentials: 'include',
              method: 'GET',
            },
          ),
        ]);

        if (
          handleUnauthorizedResponse(summaryResponse) ||
          handleUnauthorizedResponse(childrenResponse)
        ) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!summaryResponse.ok) {
          throw new Error(
            `Failed to fetch storage summary for ${organization}/${project}`,
          );
        }
        if (!childrenResponse.ok) {
          throw new Error(
            `Failed to fetch storage children for ${organization}/${project}`,
          );
        }

        const summaryJson =
          (await summaryResponse.json()) as StorageSummaryResponse;
        const childrenJson =
          (await childrenResponse.json()) as StorageChildrenResponse;

        const rows = sortStorageRows(
          (childrenJson.items ?? [])
            .map((item) => normalizeStorageRow(item))
            .filter((row): row is StoragePathRow => row !== null),
        );

        const summary: StoragePathSummary = {
          childCount: summaryJson.direct_child_count ?? rows.length,
          downloadCount: summaryJson.download_count ?? 0,
          fileCount: summaryJson.file_count ?? 0,
          lastDownload: summaryJson.last_download_time,
          lastUpdated: summaryJson.latest_update_time,
          path: summaryJson.path?.trim() || currentPath.trim(),
          recordCount: summaryJson.record_count ?? 0,
          rows,
          sizeBytes: summaryJson.total_bytes ?? 0,
          truncated: (summaryJson.direct_child_count ?? rows.length) > rows.length,
        };

        if (!cancelled) {
          setData(summary);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load storage summary from Gecko analytics.',
          );
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentPath, projectSelection, reloadToken]);

  return {
    data,
    error,
    isLoading,
    refresh,
  };
};

export const useSyfonProjectDiff = ({
  config,
  currentPath,
  projectSelection,
}: {
  config?: FilesummaryConfig;
  currentPath: string;
  projectSelection: string;
}) => {
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<ProjectDiffAuditResult | null>(
    null,
  );
  const [isAuditing, setIsAuditing] = useState(false);
  useGetCSRFQuery();
  const csrfToken = useCoreSelector((state: CoreState) =>
    selectCSRFToken(state),
  );

  void config;

  const runAudit = useCallback(async (): Promise<ProjectDiffAuditResult | null> => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      setAuditError('Select a project before running the chain audit.');
      setAuditResult(null);
      return null;
    }

    setAuditError(null);
    setIsAuditing(true);

    try {
      const response = await fetch(
        buildProjectDiffUrl({
          organization: selection.organization,
          project: selection.project,
        }),
        {
          body: JSON.stringify({
            git_subpath: normalizeStoragePath(currentPath) || undefined,
          }),
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
        },
        method: 'POST',
      });

      if (handleUnauthorizedResponse(response)) {
        throw new Error('Your session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            `Failed to audit project records for ${selection.organization}/${selection.project}`,
          ),
        );
      }

      const normalized = normalizeProjectDiffAuditResult({
        expectedPathCount: 0,
        pathPrefix: normalizeStoragePath(currentPath),
        response: await readJsonResponse<Record<string, unknown>>(response),
      });
      setAuditResult(normalized);
      return normalized;
    } catch (auditFailure) {
      const message =
        auditFailure instanceof Error
          ? auditFailure.message
          : 'Failed to audit project records.';
      setAuditError(message);
      setAuditResult(null);
      return null;
    } finally {
      setIsAuditing(false);
    }
  }, [csrfToken, currentPath, projectSelection]);

  const clearAudit = useCallback(() => {
    setAuditError(null);
    setAuditResult(null);
  }, []);

  return {
    auditError,
    auditResult,
    clearAudit,
    isAuditing,
    runAudit,
    setAuditResult,
  };
};

export const useSyfonStorageChain = ({
  config,
  currentPath,
  projectSelection,
}: {
  config?: FilesummaryConfig;
  currentPath: string;
  projectSelection: string;
}) => {
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<StorageChainAuditResult | null>(
    null,
  );
  const [isAuditing, setIsAuditing] = useState(false);
  useGetCSRFQuery();
  const csrfToken = useCoreSelector((state: CoreState) =>
    selectCSRFToken(state),
  );

  void config;

  const runAudit = useCallback(async ({
    bucketInventoryMode,
    bucketPathPrefix,
    findingKind,
    findingLimit,
    persistResult = true,
    probeMode,
  }: {
    bucketInventoryMode?: 'items' | 'validate';
    bucketPathPrefix?: string;
    findingKind?: string;
    findingLimit?: number;
    persistResult?: boolean;
    probeMode?: 'full' | 'inventory_only';
  } = {}): Promise<StorageChainAuditResult | null> => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      setAuditError('Select a project before running the storage chain audit.');
      setAuditResult(null);
      return null;
    }

    setAuditError(null);
    setIsAuditing(true);

    try {
      const response = await fetch(
        buildStorageChainUrl({
          organization: selection.organization,
          project: selection.project,
        }),
        {
          body: JSON.stringify({
            bucket_inventory_mode: bucketInventoryMode,
            bucket_path_prefix: bucketPathPrefix
              ? normalizeStoragePath(bucketPathPrefix) || undefined
              : undefined,
            finding_kind: findingKind,
            finding_limit: findingLimit,
            git_subpath: normalizeStoragePath(currentPath) || undefined,
            probe_mode: probeMode,
          }),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          method: 'POST',
        },
      );

      if (handleUnauthorizedResponse(response)) {
        throw new Error('Your session expired. Please log in again.');
      }

      if (!response.ok) {
        throw new Error(
          await getErrorMessage(
            response,
            `Failed to audit storage chain for ${selection.organization}/${selection.project}`,
          ),
        );
      }

      const normalized = normalizeStorageChainAuditResult({
        pathPrefix: normalizeStoragePath(currentPath),
        response: await readJsonResponse<Record<string, unknown>>(response),
      });
      if (persistResult) {
        setAuditResult(normalized);
      }
      return normalized;
    } catch (auditFailure) {
      const message =
        auditFailure instanceof Error
          ? auditFailure.message
          : 'Failed to audit the storage chain.';
      setAuditError(message);
      if (persistResult) {
        setAuditResult(null);
      }
      return null;
    } finally {
      setIsAuditing(false);
    }
  }, [csrfToken, currentPath, projectSelection]);

  const clearAudit = useCallback(() => {
    setAuditError(null);
    setAuditResult(null);
  }, []);

  return {
    auditError,
    auditResult,
    clearAudit,
    isAuditing,
    runAudit,
    setAuditResult,
  };
};

export const useSyfonStorageCleanup = ({
  config,
  currentPath,
  projectSelection,
}: {
  config?: FilesummaryConfig;
  currentPath: string;
  projectSelection: string;
}) => {
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<StorageCleanupApplyResult | null>(
    null,
  );
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<StorageCleanupAuditResult | null>(
    null,
  );
  const [isApplying, setIsApplying] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [lastAuditIncludedRepoManifest, setLastAuditIncludedRepoManifest] =
    useState(false);
  useGetCSRFQuery();
  const csrfToken = useCoreSelector((state: CoreState) =>
    selectCSRFToken(state),
  );

  void config;

  const runAudit = useCallback(
    async ({
      findingKind,
      includeRepoManifest = false,
      persistResult = true,
      selectedPaths,
    }: {
      findingKind?: string;
      includeRepoManifest?: boolean;
      persistResult?: boolean;
      selectedPaths?: Array<string>;
    } = {}): Promise<StorageCleanupAuditResult | null> => {
      const selection = splitProjectSelectionValue(projectSelection);
      const startedAt = performance.now();
      if (!selection) {
        setAuditError('Select a project before running storage verification.');
        setAuditResult(null);
        return null;
      }

      setAuditError(null);
      setApplyError(null);
      setIsAuditing(true);

      try {
        void includeRepoManifest;
        const requestURL = buildStorageCleanupUrl({
          action: 'audit',
          organization: selection.organization,
          project: selection.project,
        });
        const requestBody = {
          check_storage: true,
          finding_kind: findingKind,
          git_subpath: normalizeStoragePath(currentPath) || undefined,
          selected_repo_paths: selectedPaths,
        };

        console.debug('storage cleanup audit request:start', {
          currentPath,
          projectSelection,
          requestBody,
          requestURL,
        });

        const response = await fetch(requestURL, {
          body: JSON.stringify(requestBody),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          method: 'POST',
        });

        console.debug('storage cleanup audit request:response', {
          durationMs: performance.now() - startedAt,
          ok: response.ok,
          requestURL,
          status: response.status,
          statusText: response.statusText,
        });

        if (handleUnauthorizedResponse(response)) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
              `Failed to audit storage verification for ${selection.organization}/${selection.project}`,
            ),
          );
        }

        const normalized = normalizeCleanupAuditResult({
          expectedPathCount: 0,
          includesRepoManifest: true,
          pathPrefix: normalizeStoragePath(currentPath),
          response: await readJsonResponse<Record<string, unknown>>(response),
        });

        if (persistResult) {
          setAuditResult(normalized);
          setLastAuditIncludedRepoManifest(true);
        }
        return normalized;
      } catch (auditFailure) {
        console.error('storage cleanup audit request:failure', {
          currentPath,
          durationMs: performance.now() - startedAt,
          message:
            auditFailure instanceof Error
              ? auditFailure.message
              : String(auditFailure),
          name: auditFailure instanceof Error ? auditFailure.name : undefined,
          projectSelection,
          selectedPaths,
          value: auditFailure,
        });
        const message =
          auditFailure instanceof Error
            ? auditFailure.message
            : 'Failed to audit Gecko storage verification.';
        setAuditError(message);
        if (persistResult) {
          setAuditResult(null);
        }
        return null;
      } finally {
        setIsAuditing(false);
      }
    },
    [csrfToken, currentPath, projectSelection],
  );

  const rerunAudit = useCallback(
    () =>
      runAudit({
        includeRepoManifest: lastAuditIncludedRepoManifest,
      }),
    [lastAuditIncludedRepoManifest, runAudit],
  );

  const applyCleanup = useCallback(
    async ({
      actions,
      deleteRepoOrphans,
      deleteStaleDuplicates,
      deleteBucketOnlyObjects = false,
      dryRun = false,
      selectedPaths,
    }: {
      actions?: Array<StorageApplyActionRequest>;
      deleteRepoOrphans: boolean;
      deleteStaleDuplicates: boolean;
      deleteBucketOnlyObjects?: boolean;
      dryRun?: boolean;
      selectedPaths?: Array<string>;
    }): Promise<StorageCleanupApplyResult | null> => {
      const selection = splitProjectSelectionValue(projectSelection);
      if (!selection) {
        setApplyError('Select a project before applying cleanup.');
        setApplyResult(null);
        return null;
      }

      setApplyError(null);
      setIsApplying(true);

      try {
        const response = await fetch(
          buildStorageCleanupUrl({
            action: 'apply',
            organization: selection.organization,
            project: selection.project,
          }),
          {
            body: JSON.stringify({
              actions,
              delete_repo_orphans: deleteRepoOrphans,
              delete_stale_duplicates: deleteStaleDuplicates,
              delete_bucket_only_objects: deleteBucketOnlyObjects,
              dry_run: dryRun,
              git_subpath: normalizeStoragePath(currentPath) || undefined,
              selected_repo_paths: selectedPaths,
            }),
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
          },
          method: 'POST',
        });

        if (handleUnauthorizedResponse(response)) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!response.ok) {
          throw new Error(
            await getErrorMessage(
              response,
            `Failed to apply storage cleanup for ${selection.organization}/${selection.project}`,
            ),
          );
        }

        const normalized = normalizeCleanupApplyResult(
          await readJsonResponse<Record<string, unknown>>(response),
        );
        setApplyResult(normalized);
        return normalized;
      } catch (applyFailure) {
        if (isUnauthorizedMutationError(applyFailure)) {
          requestSessionLogout();
        }
        const message =
          applyFailure instanceof Error
            ? applyFailure.message
            : 'Failed to apply storage cleanup.';
        setApplyError(message);
        setApplyResult(null);
        return null;
      } finally {
        setIsApplying(false);
      }
    },
    [
      csrfToken,
      currentPath,
      projectSelection,
    ],
  );

  const clearCleanupResults = useCallback(() => {
    setApplyError(null);
    setApplyResult(null);
    setAuditError(null);
    setAuditResult(null);
  }, []);

  return {
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
    setAuditResult,
  };
};
