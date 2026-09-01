import { setupCoreStore } from '../../../store';
import {
  explorerBuilderStateSchema,
  explorerBuilderCommandsResultSchema,
  explorerBuilderWorkspaceSchema,
} from '../explorerAuthoring';
import { explorerAuthoringApi } from '../explorerAuthoringApi';

const apiVersion = 'loom.calypr.org/explorer-authoring/v2' as const;
const candidate = {
  candidateId: 'candidate-id',
  nodeId: 'node-specimen',
  fieldPath: 'id',
  label: 'Specimen.id',
  logicalType: 'string',
  filterable: true,
  chartable: false,
  projectionModes: ['VALUE', 'FIRST'],
  defaultProjectionMode: 'VALUE',
};
const workspace = {
  apiVersion,
  kind: 'ExplorerBuilderWorkspace' as const,
  explorer: { title: 'Biospecimens' },
  documents: [
    {
      kind: 'ExplorerBuilderDocument' as const,
      output: { id: 'specimens', title: 'Biospecimens' },
      rootResourceType: 'Specimen',
      route: { occurrenceId: 'base', resourceType: 'Specimen' },
      columns: [
        {
          column: 'specimen_identifier',
          label: 'Identifier',
          logicalType: 'string',
          occurrenceId: 'base',
          source: {
            kind: 'field' as const,
            fieldPath: 'identifier[].value',
            projectionMode: 'FIRST' as const,
          },
          table: { visible: true, order: 0 },
        },
      ],
    },
  ],
  tabs: [
    {
      id: 'tab-specimens',
      title: 'Biospecimens',
      outputId: 'specimens',
      order: 0,
      visible: true,
    },
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
  lifecycleState: 'READY' as const,
  draftVersion: 1,
  draftDigest: 'sha256:draft',
  workspace,
  catalog,
};
const contractColumn = {
  column: 'specimen_identifier',
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
  outputs: [
    {
      outputId: 'specimens',
      title: 'Biospecimens',
      rowGrain: 'specimen',
      columns: [contractColumn],
    },
  ],
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

  it('strictly decodes NEW and READY lifecycle states', () => {
    expect(explorerBuilderWorkspaceSchema.parse(workspace)).toEqual(workspace);
    expect(
      explorerBuilderStateSchema.parse({
        ...builderState,
        lifecycleState: 'NEW',
        workspace: null,
      }),
    ).toMatchObject({ lifecycleState: 'NEW', workspace: null });
    expect(() =>
      explorerBuilderStateSchema.parse({
        ...builderState,
        lifecycleState: 'READY',
        workspace: null,
      }),
    ).toThrow();
    expect(() =>
      explorerBuilderWorkspaceSchema.parse({ ...workspace, legacy: true }),
    ).toThrow();
  });

  it('requires backend command responses to preserve empty column arrays', () => {
    const emptyColumns = {
      ...workspace,
      documents: workspace.documents.map((document) => ({
        ...document,
        columns: [],
      })),
    };
    const response = {
      commandId: 'command-empty',
      workspace: emptyColumns,
      draftVersion: 1,
      draftDigest: 'sha256:draft',
      results: [{ type: 'TABLE_CREATED' as const }],
      diagnostics: [],
    };
    expect(
      explorerBuilderCommandsResultSchema.parse(response).workspace,
    ).toEqual(emptyColumns);
    expect(() =>
      explorerBuilderCommandsResultSchema.parse({
        ...response,
        workspace: {
          ...emptyColumns,
          documents: emptyColumns.documents.map(
            ({ columns: _columns, ...document }) => document,
          ),
        },
      }),
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
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/authoring/v2/builder',
    );
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/authoring/v2/builder',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      workspace,
      snapshotToken: 'snapshot-1',
    });
    expect(fetchMock.mock.calls.flat().join(' ')).not.toContain(
      '/authoring/v1',
    );
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
            columns: [contractColumn],
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

  it('sends intent commands and reconciles by persisted draft identity', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            commandId: 'command-1',
            workspace,
            draftVersion: 2,
            draftDigest: 'sha256:draft-2',
            results: [
              {
                type: 'COLUMN_ADDED',
                outputId: 'specimens',
                column: 'specimen_status',
              },
            ],
            diagnostics: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(receipt), { status: 200 }),
      );
    const store = setupCoreStore();
    await store
      .dispatch(
        explorerAuthoringApi.endpoints.applyExplorerBuilderCommandsV2.initiate({
          project: 'BForePC',
          explorerId: 'custom',
          commandId: 'command-1',
          snapshotToken: 'snapshot-1',
          expectedDraftVersion: 1,
          expectedDraftDigest: 'sha256:draft',
          commands: [
            {
              type: 'ADD_COLUMN',
              outputId: 'specimens',
              occurrenceId: 'base',
              candidateId: 'candidate-id',
              projectionMode: 'VALUE',
              initialPresentation: 'FILTER',
              title: 'Status',
            },
          ],
        }),
      )
      .unwrap();
    await store
      .dispatch(
        explorerAuthoringApi.endpoints.reconcileExplorerBuilderV2.initiate({
          project: 'BForePC',
          explorerId: 'custom',
          snapshotToken: 'snapshot-1',
          draftVersion: 2,
          draftDigest: 'sha256:draft-2',
        }),
      )
      .unwrap();

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/authoring/v2/commands',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body))).toEqual({
      commandId: 'command-1',
      snapshotToken: 'snapshot-1',
      expectedDraftVersion: 1,
      expectedDraftDigest: 'sha256:draft',
      commands: [
        {
          type: 'ADD_COLUMN',
          outputId: 'specimens',
          occurrenceId: 'base',
          candidateId: 'candidate-id',
          projectionMode: 'VALUE',
          initialPresentation: 'FILTER',
          title: 'Status',
        },
      ],
    });
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/authoring/v2/reconcile',
    );
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toEqual({
      snapshotToken: 'snapshot-1',
      draftVersion: 2,
      draftDigest: 'sha256:draft-2',
    });
  });

  it('deletes an explorer through the project explorer resource', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = setupCoreStore();

    await store
      .dispatch(
        explorerAuthoringApi.endpoints.deleteExplorerAuthoring.initiate({
          project: 'HTAN_INT/BForePC',
          explorerId: 'custom explorer',
          authResourcePath: '/programs/HTAN_INT/projects/BForePC',
        }),
      )
      .unwrap();

    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/explorers/custom%20explorer?auth_resource_path=',
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });
});
