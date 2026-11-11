jest.mock('../loom/loomApi', () => ({
  loomApi: { util: { invalidateTags: jest.fn() } },
}));
jest.mock('../gen3', () => ({
  gen3Api: { injectEndpoints: () => ({}) },
}));

import { parseTaskStatus } from './funnelApi';

describe('Funnel failure messages', () => {
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
