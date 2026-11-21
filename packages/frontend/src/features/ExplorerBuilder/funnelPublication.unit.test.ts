import { publishDataframeThroughFunnel } from './funnelPublication';

jest.mock('@gen3/core', () => ({
  funnelApi: { endpoints: {
    createFunnelTask: { initiate: (body: unknown) => ({ action: 'create', body }) },
    getFunnelTask: { initiate: (id: string) => ({ action: 'status', id }) },
  } },
}));

describe('dataframe publication through Funnel', () => {
  const args = { project: 'HTAN_INT/BForePC', explorerId: 'dataframe-default', receiptId: 'receipt-a' };
  const result = { receiptId: args.receiptId, revisionId: 'revision-a' };

  beforeEach(() => sessionStorage.clear());

  it('submits pinned identifiers and resumes the same task for the same receipt', async () => {
    const dispatch = jest.fn(({ action }: { action: string }) => ({
      unwrap: async () => action === 'create' ? { id: 'funnel-1' } : { state: 'COMPLETE', publicationResult: result },
      reset: jest.fn(),
    }));
    const call = () => publishDataframeThroughFunnel(
      dispatch as unknown as Parameters<typeof publishDataframeThroughFunnel>[0],
      'HTAN_INT', 'BForePC', 'user-1', args, jest.fn(),
    );
    await expect(call()).resolves.toEqual(result);
    await expect(call()).resolves.toEqual(result);
    expect(dispatch.mock.calls.map(([action]) => action)).toEqual([
      { action: 'create', body: { name: 'Publish dataframe', tags: {
        'calypr.publish-dataframe': JSON.stringify({
          organization: 'HTAN_INT', project: 'BForePC', explorerId: args.explorerId, receiptId: args.receiptId,
        }),
      } } },
      { action: 'status', id: 'funnel-1' },
      { action: 'status', id: 'funnel-1' },
    ]);
  });

  it('keeps checking after COMPLETE if the executor result has not arrived', async () => {
    jest.useFakeTimers();
    try {
      let reads = 0;
      const report = jest.fn();
      const dispatch = jest.fn(({ action }: { action: string }) => ({
        unwrap: async () => action === 'create'
          ? { id: 'funnel-1' }
          : { state: 'COMPLETE', publicationResult: ++reads === 2 ? result : undefined },
        reset: jest.fn(),
      }));
      const publication = publishDataframeThroughFunnel(
        dispatch as unknown as Parameters<typeof publishDataframeThroughFunnel>[0],
        'HTAN_INT', 'BForePC', 'user-1', args, report,
      );
      await jest.advanceTimersByTimeAsync(0);
      expect(report).toHaveBeenCalledWith('Publication job completed. Waiting for Loom’s result. Funnel job funnel-1.');
      await jest.advanceTimersByTimeAsync(2000);
      await expect(publication).resolves.toEqual(result);
      expect(report).toHaveBeenLastCalledWith('Dataframe published.', 'funnel-1');
      expect(dispatch.mock.calls.filter(([action]) => action.action === 'create')).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

});
