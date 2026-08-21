import { configureStore } from '@reduxjs/toolkit';
import { loomExplorerApi } from '../explorerApi';
import { userAuthApi } from '../../user/userSliceRTK';
import type { ExplorerConfigV2 } from '../explorer';

const document = {
  kind: 'ExplorerBuilderDocument',
  output: { id: 'patient', title: 'Patients' },
  baseNodeId: 'node-patient',
  rowNodeId: 'node-patient',
  candidateIds: [],
  presentation: {},
};

const canonicalState = {
  apiVersion: 'loom.calypr.org/explorer-state/v1',
  kind: 'ExplorerState',
  project: 'HTAN_INT/BForePC',
  explorerId: 'default',
  title: 'Default Explorer',
  management: 'REPOSITORY',
  draft: {
    bundle: {
      apiVersion: 'loom.calypr.org/explorer-authoring/v1',
      kind: 'ExplorerAuthoringBundle',
      project: 'HTAN_INT/BForePC',
      explorerId: 'default',
      documents: [document],
      tabs: [{ id: 'default', title: 'Patients', outputId: 'patient', order: 0 }],
    },
    version: 87,
    digest: 'sha256:draft',
  },
  active: {
    bundle: {
      apiVersion: 'loom.calypr.org/explorer-authoring/v1',
      kind: 'ExplorerAuthoringBundle',
      project: 'HTAN_INT/BForePC',
      explorerId: 'default',
      documents: [document],
    },
    revisionId: 'authoring-receipt',
    status: 'ACTIVE',
  },
  generated: {
    dataset: { outputs: [] },
    diagnostics: [],
  },
  runtime: {
    outputs: [
      {
        outputId: 'patient',
        name: 'patient',
        title: 'Patients',
        rowLabel: 'Patients',
        selector: {
          recipe: 'recipe-name',
          translationVersion: 'translation-v1',
          output: 'patient',
        },
        columns: [
          {
            emissionId: 'emission-patient-id',
            name: 'c_patient_id',
            label: 'Patient ID',
            logicalType: 'string',
            visible: true,
            order: 0,
            filterable: true,
            chartable: false,
          },
        ],
        table: {
          columns: [{ emissionId: 'emission-patient-id', visible: true }],
        },
        filters: [],
        charts: [],
        fixedFilters: {},
      },
    ],
    sharedFilters: {},
    diagnostics: [],
  },
  activeUrl: '/api/v1/projects/HTAN_INT%2FBForePC/explorers/default',
  updatedAt: '2026-08-20T21:00:00Z',
};

describe('canonical ExplorerStateV1 frontend compatibility', () => {
  it('accepts the summary-only Explorer collection response', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([
        {
          project: 'HTAN_INT/BForePC',
          explorerId: 'default',
          title: 'Default Explorer',
          management: 'REPOSITORY',
          activeRevisionId: 'revision-1',
          updatedAt: '2026-08-21T00:00:00Z',
        },
      ]), { status: 200 }),
    ) as typeof global.fetch;
    try {
      const store = configureStore({
        reducer: {
          loom: loomExplorerApi.reducer,
          [userAuthApi.reducerPath]: userAuthApi.reducer,
        },
        middleware: (getDefaultMiddleware) =>
          getDefaultMiddleware().concat(
            loomExplorerApi.middleware,
            userAuthApi.middleware,
          ),
      });
      const result = await store.dispatch(
        loomExplorerApi.endpoints.getExplorerConfigs.initiate('BForePC'),
      ).unwrap();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        project: 'HTAN_INT/BForePC',
        explorerId: 'default',
        management: 'REPOSITORY',
        activeRevisionId: 'revision-1',
      });
      expect(result[0].draftConfig).toBeUndefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('hydrates the restored V2 Builder model without changing Loom wire data', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify(canonicalState), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof global.fetch;
    try {
      const store = configureStore({
        reducer: {
          loom: loomExplorerApi.reducer,
          [userAuthApi.reducerPath]: userAuthApi.reducer,
        },
        middleware: (getDefaultMiddleware) =>
          getDefaultMiddleware().concat(
            loomExplorerApi.middleware,
            userAuthApi.middleware,
          ),
      });
      const result = await store.dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'HTAN_INT/BForePC',
          explorerId: 'default',
        }),
      ).unwrap();

      expect(result.draftConfig?.recipe.outputs?.[0]?.rootResourceType).toBe(
        'Patient',
      );
      expect(result.activeConfig?.views[0]?.table.columns).toEqual([
        { column: 'c_patient_id', visible: true },
      ]);
      expect(result.draftConfig?.recipe.name).toBe('recipe-name');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('drives the restored preview hook through one internal-compile request', async () => {
    const originalFetch = global.fetch;
    const config: ExplorerConfigV2 = {
      apiVersion: 'loom.calypr.org/explorer-config/v2',
      kind: 'ExplorerConfig',
      project: 'p',
      explorer: { id: 'default', title: 'Default', management: 'repository' },
      recipe: {
        name: 'legacy-runtime-name',
        outputs: [{ name: 'patient', rootResourceType: 'Patient', fields: [{ name: 'id', label: 'ID', selectionKey: 'Patient.id', valueSelector: 'Patient.id' }] }],
      },
      views: [{ id: 'patient', title: 'Patients', output: 'patient', table: { columns: [{ column: 'id', visible: true }] } }],
    };
    const responses = [
      { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/p', explorerId: 'default', bundle: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/p', explorerId: 'default', documents: [] }, catalog: { snapshotToken: 'snap-1', generation: 'generation-1', nodes: [{ nodeId: 'node-patient', resourceType: 'Patient' }, { nodeId: 'node-specimen', resourceType: 'Specimen' }], edges: [], candidates: [{ candidateId: 'candidate-id', nodeId: 'node-patient', fieldRef: 'Patient.id', logicalType: 'string', filterable: true, chartable: false }, { candidateId: 'wrong-resource-id', nodeId: 'node-specimen', fieldRef: 'Specimen.id', logicalType: 'string', filterable: true, chartable: false }] }, bindings: [], active: {}, diagnostics: [] },
      { outputId: 'patient', intentDigest: 'sha256:intent', snapshotToken: 'snap-1', sourceGeneration: 'generation-1', columns: [{ outputId: 'patient', candidateId: 'candidate-id', occurrenceId: 'base', publicColumn: 'c_patient_id', logicalType: 'string', filterable: true, chartable: false }], rows: [{ c_patient_id: 'p-1' }], rowCount: 1, diagnostics: [] },
    ];
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
    global.fetch = fetchMock as typeof global.fetch;
    try {
      const store = configureStore({
        reducer: {
          loom: loomExplorerApi.reducer,
          [userAuthApi.reducerPath]: userAuthApi.reducer,
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(loomExplorerApi.middleware, userAuthApi.middleware),
      });
      const preview = await store.dispatch(loomExplorerApi.endpoints.previewExplorerDraft.initiate({ project: 'p', explorerId: 'default', config, output: 'patient', limit: 25 })).unwrap();
      expect(preview.rows).toEqual([{ c_patient_id: 'p-1' }]);
      expect(preview.columns).toEqual([
        expect.objectContaining({
          name: 'id',
          rowKey: 'c_patient_id',
          candidateId: 'candidate-id',
          occurrenceId: 'base',
        }),
      ]);
      const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
      expect(String(calls[0]?.[0])).toContain('/authoring/v1/builder');
      expect(String(calls[1]?.[0])).toContain('/authoring/v1/preview');
      const previewBody = JSON.parse(String(calls[1]?.[1]?.body)) as Record<string, unknown>;
      expect(previewBody).not.toHaveProperty('config');
      expect(JSON.stringify(previewBody)).not.toContain('recipeName');
      expect(previewBody).toMatchObject({
        documents: [{
          candidateIds: ['candidate-id'],
          candidateOccurrences: [{ candidateId: 'candidate-id', occurrenceId: 'base' }],
        }],
      });
      expect(previewBody).toMatchObject({ snapshotToken: 'snap-1', outputId: 'patient', limit: 25 });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('drives the restored compile hook through the V1 intent compiler', async () => {
    const originalFetch = global.fetch;
    const config: ExplorerConfigV2 = {
      apiVersion: 'loom.calypr.org/explorer-config/v2',
      kind: 'ExplorerConfig',
      project: 'compile-project',
      explorer: { id: 'default', title: 'Default', management: 'repository' },
      recipe: {
        outputs: [{ name: 'patient', rootResourceType: 'Patient', fields: [{ name: 'id', label: 'ID', selectionKey: 'Patient.id', valueSelector: 'Patient.id' }] }],
      },
      views: [{ id: 'patient', title: 'Patients', output: 'patient', table: { columns: [{ column: 'id', visible: true }] } }],
    };
    const responses = [
      { snapshotToken: 'snap-compile', nodes: [{ nodeId: 'node-patient', resourceType: 'Patient' }], routeEdges: [], candidates: [{ candidateId: 'candidate-id', nodeId: 'node-patient', fieldRef: 'Patient.id', logicalType: 'string', filterable: true, chartable: false }] },
      { receiptId: 'receipt-1', documentDigest: 'doc-1', snapshotToken: 'snap-compile', diagnostics: [] },
    ];
    const fetchMock = jest.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200 }));
    global.fetch = fetchMock as typeof global.fetch;
    try {
      const store = configureStore({
        reducer: {
          loom: loomExplorerApi.reducer,
          [userAuthApi.reducerPath]: userAuthApi.reducer,
        },
        middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(loomExplorerApi.middleware, userAuthApi.middleware),
      });
      const compiled = await store.dispatch(loomExplorerApi.endpoints.compileExplorerAuthoring.initiate({ project: 'compile-project', explorerId: 'default', output: 'patient', config, snapshotToken: 'snap-compile', selectedCandidateIdsByNode: {} })).unwrap();
      const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
      expect(String(calls[0]?.[0])).toContain('/authoring/v1/builder');
      expect(String(calls[1]?.[0])).toContain('/authoring/v1/compile');
      const compileBody = JSON.parse(String(calls[1]?.[1]?.body)) as Record<string, unknown>;
      expect(compileBody).toMatchObject({ snapshotToken: 'snap-compile', scope: 'DOCUMENT' });
      expect(compileBody).not.toHaveProperty('config');
      expect(compiled.digest).toBe('doc-1');
      expect(compiled.emittedColumns).toEqual([expect.objectContaining({ name: 'id', logicalType: 'string' })]);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
