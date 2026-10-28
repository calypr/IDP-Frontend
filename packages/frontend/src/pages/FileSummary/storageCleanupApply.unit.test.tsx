import { act, renderHook } from '@testing-library/react';

jest.mock('@gen3/core', () => ({
  GEN3_API: '/api',
  selectCSRFToken: jest.fn(),
  useCoreSelector: jest.fn(),
  useGetCSRFQuery: jest.fn(),
}));
jest.mock('../../lib/session/session', () => ({
  requestSessionVerification: jest.fn(),
}));

import { useSyfonStorageChain, useSyfonStorageCleanup } from './hooks';
import type { StorageChainAuditResult } from './storageTypes';

const jsonAuditResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: jest.fn().mockResolvedValue(JSON.stringify(body)),
});

const createAbortAwareAuditFetch = () => {
  const signals: Array<AbortSignal | undefined> = [];
  const pendingResolvers: Array<
    (response: ReturnType<typeof jsonAuditResponse>) => void
  > = [];
  const fetchMock = jest.fn(
    (_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<ReturnType<typeof jsonAuditResponse>>((resolve, reject) => {
        const signal = init?.signal ?? undefined;
        signals.push(signal);
        pendingResolvers.push(resolve);
        signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );

  return {
    fetchMock,
    resolvePendingAt: (
      index: number,
      body: unknown = { findings: [] },
    ) => pendingResolvers[index]?.(jsonAuditResponse(body)),
    resolveAllPending: () =>
      pendingResolvers.forEach((resolve) =>
        resolve(jsonAuditResponse({ findings: [] })),
      ),
    signals,
  };
};

describe('useSyfonStorageCleanup apply payloads', () => {
  it('preserves broken probe evidence and valid access methods from a storage-chain audit', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock
      .mockResolvedValueOnce({
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
            summary: {
              git_revision: 'git-revision-123',
              syfon_revision: 'syfon-revision-456',
            },
            findings: [
              {
                kind: 'syfon_broken_bucket_mapping',
                normalized_path: 'JHU/ashley_kiemen/coda/1x.tar.gz',
                object_ids: ['8401aaef-de1e-5060-840f-c650c20b08c8'],
                records: [
                  {
                    access_methods: [
                      {
                        access_id: 's3',
                        type: 's3',
                        url: 's3://bforepc-prod/JHU/ashley_kiemen/HTA201_1/HTA201_1_1/coda/1x.tar.gz',
                      },
                      {
                        access_id: 's3',
                        type: 's3',
                        url: 's3://bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
                      },
                      {
                        access_id: 's3',
                        type: 's3',
                        url: 's3://bforepc/bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
                      },
                    ],
                    access_probes: [
                      {
                        operation: 'metadata',
                        status: 'not_found',
                        url: 's3://bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
                      },
                    ],
                    access_urls: [
                      's3://bforepc-prod/JHU/ashley_kiemen/HTA201_1/HTA201_1_1/coda/1x.tar.gz',
                      's3://bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
                      's3://bforepc/bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
                    ],
                    cleanup_scope: 'access_url',
                    object_id: '8401aaef-de1e-5060-840f-c650c20b08c8',
                  },
                ],
              },
            ],
          }),
        ),
        ok: true,
        status: 200,
      })
      .mockResolvedValueOnce({
        text: jest.fn().mockResolvedValue('{}'),
        ok: true,
        status: 200,
      });

    const { result } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    let auditResult: StorageChainAuditResult | null = null;
    await act(async () => {
      auditResult = await result.current.runAudit();
    });

    const { result: cleanup } = renderHook(() =>
      useSyfonStorageCleanup({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    await act(async () => {
      await cleanup.current.applyCleanup({
        deleteRepoOrphans: false,
        deleteStaleDuplicates: false,
        findings: auditResult?.findings,
        expectedGitRevision: auditResult?.summary.gitRevision,
        expectedSyfonRevision: auditResult?.summary.syfonRevision,
      });
    });

    const applyRequest = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(applyRequest.findings[0]).toMatchObject({
      kind: 'syfon_broken_bucket_mapping',
      normalized_path: 'JHU/ashley_kiemen/coda/1x.tar.gz',
      object_ids: ['8401aaef-de1e-5060-840f-c650c20b08c8'],
    });
    expect(applyRequest.findings[0].records[0].access_probes).toEqual([
      expect.objectContaining({
        operation: 'metadata',
        status: 'not_found',
        url: 's3://bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
      }),
    ]);
    expect(applyRequest.findings[0].records[0].access_methods).toEqual([
      {
        access_id: 's3',
        headers: [],
        type: 's3',
        url: 's3://bforepc-prod/JHU/ashley_kiemen/HTA201_1/HTA201_1_1/coda/1x.tar.gz',
      },
      {
        access_id: 's3',
        headers: [],
        type: 's3',
        url: 's3://bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
      },
      {
        access_id: 's3',
        headers: [],
        type: 's3',
        url: 's3://bforepc/bforepc-prod/JHU/ashley_kiemen/coda/1x.tar.gz',
      },
    ]);
    expect(applyRequest).toMatchObject({
      expected_git_revision: 'git-revision-123',
      expected_syfon_revision: 'syfon-revision-456',
    });
  });
});

describe('useSyfonStorageChain refresh state', () => {
  it('passes an abort signal and cancels a request when its scope changes', async () => {
    const pendingFetch = createAbortAwareAuditFetch();
    global.fetch = pendingFetch.fetchMock;

    const { result, rerender } = renderHook(
      ({ currentPath }: { currentPath: string }) =>
        useSyfonStorageChain({
          currentPath,
          projectSelection: 'HTAN_INT/BForePC',
        }),
      { initialProps: { currentPath: '' } },
    );

    let runningAudit: Promise<StorageChainAuditResult | null> | undefined;
    let detailAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      runningAudit = result.current.runAudit();
    });
    await act(async () => {
      detailAudit = result.current.runAudit({ persistResult: false });
    });

    try {
      expect(pendingFetch.signals).toHaveLength(2);
      expect(pendingFetch.signals[0]).toBeDefined();
      expect(pendingFetch.signals[1]).toBeDefined();
      expect(pendingFetch.signals[0]?.aborted).toBe(false);
      rerender({ currentPath: 'new/path' });

      expect(pendingFetch.signals[0]?.aborted).toBe(true);
      expect(pendingFetch.signals[1]?.aborted).toBe(true);
    } finally {
      pendingFetch.resolveAllPending();
      await act(async () => {
        await Promise.all([runningAudit, detailAudit]);
      });
    }

    expect(result.current.auditResult).toBeNull();
    expect(result.current.auditError).toBeNull();
    expect(result.current.isAuditing).toBe(false);
  });

  it('forces bucket inventory only when the caller requests it', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock
      .mockResolvedValueOnce(jsonAuditResponse({ findings: [] }))
      .mockResolvedValueOnce(jsonAuditResponse({ findings: [] }));

    const { result } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    await act(async () => {
      await result.current.runAudit({
        bucketInventoryMode: 'validate',
        forceAuditRefresh: true,
      });
    });
    await act(async () => {
      await result.current.runAudit({
        bucketInventoryMode: 'validate',
        forceAuditRefresh: true,
        forceBucketInventoryRefresh: true,
      });
    });

    const normalRefreshRequest = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(normalRefreshRequest).toMatchObject({
      bucket_inventory_mode: 'validate',
      force_audit_refresh: true,
    });
    expect(normalRefreshRequest).not.toHaveProperty(
      'force_bucket_inventory_refresh',
    );

    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      bucket_inventory_mode: 'validate',
      force_audit_refresh: true,
      force_bucket_inventory_refresh: true,
    });
  });

  it('keeps the last report visible when a refresh fails', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock
      .mockResolvedValueOnce(
        jsonAuditResponse({
          audit_id: 'saved-audit',
          findings: [],
          summary: {
            git_revision: 'git-snapshot',
            syfon_revision: 'syfon-snapshot',
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonAuditResponse({ message: 'Refresh unavailable' }, 503),
      );

    const { result } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    await act(async () => {
      await result.current.runAudit();
    });
    expect(result.current.auditResult?.auditId).toBe('saved-audit');
    expect(result.current.auditResult?.summary).toMatchObject({
      gitRevision: 'git-snapshot',
      syfonRevision: 'syfon-snapshot',
    });

    await act(async () => {
      await result.current.runAudit({
        bucketInventoryMode: 'validate',
        forceAuditRefresh: true,
      });
    });

    expect(result.current.auditResult?.auditId).toBe('saved-audit');
    expect(result.current.auditError).toContain('Refresh unavailable');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      bucket_inventory_mode: 'validate',
      force_audit_refresh: true,
    });
  });

  it('persists a refresh that overlaps a non-persisted detail audit', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    type PendingAuditResponse = ReturnType<typeof jsonAuditResponse>;
    let resolveRefresh: ((response: PendingAuditResponse) => void) | undefined;
    const pendingRefresh = new Promise<PendingAuditResponse>((resolve) => {
      resolveRefresh = resolve;
    });
    fetchMock
      .mockResolvedValueOnce(
        jsonAuditResponse({ audit_id: 'saved-audit', findings: [] }),
      )
      .mockReturnValueOnce(pendingRefresh)
      .mockResolvedValueOnce(
        jsonAuditResponse({ audit_id: 'detail-audit', findings: [] }),
      );

    const { result } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    await act(async () => {
      await result.current.runAudit();
    });

    let refreshAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      refreshAudit = result.current.runAudit({ forceAuditRefresh: true });
    });

    let detailAudit: StorageChainAuditResult | null = null;
    await act(async () => {
      detailAudit = await result.current.runAudit({
        findingKind: 'bucket_only_object',
        persistResult: false,
      });
    });

    expect(detailAudit?.auditId).toBe('detail-audit');
    const refreshSignal = fetchMock.mock.calls[1][1]?.signal;
    expect(refreshSignal).toBeDefined();
    expect(refreshSignal?.aborted).toBe(false);
    expect(result.current.auditResult?.auditId).toBe('saved-audit');
    expect(result.current.isAuditing).toBe(true);

    await act(async () => {
      if (!resolveRefresh) {
        throw new Error('The pending refresh response was not initialized.');
      }
      resolveRefresh(
        jsonAuditResponse({ audit_id: 'refreshed-audit', findings: [] }),
      );
      await refreshAudit;
    });

    expect(result.current.auditResult?.auditId).toBe('refreshed-audit');
    expect(result.current.isAuditing).toBe(false);
  });

  it('clears a previous scope and ignores a late response from it', async () => {
    const pendingFetch = createAbortAwareAuditFetch();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonAuditResponse({ audit_id: 'project-a-audit', findings: [] }),
      )
      .mockImplementation(pendingFetch.fetchMock);
    global.fetch = fetchMock;

    const { result, rerender } = renderHook(
      ({ projectSelection }: { projectSelection: string }) =>
        useSyfonStorageChain({ currentPath: '', projectSelection }),
      { initialProps: { projectSelection: 'HTAN_INT/ProjectA' } },
    );

    await act(async () => {
      await result.current.runAudit();
    });
    expect(result.current.auditResult?.auditId).toBe('project-a-audit');

    let runningAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      runningAudit = result.current.runAudit();
    });
    expect(result.current.isAuditing).toBe(true);

    try {
      rerender({ projectSelection: 'HTAN_INT/ProjectB' });
      expect(pendingFetch.signals[0]?.aborted).toBe(true);
      expect(result.current.auditResult).toBeNull();
      expect(result.current.auditError).toBeNull();
      expect(result.current.isAuditing).toBe(false);

      await act(async () => {
        await runningAudit;
      });
    } finally {
      pendingFetch.resolveAllPending();
      await act(async () => {
        await runningAudit;
      });
    }

    expect(result.current.auditResult).toBeNull();
    expect(result.current.auditError).toBeNull();
  });

  it('aborts active requests on clear without setting an audit error', async () => {
    const pendingFetch = createAbortAwareAuditFetch();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonAuditResponse({ audit_id: 'saved-audit', findings: [] }),
      )
      .mockImplementation(pendingFetch.fetchMock);
    global.fetch = fetchMock;

    const { result } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    await act(async () => {
      await result.current.runAudit();
    });

    let runningAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      runningAudit = result.current.runAudit({ forceAuditRefresh: true });
    });

    try {
      await act(async () => {
        result.current.clearAudit();
      });

      expect(pendingFetch.signals[0]?.aborted).toBe(true);
      await act(async () => {
        await runningAudit;
      });
    } finally {
      pendingFetch.resolveAllPending();
      await act(async () => {
        await runningAudit;
      });
    }

    expect(result.current.auditResult).toBeNull();
    expect(result.current.auditError).toBeNull();
    expect(result.current.isAuditing).toBe(false);
  });

  it('aborts a superseded persisted request without clearing the new spinner or report', async () => {
    const pendingFetch = createAbortAwareAuditFetch();
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        jsonAuditResponse({ audit_id: 'saved-audit', findings: [] }),
      )
      .mockImplementation(pendingFetch.fetchMock);
    global.fetch = fetchMock;

    const { result } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    await act(async () => {
      await result.current.runAudit();
    });

    let supersededAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      supersededAudit = result.current.runAudit({ forceAuditRefresh: true });
    });

    let currentAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      currentAudit = result.current.runAudit({ forceAuditRefresh: true });
      await supersededAudit;
    });

    try {
      expect(pendingFetch.signals[0]?.aborted).toBe(true);
      expect(result.current.auditResult?.auditId).toBe('saved-audit');
      expect(result.current.auditError).toBeNull();
      expect(result.current.isAuditing).toBe(true);

      pendingFetch.resolvePendingAt(1, {
        audit_id: 'current-audit',
        findings: [],
      });
      await act(async () => {
        await currentAudit;
      });
    } finally {
      pendingFetch.resolveAllPending();
      await act(async () => {
        await Promise.all([supersededAudit, currentAudit]);
      });
    }

    expect(result.current.auditResult?.auditId).toBe('current-audit');
    expect(result.current.auditError).toBeNull();
    expect(result.current.isAuditing).toBe(false);
  });

  it('aborts active requests when the hook unmounts', async () => {
    const pendingFetch = createAbortAwareAuditFetch();
    global.fetch = pendingFetch.fetchMock;

    const { result, unmount } = renderHook(() =>
      useSyfonStorageChain({
        currentPath: '',
        projectSelection: 'HTAN_INT/BForePC',
      }),
    );

    let runningAudit: Promise<StorageChainAuditResult | null> | undefined;
    await act(async () => {
      runningAudit = result.current.runAudit();
    });

    try {
      unmount();
      expect(pendingFetch.signals[0]?.aborted).toBe(true);
      await act(async () => {
        await runningAudit;
      });
    } finally {
      pendingFetch.resolveAllPending();
      await runningAudit;
    }
  });
});
