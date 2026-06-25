import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CoreState,
  GEN3_API,
  SYFON_API,
  selectCSRFToken,
  useCoreSelector,
  useBulkDeleteSyfonDrsObjectsMutation,
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
const DEFAULT_GIT_TREE_REQUEST_LIMIT = 0;

export type ProjectDiffFindingKind =
  | 'duplicate_syfon_paths'
  | 'syfon_missing_in_repo'
  | 'repo_missing_in_syfon'
  | 'unknown';

export interface ProjectDiffFinding {
  readonly kind: ProjectDiffFindingKind;
  readonly normalizedPath: string;
  readonly objectIds: Array<string>;
  readonly recordCount: number;
  readonly sizeBytes?: number;
  readonly downloadCount?: number;
  readonly lastDownload?: string;
  readonly recommendedAction: string;
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

export type StorageCleanupFindingKind =
  | 'stale_duplicate_record'
  | 'live_duplicate_conflict'
  | 'broken_access_url_error'
  | 'repo_orphan_live_object'
  | 'repo_orphan_stale_record'
  | 'storage_probe_error'
  | 'unknown';

export type StorageCleanupScope = 'record' | 'access_url' | 'unknown';

export interface StorageCleanupAccessProbe {
  readonly url: string;
  readonly bucket?: string;
  readonly status?: string;
  readonly error?: string;
  readonly errorKind?: string;
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

export interface StorageCleanupApplyResult {
  readonly deletedRecordIds: Array<string>;
  readonly purgeResults: Array<StorageCleanupPurgeResult>;
  readonly repoDeletePaths: Array<string>;
  readonly manualPaths: Array<string>;
  readonly skippedPaths: Array<string>;
  readonly dryRun: boolean;
}

interface GeckoGitManifestResponse {
  entry_count?: number;
  entries?: Array<{
    path?: string;
    type?: string;
  }>;
  has_more?: boolean;
  next_cursor?: string;
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

const buildStorageSummaryUrl = ({
  organization,
  path,
  project,
}: {
  organization: string;
  path?: string;
  project: string;
}): string => {
  const query = new URLSearchParams({
    organization: organization.trim(),
    project: project.trim(),
  });

  if (path?.trim()) {
    query.set('path', path.trim());
  }

  return `${GEN3_API}/index/v1/metrics/storage/summary?${query.toString()}`;
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
    organization: organization.trim(),
    project: project.trim(),
    sort_by: 'bytes',
    sort_order: 'desc',
  });

  if (path?.trim()) {
    query.set('path', path.trim());
  }

  return `${GEN3_API}/index/v1/metrics/storage/children?${query.toString()}`;
};

const buildStorageCleanupUrl = (
  action: 'apply' | 'audit',
): string => `${SYFON_API}/repair/storage-cleanup/${action}`;

const buildProjectDiffUrl = (): string =>
  `${SYFON_API}/repair/project-diff/audit`;

const buildGitManifestUrl = ({
  cursor,
  filesOnly,
  limit,
  organization,
  path,
  project,
}: {
  cursor?: string;
  filesOnly?: boolean;
  limit?: number;
  organization: string;
  path?: string;
  project: string;
}): string => {
  const normalizedPath = normalizeStoragePath(path);
  const query = new URLSearchParams();
  if (cursor?.trim()) {
    query.set('cursor', cursor.trim());
  }
  if (typeof filesOnly === 'boolean') {
    query.set('files_only', String(filesOnly));
  }
  if (typeof limit === 'number') {
    query.set('limit', String(limit));
  }
  const suffix = normalizedPath
    ? `/manifest/${normalizedPath
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/')}`
    : '/manifest';
  const querySuffix = query.toString() ? `?${query.toString()}` : '';

  return `${GEN3_API}/gecko/git/projects/${encodeURIComponent(
    organization,
  )}/${encodeURIComponent(project)}${suffix}${querySuffix}`;
};

const emptyCleanupCounts = (): Record<StorageCleanupFindingKind, number> => ({
  broken_access_url_error: 0,
  live_duplicate_conflict: 0,
  repo_orphan_live_object: 0,
  repo_orphan_stale_record: 0,
  stale_duplicate_record: 0,
  storage_probe_error: 0,
  unknown: 0,
});

const emptyProjectDiffCounts = (): Record<ProjectDiffFindingKind, number> => ({
  duplicate_syfon_paths: 0,
  repo_missing_in_syfon: 0,
  syfon_missing_in_repo: 0,
  unknown: 0,
});

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

const parseCleanupFindingKind = (
  value: unknown,
): StorageCleanupFindingKind => {
  switch (value) {
    case 'stale_duplicate_record':
    case 'live_duplicate_conflict':
    case 'broken_access_url_error':
    case 'repo_orphan_live_object':
    case 'repo_orphan_stale_record':
    case 'storage_probe_error':
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
    error:
      typeof record.storage_message === 'string'
        ? record.storage_message
        : typeof record.error === 'string'
          ? record.error
          : undefined,
    errorKind:
      typeof record.error_kind === 'string' ? record.error_kind : undefined,
    status:
      typeof record.storage_status === 'string'
        ? record.storage_status
        : typeof record.status === 'string'
          ? record.status
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
  const defaultAction =
    kind === 'stale_duplicate_record'
      ? 'Delete stale duplicate records'
      : kind === 'broken_access_url_error'
        ? 'Manual review required for broken access URLs'
      : kind === 'repo_orphan_live_object'
        ? 'Delete Syfon record and purge storage object'
        : kind === 'repo_orphan_stale_record'
          ? 'Delete stale Syfon record'
          : kind === 'storage_probe_error'
            ? 'Retry once storage probing is healthy'
            : 'Manual review required';

  return {
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
    recommendedAction:
      typeof item.recommended_action === 'string' &&
      item.recommended_action.trim().length > 0
        ? item.recommended_action
        : defaultAction,
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
  const defaultAction =
    kind === 'duplicate_syfon_paths'
      ? 'Review duplicate Syfon records before deleting anything.'
      : kind === 'syfon_missing_in_repo'
        ? 'Prepare delete to verify storage before removing Syfon-only records.'
        : kind === 'repo_missing_in_syfon'
          ? 'Review missing Syfon records for this Git-tracked path.'
          : 'Review this path.';

  return {
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
    recommendedAction:
      typeof item.recommended_action === 'string' &&
      item.recommended_action.trim().length > 0
        ? item.recommended_action
        : defaultAction,
    sizeBytes:
      typeof item.size_bytes === 'number'
        ? item.size_bytes
        : typeof item.total_bytes === 'number'
          ? item.total_bytes
          : undefined,
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
        countsByKind.storage_probe_error +
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

const collectExpectedPathsFromGecko = async ({
  maxRequests,
  organization,
  pathPrefix,
  project,
}: {
  maxRequests: number;
  organization: string;
  pathPrefix: string;
  project: string;
}): Promise<Array<string>> => {
  const normalizedRoot = normalizeStoragePath(pathPrefix);
  const expectedPaths = new Set<string>();
  let cursor: string | undefined;
  let requests = 0;

  while (true) {
    requests += 1;
    if (maxRequests > 0 && requests > maxRequests) {
      throw new Error(
        `Exceeded ${maxRequests} Gecko manifest requests while building the expected path manifest.`,
      );
    }

    const response = await fetch(
      buildGitManifestUrl({
        cursor,
        filesOnly: true,
        limit: 5000,
        organization,
        path: normalizedRoot,
        project,
      }),
      {
        credentials: 'include',
        method: 'GET',
      },
    );

    if (response.status === 404) {
      if (!cursor) {
        return [];
      }
      throw new Error(
        `Gecko manifest pagination lost subtree ${normalizedRoot || '/'}.`,
      );
    }

    if (handleUnauthorizedResponse(response)) {
      throw new Error('Your session expired. Please log in again.');
    }

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(
          response,
          `Failed to fetch Gecko git manifest for ${organization}/${project}`,
        ),
      );
    }

    const manifest = await readJsonResponse<GeckoGitManifestResponse>(response);
    (manifest?.entries ?? []).forEach((entry: { path?: string; type?: string }) => {
      const entryPath = normalizeStoragePath(entry.path);
      if (!entryPath) return;
      if (entry.type !== 'tree') {
        expectedPaths.add(entryPath);
      }
    });
    if (!manifest?.has_more) {
      break;
    }
    cursor = manifest.next_cursor?.trim();
    if (!cursor) {
      throw new Error(
        `Gecko manifest pagination for ${organization}/${project} did not return a next cursor.`,
      );
    }
  }

  return Array.from(expectedPaths).sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }),
  );
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
              : 'Failed to load storage summary from Syfon metrics.',
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

  const loadExpectedPaths = useCallback(async (): Promise<Array<string>> => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      throw new Error('Select a project before auditing project records.');
    }

    return collectExpectedPathsFromGecko({
      maxRequests:
        config?.maxTraversalPages && config.maxTraversalPages > 0
          ? config.maxTraversalPages
          : DEFAULT_GIT_TREE_REQUEST_LIMIT,
      organization: selection.organization,
      pathPrefix: currentPath,
      project: selection.project,
    });
  }, [config?.maxTraversalPages, currentPath, projectSelection]);

  const runAudit = useCallback(async (): Promise<ProjectDiffAuditResult | null> => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      setAuditError('Select a project before auditing project records.');
      setAuditResult(null);
      return null;
    }

    setAuditError(null);
    setIsAuditing(true);

    try {
      const expectedPaths = await loadExpectedPaths();
      const response = await fetch(buildProjectDiffUrl(), {
        body: JSON.stringify({
          expected_paths: expectedPaths,
          organization: selection.organization,
          path_prefix: normalizeStoragePath(currentPath) || undefined,
          project: selection.project,
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
        expectedPathCount: expectedPaths.length,
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
  }, [csrfToken, currentPath, loadExpectedPaths, projectSelection]);

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
  const [bulkDeleteDrsObjects] = useBulkDeleteSyfonDrsObjectsMutation();
  useGetCSRFQuery();
  const csrfToken = useCoreSelector((state: CoreState) =>
    selectCSRFToken(state),
  );

  const loadExpectedPaths = useCallback(async (): Promise<Array<string>> => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      throw new Error('Select a project before auditing repo-orphaned paths.');
    }

    return collectExpectedPathsFromGecko({
      maxRequests:
        config?.maxTraversalPages && config.maxTraversalPages > 0
          ? config.maxTraversalPages
          : DEFAULT_GIT_TREE_REQUEST_LIMIT,
      organization: selection.organization,
      pathPrefix: currentPath,
      project: selection.project,
    });
  }, [config?.maxTraversalPages, currentPath, projectSelection]);

  const runAudit = useCallback(
    async ({
      includeRepoManifest = false,
      selectedPaths,
    }: {
      includeRepoManifest?: boolean;
      selectedPaths?: Array<string>;
    } = {}): Promise<StorageCleanupAuditResult | null> => {
      const selection = splitProjectSelectionValue(projectSelection);
      if (!selection) {
        setAuditError('Select a project before running cleanup audit.');
        setAuditResult(null);
        return null;
      }

      setAuditError(null);
      setApplyError(null);
      setIsAuditing(true);

      try {
        const expectedPaths = includeRepoManifest
          ? await loadExpectedPaths()
          : [];
        const response = await fetch(buildStorageCleanupUrl('audit'), {
          body: JSON.stringify({
            check_storage: true,
            expected_paths: includeRepoManifest ? expectedPaths : undefined,
            organization: selection.organization,
            path_prefix: normalizeStoragePath(currentPath) || undefined,
            project: selection.project,
            selected_paths: selectedPaths,
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
              `Failed to audit Syfon cleanup for ${selection.organization}/${selection.project}`,
            ),
          );
        }

        const normalized = normalizeCleanupAuditResult({
          expectedPathCount: expectedPaths.length,
          includesRepoManifest: includeRepoManifest,
          pathPrefix: normalizeStoragePath(currentPath),
          response: await readJsonResponse<Record<string, unknown>>(response),
        });

        setAuditResult(normalized);
        setLastAuditIncludedRepoManifest(includeRepoManifest);
        return normalized;
      } catch (auditFailure) {
        const message =
          auditFailure instanceof Error
            ? auditFailure.message
            : 'Failed to audit Syfon storage cleanup.';
        setAuditError(message);
        setAuditResult(null);
        return null;
      } finally {
        setIsAuditing(false);
      }
    },
    [csrfToken, currentPath, loadExpectedPaths, projectSelection],
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
      deleteRepoOrphans,
      deleteStaleDuplicates,
      dryRun = false,
      selectedPaths,
    }: {
      deleteRepoOrphans: boolean;
      deleteStaleDuplicates: boolean;
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
        const includeRepoManifest =
          deleteRepoOrphans || lastAuditIncludedRepoManifest;
        const expectedPaths = includeRepoManifest ? await loadExpectedPaths() : [];
        const response = await fetch(buildStorageCleanupUrl('apply'), {
          body: JSON.stringify({
            delete_repo_orphans: deleteRepoOrphans,
            delete_stale_duplicates: deleteStaleDuplicates,
            dry_run: dryRun,
            expected_paths: includeRepoManifest ? expectedPaths : undefined,
            organization: selection.organization,
            path_prefix: normalizeStoragePath(currentPath) || undefined,
            project: selection.project,
            selected_paths: selectedPaths,
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
              `Failed to apply Syfon cleanup for ${selection.organization}/${selection.project}`,
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
            : 'Failed to apply Syfon storage cleanup.';
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
      lastAuditIncludedRepoManifest,
      loadExpectedPaths,
      projectSelection,
    ],
  );

  const deleteBrokenRecords = useCallback(
    async ({
      objectIds,
    }: {
      objectIds: Array<string>;
    }): Promise<StorageCleanupApplyResult | null> => {
      const uniqueObjectIds = Array.from(
        new Set(objectIds.map((value) => value.trim()).filter(Boolean)),
      );

      if (uniqueObjectIds.length === 0) {
        setApplyError('No broken records were selected for deletion.');
        setApplyResult(null);
        return null;
      }

      setApplyError(null);
      setIsApplying(true);

      try {
        await bulkDeleteDrsObjects({
          bulk_object_ids: uniqueObjectIds,
        }).unwrap();

        const normalized: StorageCleanupApplyResult = {
          deletedRecordIds: uniqueObjectIds,
          dryRun: false,
          manualPaths: [],
          purgeResults: [],
          repoDeletePaths: [],
          skippedPaths: [],
        };

        setApplyResult(normalized);
        return normalized;
      } catch (applyFailure) {
        const message =
          applyFailure instanceof Error
            ? applyFailure.message
            : 'Failed to delete broken Syfon records.';
        setApplyError(message);
        setApplyResult(null);
        return null;
      } finally {
        setIsApplying(false);
      }
    },
    [bulkDeleteDrsObjects],
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
    deleteBrokenRecords,
    isApplying,
    isAuditing,
    rerunAudit,
    runAudit,
  };
};
