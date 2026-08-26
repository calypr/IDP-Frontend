import { setupCoreStore } from '../../../store';
import {
  explorerBuilderStateSchema,
  explorerBuilderWorkspaceSchema,
} from '../explorerAuthoring';
import { explorerAuthoringApi } from '../explorerAuthoringApi';

const apiVersion = 'loom.calypr.org/explorer-authoring/v2' as const;
const candidate = {
  candidateId: 'candidate-id',
  nodeId: 'node-specimen',
  label: 'Specimen.id',
  logicalType: 'string',
  filterable: true,
  chartable: false,
  projectionModes: ['VALUE', 'COUNT'],
  defaultProjectionMode: 'VALUE',
};
const workspace = {
  apiVersion,
  kind: 'ExplorerBuilderWorkspace' as const,
  documents: [
    {
      kind: 'ExplorerBuilderDocument' as const,
      output: { id: 'specimens', title: 'Biospecimens' },
      rootNodeId: 'node-specimen',
      routeSteps: [],
      selections: [
        {
          candidateId: candidate.candidateId,
          occurrenceId: 'base',
          projectionMode: 'VALUE',
        },
      ],
      presentation: {},
    },
  ],
  tabs: [
    { id: 'tab-specimens', title: 'Biospecimens', outputId: 'specimens', order: 0 },
  ],
};
const catalog = {
  snapshotToken: 'snapshot-1',
  generation: 'generation-1',
  routePolicy: { allowRepeatedEdges: true, allowSelfLoops: true },
  nodes: [
    {
      nodeId: 'node-specimen',
      resourceType: 'Specimen',
      rowRootEligible: true,
      rowGrain: 'specimen',
      populated: true,
      documentCount: 12,
    },
  ],
  edges: [],
  candidates: [candidate],
};
const builderState = {
  apiVersion,
  kind: 'ExplorerBuilderState' as const,
  workspace,
  catalog,
};
const emission = {
  outputId: 'specimens',
  candidateId: candidate.candidateId,
  occurrenceId: 'base',
  projectionMode: 'VALUE',
  emissionId: 'emission-id',
  publicColumn: 'c_specimen_id',
  label: 'Identifier',
  logicalType: 'string',
  filterable: true,
  chartable: false,
};
const receipt = {
  apiVersion,
  kind: 'ExplorerBuilderReceipt' as const,
  receiptId: 'receipt-1',
  snapshotToken: 'snapshot-1',
  builder: workspace,
  outputs: [{ outputId: 'specimens', emissions: [emission] }],
  diagnostics: [],
};

describe('native Loom Builder V2 API', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof global.fetch;
  });
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('strictly decodes workspaces and nullable new Explorer state', () => {
    expect(explorerBuilderWorkspaceSchema.parse(workspace)).toEqual(workspace);
    expect(
      explorerBuilderStateSchema.parse({ ...builderState, workspace: null }),
    ).toMatchObject({ workspace: null });
    expect(() =>
      explorerBuilderWorkspaceSchema.parse({ ...workspace, legacy: true }),
    ).toThrow();
  });

  it('uses only the V2 Builder resource with the exact compile body', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify(builderState), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(receipt), { status: 200 }),
      );
    const store = setupCoreStore();
    await store
      .dispatch(
        explorerAuthoringApi.endpoints.getExplorerBuilderStateV2.initiate({
          project: 'BForePC',
          explorerId: 'default',
          authResourcePath: '/programs/HTAN_INT/projects/BForePC',
        }),
      )
      .unwrap();
    await store
      .dispatch(
        explorerAuthoringApi.endpoints.compileExplorerBuilderV2.initiate({
          project: 'BForePC',
          explorerId: 'default',
          workspace,
          snapshotToken: 'snapshot-1',
        }),
      )
      .unwrap();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/authoring/v2/builder');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/authoring/v2/builder');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      workspace,
      snapshotToken: 'snapshot-1',
    });
    expect(fetchMock.mock.calls.flat().join(' ')).not.toContain('/authoring/v1');
  });

  it('previews and publishes by receipt only', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiVersion,
            kind: 'ExplorerBuilderPreview',
            receiptId: 'receipt-1',
            outputId: 'specimens',
            columns: [emission],
            rows: null,
            rowCount: 0,
            diagnostics: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            apiVersion,
            kind: 'ExplorerBuilderPublication',
            receiptId: 'receipt-1',
            revisionId: 'revision-1',
            state: 'READY',
            outputs: [{ outputId: 'specimens', state: 'READY' }],
            diagnostics: [],
          }),
          { status: 200 },
        ),
      );
    const store = setupCoreStore();
    await store
      .dispatch(
        explorerAuthoringApi.endpoints.previewExplorerAuthoringV2.initiate({
          project: 'BForePC',
          explorerId: 'default',
          receiptId: 'receipt-1',
          outputId: 'specimens',
          limit: 25,
        }),
      )
      .unwrap();
    await store
      .dispatch(
        explorerAuthoringApi.endpoints.publishExplorerAuthoringV2.initiate({
          project: 'BForePC',
          explorerId: 'default',
          receiptId: 'receipt-1',
        }),
      )
      .unwrap();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      receiptId: 'receipt-1',
      outputId: 'specimens',
      limit: 25,
    });
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      receiptId: 'receipt-1',
    });
  });
});
