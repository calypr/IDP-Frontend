jest.mock('../../lib/pageLoader', () => ({
  definePageLoader: jest.fn((config) => config),
}));
jest.mock('../../lib/common/staticProps', () => ({
  loadNavigationFromContext: jest.fn(),
}));
import { loadExplorerStateV1 } from './data';
import type { ServerPageContext } from '../../lib/pageLoader';

const contextFor = (query: Record<string, string | undefined>) => ({
  next: { query },
  loom: { get: jest.fn() },
  problems: { add: jest.fn() },
} as unknown as ServerPageContext);

describe('Explorer page shell loader', () => {
  it('leaves canonical Explorer state loading to the browser', async () => {
    const context = contextFor({ configId: 'project-1', explorerId: 'default' });
    await expect(loadExplorerStateV1(context)).resolves.toEqual({ runtime: null, project: 'project-1', sharedFiltersMap: null });
    expect(context.loom.get).not.toHaveBeenCalled();
  });

  it('still reports a missing route project during SSR', async () => {
    const context = contextFor({});
    await expect(loadExplorerStateV1(context)).resolves.toEqual({ runtime: null, sharedFiltersMap: null });
    expect(context.problems.add).toHaveBeenCalledWith(expect.objectContaining({ code: 'EXPLORER_NOT_FOUND' }));
  });
});
