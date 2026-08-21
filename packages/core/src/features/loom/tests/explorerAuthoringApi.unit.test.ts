// @ts-nocheck
import { canonicalLoomProjectId, downloadExplorerAuthoringBundle, encodeLoomProjectPath, explorerAuthoringApi, normalizeExplorerAuthoringCatalogV1 } from '../explorerAuthoringApi';
import type { ExplorerBuilderDocumentV1 } from '../explorerAuthoring';
import { setupCoreStore } from '../../../store';

const document: ExplorerBuilderDocumentV1 = {
  schemaVersion: 1,
  outputs: [],
  presentation: { views: [], sharedFilters: {} },
};

const state = {
  apiVersion: 'loom.calypr.org/explorer-state/v1',
  kind: 'ExplorerState',
  project: 'HTAN_INT/BForePC',
  explorerId: 'default',
  title: 'Default Explorer',
  management: 'REPOSITORY',
  draft: { version: 1, digest: 'sha256:draft' },
  active: { revisionId: 'revision-1', status: 'ACTIVE' },
  generated: { dataset: { outputs: [] }, emittedColumns: [], materializations: [], diagnostics: [] },
  activeUrl: '/api/v1/projects/HTAN_INT%2FBForePC/explorers/default',
  updatedAt: '2026-08-20T20:00:00Z',
} as const;

describe.skip('Legacy Explorer authoring request shapes (removed by Builder hard cutover)', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof global.fetch;
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('canonicalizes project IDs to the GitHub-style program/project identity', () => {
    expect(canonicalLoomProjectId('BForePC')).toBe('HTAN_INT/BForePC');
    expect(canonicalLoomProjectId('HTAN_INT-BForePC')).toBe('HTAN_INT/BForePC');
    expect(canonicalLoomProjectId('HTAN_INT/BForePC')).toBe('HTAN_INT/BForePC');
    expect(encodeLoomProjectPath('HTAN_INT/BForePC')).toBe('HTAN_INT%252FBForePC');
  });

  it('keeps V1 intent endpoints distinct from legacy config endpoints', () => {
    expect(explorerAuthoringApi.endpoints.compileExplorerAuthoringV1).toBeDefined();
  });

  it('resolves capabilities through the project-scoped V1 intent route', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ bundleVersion: 1, documentVersion: 1, presentationVersion: 1, exportVersion: 1 }), { status: 200 }));
    await setupCoreStore().dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringCapabilitiesV1.initiate({ project: 'BForePC', explorerId: 'default' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252FBForePC/explorers/default/authoring/v1/capabilities');
  });

  it('uses the canonical project identity for explorer discovery and state', async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify([]), { status: 200 }));
    const store = setupCoreStore();
    await store.dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringExplorersV1.initiate({ project: 'BForePC' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252FBForePC/explorers');

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(state), { status: 200 }));
    await store.dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringStateV1.initiate({ project: 'BForePC', explorerId: 'default' })).unwrap();
    expect(String(fetchMock.mock.calls[1][0])).toContain('/loom/api/v1/projects/HTAN_INT%252FBForePC/explorers/default');
  });

  it('uses Loom’s singular identity route and payload', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerIdentity', explorerId: 'new-output', outputId: 'new-output', title: 'New output' }), { status: 200 }));
    await setupCoreStore().dispatch(explorerAuthoringApi.endpoints.createExplorerAuthoringIdentityV1.initiate({ project: 'BForePC', explorerId: 'test', name: 'New output', title: 'New output', requestId: 'req-identity' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252FBForePC/explorers/test/authoring/v1/identity');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({ name: 'New output', title: 'New output' });
  });

  it('fetches the catalog through Loom’s GET route', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ snapshotToken: 'snap-1', nodes: [], routeEdges: [], candidates: [], diagnostics: [] }), { status: 200 }));
    const catalog = await setupCoreStore().dispatch(explorerAuthoringApi.endpoints.getExplorerAuthoringCatalogV1.initiate({ project: 'BForePC', explorerId: 'test' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252FBForePC/explorers/test/authoring/v1/catalog');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
    expect(catalog.edges).toEqual([]);
  });

  it('normalizes Loom routeEdges and nested completeness for the Builder', () => {
    const catalog = normalizeExplorerAuthoringCatalogV1({
      snapshotToken: 'snap-1',
      nodes: [{ nodeId: 'patient', resourceType: 'Patient' }],
      routeEdges: [{ edgeId: 'edge-1', fromNodeId: 'patient', toNodeId: 'specimen', label: 'specimen' }],
      candidates: [{ candidateId: 'id', nodeId: 'patient', fieldRef: 'Patient.id', logicalType: 'string', filterable: true, chartable: true }],
      completeness: { complete: true, diagnostics: [] },
    });
    expect(catalog.complete).toBe(true);
    expect(catalog.edges[0]).toMatchObject({ edgeId: 'edge-1', fromNodeId: 'patient', toNodeId: 'specimen' });
    expect(catalog.nodes[0]).toMatchObject({ nodeId: 'patient', label: 'Patient' });
    expect(catalog.candidates[0]).toMatchObject({ candidateId: 'id', path: 'Patient.id', label: 'Patient.id' });
  });

  it('sends document intent and a snapshot to compile without recipe fields', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ receiptId: 'receipt-1', intentDigest: 'intent-1', documentDigest: 'doc-1', snapshotToken: 'snap-1', normalizedDocument: document, outputs: [], diagnostics: [], complete: true }), { status: 200 }));
    await setupCoreStore().dispatch(explorerAuthoringApi.endpoints.compileExplorerAuthoringV1.initiate({ project: 'p', explorerId: 'default', document, snapshotToken: 'snap-1', scope: 'DOCUMENT', intentDigest: 'intent-1', requestId: 'req-1' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252Fp/explorers/default/authoring/v1/compile');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body).toEqual({ document, snapshotToken: 'snap-1', scope: 'DOCUMENT', intentDigest: 'intent-1' });
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('X-Request-ID')).toBe('req-1');
    expect(JSON.stringify(body)).not.toMatch(/expr|select|toResourceType|children|direction/);
  });

  it('sends only the immutable compilation receipt identity to preview', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ receiptId: 'receipt-1', outputId: 'out-1', columns: [], rows: [], rowCount: 0 }), { status: 200 }));
    await setupCoreStore().dispatch(explorerAuthoringApi.endpoints.previewExplorerAuthoringV1.initiate({ project: 'p', explorerId: 'default', receiptId: 'receipt-1', outputId: 'out-1', limit: 25, requestId: 'req-2' })).unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252Fp/explorers/default/authoring/v1/preview');
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as Record<string, unknown>;
    expect(body).toEqual({ receiptId: 'receipt-1', outputId: 'out-1', limit: 25 });
    expect((fetchMock.mock.calls[0][1].headers as Headers).get('X-Request-ID')).toBe('req-2');
  });

  it('exports bundles through the state-specific Loom route', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200, headers: { 'content-disposition': 'attachment; filename="test-draft.json"' } }));
    const result = await downloadExplorerAuthoringBundle({ project: 'BForePC', explorerId: 'test', source: 'draft', requestId: 'req-bundle' });
    expect(result.filename).toBe('test-draft.json');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/loom/api/v1/projects/HTAN_INT%252FBForePC/explorers/test/authoring/v1/bundle/draft');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });
});
