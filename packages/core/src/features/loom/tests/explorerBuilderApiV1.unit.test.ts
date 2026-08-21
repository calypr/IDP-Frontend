import { explorerAuthoringApi } from '../explorerAuthoringApi';
import { setupCoreStore } from '../../../store';

describe('Loom publish-only Builder V1 API', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock as typeof global.fetch; });
  afterEach(() => { global.fetch = originalFetch; });

  it('uses summaries for collection selection and one combined Builder request', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify([{ project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', management: 'REPOSITORY', updatedAt: '2026-08-21T00:00:00Z' }]), { status: 200 }));
    const store = setupCoreStore();
    await store.dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringExplorersV1.initiate({ project: 'BForePC' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/explorers');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/BForePC', explorerId: 'default', title: 'Default', bundle: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/BForePC', explorerId: 'default', documents: [] }, catalog: { snapshotToken: 'snap', generation: 'gen', nodes: [], edges: [], candidates: [] }, bindings: [], active: {}, diagnostics: [] }), { status: 200 }));
    await store.dispatch(explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.initiate({ project: 'BForePC', explorerId: 'default' })).unwrap();
    expect(String(fetchMock.mock.calls[1][0])).toContain('/explorers/default/authoring/v1/builder');
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
