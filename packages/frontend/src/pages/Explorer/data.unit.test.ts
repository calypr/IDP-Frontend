jest.mock('../../lib/pageLoader', () => ({
  definePageLoader: jest.fn((config) => config),
}));
jest.mock('../../lib/common/staticProps', () => ({
  loadNavigationFromContext: jest.fn(),
}));
jest.mock('@gen3/core', () => ({
  canonicalLoomProjectId: (value: string) =>
    value.includes('/') ? value : value.replace('-', '/'),
  encodeLoomProjectPath: (value: string) =>
    encodeURIComponent(encodeURIComponent(value)),
  assertExplorerStateV1: (value: unknown) => value,
}));
import { loadExplorerStateV1 } from './data';
import type { ServerPageContext } from '../../lib/pageLoader';

const runtime = {
  outputs: [],
  sharedFilters: {},
  diagnostics: [],
};

const explorerState = {
  apiVersion: 'loom.calypr.org/explorer-state/v1',
  kind: 'ExplorerState',
  project: 'project/1',
  explorerId: 'default',
  title: 'Explorer',
  management: 'interactive',
  draft: { version: 1, digest: 'draft-digest' },
  active: {},
  generated: {},
  activeUrl: '/Explorer/project-1',
  runtime,
};

const contextFor = (
  query: Record<string, string | undefined>,
  response: unknown = explorerState,
) =>
  ({
    next: { query },
    loom: { get: jest.fn().mockResolvedValue(response) },
    problems: { add: jest.fn() },
  }) as unknown as ServerPageContext;

describe('Explorer page loader', () => {
  it('loads the canonical Explorer runtime during SSR', async () => {
    const context = contextFor({
      configId: 'project-1',
      explorerId: 'default',
    });
    await expect(loadExplorerStateV1(context)).resolves.toEqual({
      runtime,
      project: 'project/1',
      sharedFiltersMap: null,
    });
    expect(context.loom.get).toHaveBeenCalledWith(
      '/api/v1/projects/project%252F1/explorers/default',
    );
  });

  it('unwraps data envelopes and encodes canonical project paths', async () => {
    const context = contextFor(
      { configId: 'HTAN_INT-BForePC', explorerId: 'published explorer' },
      { data: { ...explorerState, project: 'HTAN_INT/BForePC' } },
    );
    await expect(loadExplorerStateV1(context)).resolves.toEqual({
      runtime,
      project: 'HTAN_INT/BForePC',
      sharedFiltersMap: null,
    });
    expect(context.loom.get).toHaveBeenCalledWith(
      '/api/v1/projects/HTAN_INT%252FBForePC/explorers/published%20explorer',
    );
  });

  it('keeps SSR failures recoverable by the browser revalidation', async () => {
    const context = contextFor({ configId: 'project-1' });
    (context.loom.get as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Loom request failed'), { status: 503 }),
    );

    await expect(loadExplorerStateV1(context)).resolves.toEqual({
      runtime: null,
      project: 'project/1',
      sharedFiltersMap: null,
    });
    expect(context.problems.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warning',
        source: 'loom',
        status: 503,
        retryable: true,
      }),
    );
  });

  it('reports a missing server runtime without blocking client recovery', async () => {
    const context = contextFor(
      { configId: 'project-1' },
      { ...explorerState, runtime: undefined },
    );

    await expect(loadExplorerStateV1(context)).resolves.toEqual({
      runtime: null,
      project: 'project/1',
      sharedFiltersMap: null,
    });
    expect(context.problems.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'warning',
        source: 'loom',
        status: 422,
        code: 'EXPLORER_RUNTIME_REQUIRED',
        retryable: false,
      }),
    );
  });

  it('still reports a missing route project during SSR', async () => {
    const context = contextFor({});
    await expect(loadExplorerStateV1(context)).resolves.toEqual({
      runtime: null,
      sharedFiltersMap: null,
    });
    expect(context.problems.add).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EXPLORER_NOT_FOUND' }),
    );
  });
});
