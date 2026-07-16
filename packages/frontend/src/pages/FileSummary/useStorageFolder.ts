import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GEN3_API } from '@gen3/core';
import type { FilesummaryConfig } from './types';
import {
  normalizeStoragePath,
  splitProjectSelectionValue,
  sortStorageRows,
  type StoragePathRow,
  type StoragePathSummary,
} from './storageUtils';
import { requestSessionLogout } from '../../lib/session/session';

const DEFAULT_CHILD_LIMIT = 100;
const STORAGE_FOLDER_CACHE_TTL_MS = 60_000;

interface StorageSummaryResponse {
  direct_child_count?: number;
  download_count?: number;
  duplicate_path_count?: number;
  file_count?: number;
  last_download_time?: string;
  latest_update_time?: string;
  path?: string;
  record_count?: number;
  source?: string;
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
  has_more?: boolean;
  next_cursor?: string;
}

interface StorageFolderResponse {
  summary?: StorageSummaryResponse;
  children?: StorageChildrenResponse;
}

type ExactChainSummary = {
  readonly bucketObjectCount: number;
  readonly gitTrackedFileCount: number;
  readonly pathPrefix: string;
  readonly syfonRecordCount: number;
};

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

const buildStorageFolderUrl = ({
  cursor,
  limit,
  organization,
  path,
  project,
  summaryMode,
}: {
  cursor?: string;
  limit: number;
  organization: string;
  path?: string;
  project: string;
  summaryMode?: 'exact';
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
  if (cursor) {
    query.set('cursor', cursor);
  }
  if (summaryMode) {
    query.set('summary_mode', summaryMode);
  }

  return `${buildGeckoGitProjectBaseUrl({
    organization,
    project,
  })}/storage/folder?${query.toString()}`;
};

const handleUnauthorizedResponse = (response: Response): boolean => {
  if (response.status !== 401) {
    return false;
  }

  requestSessionLogout();
  return true;
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
    downloadCount: item.download_count,
    fileCount: item.file_count ?? 0,
    lastDownload: item.last_download_time,
    lastUpdated: item.latest_update_time,
    name: item.name?.trim() || path.split('/').filter(Boolean).pop() || path,
    path,
    recordCount: item.record_count,
    sizeBytes: item.total_bytes ?? 0,
    type,
  };
};

const toStoragePathSummary = ({
  childrenJson,
  currentPath,
  summaryJson,
}: {
  childrenJson: StorageChildrenResponse;
  currentPath: string;
  summaryJson: StorageSummaryResponse;
}): StoragePathSummary => {
  const rows = sortStorageRows(
    (childrenJson.items ?? [])
      .map((item) => normalizeStorageRow(item))
      .filter((row): row is StoragePathRow => row !== null),
  );

  return {
    childCount: summaryJson.direct_child_count ?? rows.length,
    downloadCount: summaryJson.download_count,
    fileCount: summaryJson.file_count ?? 0,
    hasMore: Boolean(childrenJson.has_more),
    lastDownload: summaryJson.last_download_time,
    lastUpdated: summaryJson.latest_update_time,
    nextCursor: childrenJson.next_cursor,
    path: summaryJson.path?.trim() || currentPath.trim(),
    recordCount: summaryJson.record_count,
    rows,
    sizeBytes: summaryJson.total_bytes ?? 0,
    source: summaryJson.source,
    truncated: Boolean(childrenJson.has_more),
  };
};

export const useSyfonPathStorageSummary = ({
  currentPath,
  exactRequest,
  projectSelection,
}: {
  currentPath: string;
  exactRequest?: { path: string; token: number };
  projectSelection: string;
  config?: FilesummaryConfig;
}) => {
  const [data, setData] = useState<StoragePathSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingExact, setIsLoadingExact] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const cacheRef = useRef(
    new Map<string, { expiresAt: number; data: StoragePathSummary }>(),
  );
  const requestSeqRef = useRef(0);

  const cacheKey = useMemo(() => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      return '';
    }
    return [
      selection.organization,
      selection.project,
      normalizeStoragePath(currentPath),
      'bytes',
      'desc',
    ].join('\u0000');
  }, [currentPath, projectSelection]);

  const refresh = useCallback(() => {
    cacheRef.current.clear();
    setReloadToken((current) => current + 1);
  }, []);

  const applyExactChainSummary = useCallback(
    (summary: ExactChainSummary) => {
      const normalizedSummaryPath = normalizeStoragePath(summary.pathPrefix);
      const normalizedCurrentPath = normalizeStoragePath(currentPath);
      if (normalizedSummaryPath !== normalizedCurrentPath) {
        return;
      }

      setData((current) => {
        if (!current) {
          return current;
        }
        const next = {
          ...current,
          bucketObjectCount: summary.bucketObjectCount,
          fileCount: summary.gitTrackedFileCount,
          isChainAuditExact: true,
          recordCount: current.recordCount ?? summary.syfonRecordCount,
        };

        if (cacheKey) {
          cacheRef.current.set(cacheKey, {
            data: next,
            expiresAt: Date.now() + STORAGE_FOLDER_CACHE_TTL_MS,
          });
        }

        return next;
      });
    },
    [cacheKey, currentPath],
  );

  useEffect(() => {
    if (!exactRequest?.token) {
      return undefined;
    }

    const normalizedCurrentPath = normalizeStoragePath(currentPath);
    if (normalizeStoragePath(exactRequest.path) !== normalizedCurrentPath) {
      return undefined;
    }

    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      return undefined;
    }

    let cancelled = false;
    setIsLoadingExact(true);

    const load = async () => {
      try {
        const response = await fetch(
          buildStorageFolderUrl({
            limit: Math.max(DEFAULT_CHILD_LIMIT, data?.rows.length ?? 0),
            organization: selection.organization,
            path: currentPath,
            project: selection.project,
            summaryMode: 'exact',
          }),
          {
            credentials: 'include',
            method: 'GET',
          },
        );

        if (handleUnauthorizedResponse(response)) {
          throw new Error('Your session expired. Please log in again.');
        }
        if (!response.ok) {
          throw new Error(
            `Failed to fetch audited storage details for ${selection.organization}/${selection.project}`,
          );
        }

        const folderJson = (await response.json()) as StorageFolderResponse;
        const exactSummary = toStoragePathSummary({
          childrenJson: folderJson.children ?? {},
          currentPath,
          summaryJson: folderJson.summary ?? {},
        });
        if (cancelled) {
          return;
        }

        setData((current) => {
          if (
            current &&
            normalizeStoragePath(current.path) !== normalizedCurrentPath
          ) {
            return current;
          }

          const next = {
            ...exactSummary,
            bucketObjectCount: current?.bucketObjectCount,
            isChainAuditExact: true,
          };
          if (cacheKey) {
            cacheRef.current.set(cacheKey, {
              data: next,
              expiresAt: Date.now() + STORAGE_FOLDER_CACHE_TTL_MS,
            });
          }
          return next;
        });
      } catch (exactLoadError) {
        if (!cancelled) {
          setError(
            exactLoadError instanceof Error
              ? exactLoadError.message
              : 'Audited storage details could not be loaded.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoadingExact(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    cacheKey,
    currentPath,
    data?.rows.length,
    exactRequest,
    projectSelection,
  ]);

  useEffect(() => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection) {
      setData(null);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      return undefined;
    }

    const { organization, project } = selection;
    const cached = cacheRef.current.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      setData(cached.data);
      setError(null);
      setIsLoading(false);
      setIsLoadingMore(false);
      return undefined;
    }

    let cancelled = false;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    const controller = new AbortController();

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          buildStorageFolderUrl({
            limit: DEFAULT_CHILD_LIMIT,
            organization,
            path: currentPath,
            project,
          }),
          {
            credentials: 'include',
            method: 'GET',
            signal: controller.signal,
          },
        );

        if (handleUnauthorizedResponse(response)) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!response.ok) {
          throw new Error(
            `Failed to fetch storage folder for ${organization}/${project}`,
          );
        }

        const folderJson = (await response.json()) as StorageFolderResponse;
        const summary = toStoragePathSummary({
          childrenJson: folderJson.children ?? {},
          currentPath,
          summaryJson: folderJson.summary ?? {},
        });

        if (!cancelled && requestSeqRef.current === requestSeq) {
          cacheRef.current.set(cacheKey, {
            data: summary,
            expiresAt: Date.now() + STORAGE_FOLDER_CACHE_TTL_MS,
          });
          setData(summary);
        }
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === 'AbortError'
        ) {
          return;
        }
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
      controller.abort();
    };
  }, [cacheKey, currentPath, projectSelection, reloadToken]);

  const loadMore = useCallback(async () => {
    const selection = splitProjectSelectionValue(projectSelection);
    if (!selection || !data?.hasMore || !data.nextCursor || isLoadingMore) {
      return;
    }

    const { organization, project } = selection;
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;
    setIsLoadingMore(true);
    setError(null);

    try {
      const response = await fetch(
        buildStorageFolderUrl({
          cursor: data.nextCursor,
          limit: DEFAULT_CHILD_LIMIT,
          organization,
          path: currentPath,
          project,
          summaryMode: data.isChainAuditExact ? 'exact' : undefined,
        }),
        {
          credentials: 'include',
          method: 'GET',
        },
      );

      if (handleUnauthorizedResponse(response)) {
        throw new Error('Your session expired. Please log in again.');
      }
      if (!response.ok) {
        throw new Error(
          `Failed to fetch more storage children for ${organization}/${project}`,
        );
      }

      const folderJson = (await response.json()) as StorageFolderResponse;
      const childrenJson = folderJson.children ?? {};
      const additionalRows = sortStorageRows(
        (childrenJson.items ?? [])
          .map((item) => normalizeStorageRow(item))
          .filter((row): row is StoragePathRow => row !== null),
      );

      setData((current) => {
        if (requestSeqRef.current !== requestSeq) {
          return current;
        }
        if (!current) {
          return current;
        }
        const existing = new Set(
          current.rows.map((row) => `${row.type}:${row.path}`),
        );
        const rows = [
          ...current.rows,
          ...additionalRows.filter(
            (row) => !existing.has(`${row.type}:${row.path}`),
          ),
        ];
        const next = {
          ...current,
          hasMore: Boolean(childrenJson.has_more),
          nextCursor: childrenJson.next_cursor,
          rows: sortStorageRows(rows),
          source: folderJson.summary?.source ?? current.source,
          truncated: Boolean(childrenJson.has_more),
        };
        if (cacheKey) {
          cacheRef.current.set(cacheKey, {
            data: next,
            expiresAt: Date.now() + STORAGE_FOLDER_CACHE_TTL_MS,
          });
        }
        return next;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to load more storage children from Gecko analytics.',
      );
    } finally {
      setIsLoadingMore(false);
    }
  }, [cacheKey, currentPath, data, isLoadingMore, projectSelection]);

  return {
    data,
    error,
    isLoading,
    isLoadingExact,
    isLoadingMore,
    applyExactChainSummary,
    loadMore,
    refresh,
  };
};
