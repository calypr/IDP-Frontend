import { assertExplorerStateV1, isExplorerStateV1 } from '../explorerAuthoring';

const canonicalState = {
  apiVersion: 'loom.calypr.org/explorer-state/v1',
  kind: 'ExplorerState',
  project: 'HTAN_INT/BForePC',
  explorerId: 'default',
  title: 'Default Explorer',
  management: 'REPOSITORY',
  draft: { version: 87, digest: 'sha256:draft' },
  active: { revisionId: 'authoring_receipt', status: 'ACTIVE' },
  generated: {
    sourceGeneration: 'generation-1',
    emittedColumns: [],
    materializations: [],
    dataset: { outputs: [] },
    diagnostics: [],
  },
  activeUrl: '/api/v1/projects/HTAN_INT%2FBForePC/explorers/default',
  updatedAt: '2026-08-20T20:00:00Z',
  runtime: {
    outputs: [],
    sharedFilters: {},
    diagnostics: [],
  },
} as const;

describe('ExplorerStateV1 contract', () => {
  it('accepts Loom’s canonical lifecycle projection', () => {
    expect(isExplorerStateV1(canonicalState)).toBe(true);
    expect(assertExplorerStateV1(canonicalState)).toBe(canonicalState);
  });

  it('rejects legacy top-level lifecycle fields', () => {
    expect(isExplorerStateV1({ ...canonicalState, draftConfig: {} })).toBe(
      false,
    );
    expect(() =>
      assertExplorerStateV1({ ...canonicalState, activeConfig: {} }),
    ).toThrow('legacy Explorer configuration fields are not supported');
  });

  it('requires the complete server-owned runtime projection', () => {
    const { runtime: _runtime, ...missingRuntime } = canonicalState;
    expect(isExplorerStateV1(missingRuntime)).toBe(false);
    expect(
      isExplorerStateV1({
        ...canonicalState,
        runtime: {
          ...canonicalState.runtime,
          outputs: [{ columns: null }],
        },
      }),
    ).toBe(false);
  });
});
