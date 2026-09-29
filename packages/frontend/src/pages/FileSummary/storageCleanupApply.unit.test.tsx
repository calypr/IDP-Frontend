import { act, renderHook } from '@testing-library/react';

jest.mock('@gen3/core', () => ({
  GEN3_API: '/api',
  selectCSRFToken: jest.fn(),
  useCoreSelector: jest.fn(),
  useGetCSRFQuery: jest.fn(),
}));
jest.mock('../../lib/session/session', () => ({
  requestSessionLogout: jest.fn(),
}));

import { useSyfonStorageChain, useSyfonStorageCleanup } from './hooks';
import type { StorageChainAuditResult } from './storageTypes';

describe('useSyfonStorageCleanup apply payloads', () => {
  it('preserves broken probe evidence and valid access methods from a storage-chain audit', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock
      .mockResolvedValueOnce({
        text: jest.fn().mockResolvedValue(
          JSON.stringify({
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
  });
});
