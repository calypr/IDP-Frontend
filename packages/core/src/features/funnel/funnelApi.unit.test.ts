jest.mock('../loom/loomApi', () => ({
  loomApi: { util: { invalidateTags: jest.fn() } },
}));
jest.mock('../gen3', () => ({
  gen3Api: { injectEndpoints: () => ({}) },
}));

import { parseTaskStatus } from './funnelApi';

describe('Funnel task status', () => {
  it('reads a dataframe publication acknowledgement only after task completion', () => {
    const result = { receiptId: 'receipt-a', revisionId: 'revision-a' };
    const logs = [{ logs: [{ stdout: `started\nLOOM_PUBLICATION_RESULT ${JSON.stringify(result)}\n` }] }];
    expect(parseTaskStatus({ id: 'task', state: 'RUNNING', logs }).publicationResult).toBeUndefined();
    expect(parseTaskStatus({ id: 'task', state: 'COMPLETE', logs }).publicationResult).toEqual(result);
    expect(parseTaskStatus({
      id: 'task',
      state: 'COMPLETE',
      logs: [{ logs: [{ stdout: 'LOOM_PUBLICATION_RESULT invalid' }] }],
    }).publicationResult).toBeUndefined();
  });

  it('reads executor output from the TES FULL view', () => {
    const status = parseTaskStatus({
      id: 'task',
      state: 'EXECUTOR_ERROR',
      logs: [
        {
          logs: [
            { exit_code: 1, stdout: 'Loom rejected this upload: HTTP 413\n' },
          ],
        },
      ],
    });
    expect(status.errorMessage).toBe('Loom rejected this upload: HTTP 413');
  });

  it('reads missing Syfon match warnings only after a successful source load', () => {
    const stdout =
      'LOOM_SOURCE_LOAD_RESULT ' +
      JSON.stringify({
        state: 'PUBLISHED',
        warnings: [{ code: 'MISSING_SYFON_MATCHES', count: 3 }],
      });
    const logs = [{ logs: [{ stdout }] }];

    expect(
      parseTaskStatus({ id: 'task', state: 'RUNNING', logs }).sourceLoadResult,
    ).toBeUndefined();
    expect(
      parseTaskStatus({ id: 'task', state: 'COMPLETE', logs }).sourceLoadResult,
    ).toEqual({
      state: 'PUBLISHED',
      warnings: [{ code: 'MISSING_SYFON_MATCHES', count: 3 }],
    });
    expect(
      parseTaskStatus({
        id: 'task',
        state: 'COMPLETE',
        logs: [{ logs: [{ stdout: 'LOOM_SOURCE_LOAD_RESULT malformed' }] }],
      }).sourceLoadResult,
    ).toBeUndefined();
  });

  it('recognizes a resumed load without a current match count', () => {
    const warnings = [{ code: 'RECONCILIATION_NOT_RECHECKED' }];
    const stdout = `LOOM_SOURCE_LOAD_RESULT ${JSON.stringify({ state: 'PUBLISHED', warnings })}`;
    const logs = [{ logs: [{ stdout }] }];
    expect(
      parseTaskStatus({ id: 'task', state: 'COMPLETE', logs }).sourceLoadResult,
    ).toEqual({ state: 'PUBLISHED', warnings });
  });

  it('reads system failures without displaying informational logs', () => {
    const status = parseTaskStatus({
      id: 'task',
      state: 'SYSTEM_ERROR',
      logs: [
        {
          system_logs: [
            "level='info' msg='Version'",
            "level='error' msg='PVC creation failed'",
          ],
        },
      ],
    });
    expect(status.errorMessage).toBe("level='error' msg='PVC creation failed'");
  });

  it('tolerates absent or malformed logs and hides output on successful tasks', () => {
    expect(
      parseTaskStatus({
        id: 'task',
        state: 'SYSTEM_ERROR',
        logs: [null, 'bad'],
      }).errorMessage,
    ).toBeUndefined();
    expect(
      parseTaskStatus({
        id: 'task',
        state: 'COMPLETE',
        logs: [{ logs: [{ stdout: 'done' }] }],
      }).errorMessage,
    ).toBeUndefined();
  });
});
