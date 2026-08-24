import { explorerAuthoringApi } from '../explorerAuthoringApi';
import { authoringDocumentsV1 } from '../explorerAuthoring';
import { setupCoreStore } from '../../../store';

describe('Loom publish-only Builder V1 API', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as typeof global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it('prefers canonical plural documents over the legacy singular compatibility field', () => {
    const canonical = {
      kind: 'ExplorerBuilderDocument' as const,
      output: { id: 'patient' },
      baseNodeId: 'node-patient',
      rowNodeId: 'node-patient',
    };
    const legacy = {
      kind: 'ExplorerBuilderDocument' as const,
      output: { id: '' },
      baseNodeId: '',
      rowNodeId: '',
    };
    const bundle = {
      apiVersion: 'loom.calypr.org/explorer-authoring/v1' as const,
      kind: 'ExplorerAuthoringBundle' as const,
      project: 'p',
      explorerId: 'default',
      documents: [canonical],
      document: legacy,
    };

    expect(authoringDocumentsV1(bundle)).toEqual([canonical]);
    expect(authoringDocumentsV1({ ...bundle, documents: [] })).toEqual([legacy]);
  });

  it('uses summaries for collection selection and one combined Builder request', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', management: 'REPOSITORY', updatedAt: '2026-08-21T00:00:00Z' }]), { status: 200 }));
    const store = setupCoreStore();
    await store.dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringExplorersV1.initiate({ project: 'BForePC' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/explorers');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', bundle: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/BForePC', explorerId: 'default', documents: [] }, catalog: { snapshotToken: 'snap', generation: 'gen', nodes: [], edges: [], candidates: [] }, bindings: [], active: {}, diagnostics: [] }), { status: 200 }));
    await store.dispatch(explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.initiate({ project: 'BForePC', explorerId: 'default' })).unwrap();
    expect(String(fetchMock.mock.calls[1][0])).toContain('/explorers/default/authoring/v1/builder');
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ cache: 'no-store' });
  });

  it('normalizes nullable emissions and fieldRef-only candidates at the API boundary', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      apiVersion: 'loom.calypr.org/explorer-authoring/v1',
      kind: 'ExplorerBuilderState',
      project: 'HTAN_INT/BForePC',
      explorerId: 'default',
      title: 'Default',
      bundle: {
        apiVersion: 'loom.calypr.org/explorer-authoring/v1',
        kind: 'ExplorerAuthoringBundle',
        project: 'HTAN_INT/BForePC',
        explorerId: 'default',
        documents: [{
          kind: 'ExplorerBuilderDocument',
          output: { id: 'specimens' },
          baseNodeId: 'specimen-node',
          rowNodeId: 'specimen-node',
          candidateIds: null,
          routeOccurrences: null,
        }],
      },
      catalog: {
        snapshotToken: 'snap',
        generation: 'gen',
        nodes: [{ nodeId: 'specimen-node', resourceType: 'Specimen' }],
        routeEdges: [],
        candidates: [{
          candidateId: 'specimen-id',
          nodeId: 'specimen-node',
          fieldRef: 'Specimen.id',
          logicalType: 'string',
          filterable: true,
          chartable: false,
        }],
      },
      bindings: [{
        outputId: 'specimens',
        baseNodeId: 'specimen-node',
        baseResourceType: 'Specimen',
        rowNodeId: 'specimen-node',
        rowResourceType: 'Specimen',
        rowGrain: 'specimen',
        routeKind: 'ZERO_HOP',
        routeOccurrences: null,
        candidateEmissions: null,
      }],
      active: {},
      diagnostics: null,
    }), { status: 200 }));

    const builder = await setupCoreStore().dispatch(
      explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.initiate({
        project: 'BForePC',
        explorerId: 'default',
      }),
    ).unwrap();

    expect(builder.bindings[0].candidateEmissions).toEqual([]);
    expect(builder.bindings[0].routeOccurrences).toEqual([]);
    expect(builder.bundle.documents?.[0].candidateIds).toEqual([]);
    expect(builder.catalog.candidates[0].label).toBe('Specimen.id');
    expect(builder.catalog.edges).toEqual([]);
    expect(builder.diagnostics).toEqual([]);
  });

  it('sends only bundle intent and snapshot identity for preview and publish', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ outputId: 'out', columns: [], rows: [], rowCount: 0, snapshotToken: 'snap', diagnostics: [] }), { status: 200 }));
    const bundle = { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'p', explorerId: 'e', documents: [] } as const;
    const store = setupCoreStore();
    await store.dispatch(explorerAuthoringApi.endpoints.previewExplorerAuthoringV1.initiate({ project: 'p', explorerId: 'e', bundle, snapshotToken: 'snap', outputId: 'out', limit: 25, requestId: 'req-preview' })).unwrap();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ bundle, snapshotToken: 'snap', outputId: 'out', limit: 25 });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'p', explorerId: 'e', title: 'E', bundle, catalog: { snapshotToken: 'snap', generation: 'gen', nodes: [], edges: [], candidates: [] }, bindings: [], active: {}, diagnostics: [] }), { status: 200 }));
    await store.dispatch(explorerAuthoringApi.endpoints.publishExplorerAuthoringV1.initiate({ project: 'p', explorerId: 'e', bundle, snapshotToken: 'snap', requestId: 'req-publish' })).unwrap();
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({ bundle, snapshotToken: 'snap' });
  });

  it('invalidates the canonical Viewer state after publishing through a legacy project alias', async () => {
    const state = {
      apiVersion: 'loom.calypr.org/explorer-state/v1',
      kind: 'ExplorerState',
      project: 'HTAN_INT/BForePC',
      explorerId: 'default',
      title: 'Default',
      management: 'REPOSITORY',
      generated: { emittedColumns: [], materializations: [], dataset: { outputs: [] }, diagnostics: [] },
      runtime: { outputs: [], sharedFilters: {}, diagnostics: [] },
    };
    const bundle = { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/BForePC', explorerId: 'default', documents: [] } as const;
    const builderState = { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', bundle, catalog: { snapshotToken: 'snap', generation: 'gen', nodes: [], edges: [], candidates: [] }, bindings: [], active: {}, diagnostics: [] };
    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(builderState), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }));
    const store = setupCoreStore();
    const viewer = store.dispatch(explorerAuthoringApi.endpoints.getExplorerStateV1.initiate({ project: 'HTAN_INT/BForePC', explorerId: 'default' }));
    await viewer.unwrap();
    await store.dispatch(explorerAuthoringApi.endpoints.publishExplorerAuthoringV1.initiate({ project: 'HTAN_INT-BForePC', explorerId: 'default', bundle, snapshotToken: 'snap' })).unwrap();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    viewer.unsubscribe();
  });

  it('unwraps Loom service envelopes and preserves structured Builder errors', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { explorers: [{ project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', management: 'REPOSITORY', updatedAt: '2026-08-21T00:00:00Z' }] } }), { status: 200 }));
    const store = setupCoreStore();
    const summaries = await store.dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringExplorersV1.initiate({ project: 'BForePC' })).unwrap();
    expect(summaries[0].explorerId).toBe('default');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ data: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', bundle: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/BForePC', explorerId: 'default', documents: [] }, catalog: { snapshotToken: 'snap', generation: 'gen', nodes: [], edges: [], candidates: [] }, bindings: [], active: {}, diagnostics: [] } }), { status: 200 }));
    const builder = await store.dispatch(explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.initiate({ project: 'BForePC', explorerId: 'default' })).unwrap();
    expect(builder.catalog.snapshotToken).toBe('snap');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'FORBIDDEN', message: 'Project access denied.', diagnostics: [{ severity: 'error', stage: 'authorization', code: 'FORBIDDEN', message: 'Project access denied.' }] }), { status: 403, headers: { 'x-request-id': 'req-forbidden' } }));
    const failed = await store.dispatch(explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.initiate({ project: 'BForePC', explorerId: 'restricted' }));
    expect(failed).toMatchObject({ error: { status: 403, code: 'FORBIDDEN', message: 'Project access denied.', requestId: 'req-forbidden' } });
  });
});
