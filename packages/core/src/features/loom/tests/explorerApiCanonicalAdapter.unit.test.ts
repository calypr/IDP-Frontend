import { configureStore } from '@reduxjs/toolkit';
import { loomExplorerApi } from '../explorerApi';
import { explorerAuthoringApi } from '../explorerAuthoringApi';
import { userAuthApi } from '../../user/userSliceRTK';
import type { ExplorerConfigV2 } from '../explorer';
import { setupCoreStore } from '../../../store';

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
        outputs: [{ name: 'patient', rootResourceType: 'PatientProfile', fields: [{ name: 'id', label: 'ID', selectionKey: 'Patient.id', valueSelector: 'Patient.id' }] }],
      },
      views: [{ id: 'patient', title: 'Patients', output: 'patient', table: { columns: [{ column: 'id', visible: true }] } }],
    };
    const responses = [
      { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/p', explorerId: 'default', bundle: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/p', explorerId: 'default', documents: [{ ...document, candidateIds: ['candidate-id'], candidateOccurrences: [{ candidateId: 'candidate-id', occurrenceId: 'base' }, { candidateId: 'candidate-id', occurrenceId: 'secondary' }] }] }, catalog: { snapshotToken: 'snap-1', generation: 'generation-1', nodes: [{ nodeId: 'node-patient-decoy', resourceType: 'Patient' }, { nodeId: 'node-patient', resourceType: 'Patient' }, { nodeId: 'node-specimen', resourceType: 'Specimen' }], edges: [], candidates: [{ candidateId: 'candidate-id', nodeId: 'node-patient', fieldRef: 'Patient.id', logicalType: 'string', filterable: true, chartable: false }, { candidateId: 'wrong-resource-id', nodeId: 'node-specimen', fieldRef: 'Specimen.id', logicalType: 'string', filterable: true, chartable: false }] }, bindings: [{ outputId: 'patient', baseNodeId: 'node-patient', baseResourceType: 'PatientProfile', rowNodeId: 'node-patient', rowResourceType: 'PatientProfile', candidateEmissions: [{ candidateId: 'candidate-id', occurrenceId: 'base', emissionId: 'emission-base', label: 'ID', logicalType: 'string', filterable: true, chartable: false }, { candidateId: 'candidate-id', occurrenceId: 'secondary', emissionId: 'emission-secondary', label: 'ID', logicalType: 'string', filterable: true, chartable: false }] }], active: {}, diagnostics: [] },
      { outputId: 'patient', intentDigest: 'sha256:intent', snapshotToken: 'snap-1', sourceGeneration: 'generation-1', columns: [{ outputId: 'patient', emissionId: 'emission-base', candidateId: 'candidate-id', occurrenceId: 'base', publicColumn: 'c_patient_id', logicalType: 'string', filterable: true, chartable: false }, { outputId: 'patient', emissionId: 'emission-secondary', candidateId: 'candidate-id', occurrenceId: 'secondary', publicColumn: 'c_patient_secondary_id', logicalType: 'string', filterable: true, chartable: false }], rows: [{ c_patient_id: 'p-1' }, { c_patient_secondary_id: 'p-2' }], rowCount: 2, diagnostics: [] },
      { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerBuilderState', project: 'HTAN_INT/p', explorerId: 'default', bundle: { apiVersion: 'loom.calypr.org/explorer-authoring/v1', kind: 'ExplorerAuthoringBundle', project: 'HTAN_INT/p', explorerId: 'default', documents: [] }, catalog: { snapshotToken: 'snap-1', generation: 'generation-1', nodes: [], edges: [], candidates: [] }, bindings: [], active: { revisionId: 'revision-1' }, diagnostics: [] },
      { project: 'HTAN_INT/p', explorerId: 'default', management: 'REPOSITORY', activeRevisionId: 'revision-1', updatedAt: '2026-08-24T16:00:00Z', activeUrl: '/explorers/default' },
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
      expect(preview.rows).toEqual([
        { c_patient_id: 'p-1' },
        { c_patient_secondary_id: 'p-2' },
      ]);
      expect(preview.columns).toEqual([
        expect.objectContaining({
          name: 'id',
          rowKey: 'c_patient_id',
          emissionId: 'emission-base',
          candidateId: 'candidate-id',
          occurrenceId: 'base',
        }),
        expect.objectContaining({
          name: 'id',
          rowKey: 'c_patient_secondary_id',
          emissionId: 'emission-secondary',
          candidateId: 'candidate-id',
          occurrenceId: 'secondary',
        }),
      ]);
      const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit | undefined]>;
      expect(String(calls[0]?.[0])).toContain('/authoring/v1/builder');
      expect(String(calls[1]?.[0])).toContain('/authoring/v1/preview');
      const previewBody = JSON.parse(String(calls[1]?.[1]?.body)) as Record<string, unknown>;
      expect(previewBody).not.toHaveProperty('config');
      expect(previewBody).not.toHaveProperty('apiVersion');
      expect(previewBody).not.toHaveProperty('kind');
      expect(previewBody).not.toHaveProperty('documents');
      expect(JSON.stringify(previewBody)).not.toContain('recipeName');
      expect(previewBody.bundle).toMatchObject({
        apiVersion: 'loom.calypr.org/explorer-authoring/v1',
        kind: 'ExplorerAuthoringBundle',
        documents: [{
          baseNodeId: 'node-patient',
          rowNodeId: 'node-patient',
          candidateIds: ['candidate-id'],
          candidateOccurrences: [
            { candidateId: 'candidate-id', occurrenceId: 'base' },
            { candidateId: 'candidate-id', occurrenceId: 'secondary' },
          ],
        }],
      });
      expect(previewBody).toMatchObject({ snapshotToken: 'snap-1', outputId: 'patient', limit: 25 });

      const published = await store.dispatch(loomExplorerApi.endpoints.publishExplorer.initiate({ project: 'p', explorerId: 'default', config, expectedDraftVersion: 0 })).unwrap();
      expect(String(calls[2]?.[0])).toContain('/authoring/v1/publish');
      const publishBody = JSON.parse(String(calls[2]?.[1]?.body)) as Record<string, unknown>;
      expect(publishBody).toEqual({
        bundle: expect.objectContaining({
          apiVersion: 'loom.calypr.org/explorer-authoring/v1',
          kind: 'ExplorerAuthoringBundle',
          documents: [
            expect.objectContaining({
              candidateIds: ['candidate-id'],
              candidateOccurrences: [
                { candidateId: 'candidate-id', occurrenceId: 'base' },
                { candidateId: 'candidate-id', occurrenceId: 'secondary' },
              ],
              presentation: {
                'emission-base': expect.objectContaining({ visible: true }),
                'emission-secondary': expect.objectContaining({
                  visible: true,
                }),
              },
            }),
          ],
        }),
        snapshotToken: 'snap-1',
      });
      expect(published.activeConfig).toEqual(config);
      expect(published.draftConfig).toEqual(config);
      expect(published.activeRevisionId).toBe('revision-1');
      expect(calls.map(([url]) => String(url))).not.toEqual(
        expect.arrayContaining([
          expect.stringContaining('/authoring/v1/compile'),
          expect.stringContaining('/authoring/v1/draft'),
        ]),
      );
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

  it('publishes presentation order and refreshes the subscribed Builder state', async () => {
    const originalFetch = global.fetch;
    const config: ExplorerConfigV2 = {
      apiVersion: 'loom.calypr.org/explorer-config/v2',
      kind: 'ExplorerConfig',
      project: 'HTAN_INT/order-project',
      explorer: { id: 'default', title: 'Default', management: 'repository' },
      recipe: {
        outputs: [{
          name: 'patient',
          rootResourceType: 'Patient',
          fields: [
            { name: 'alpha', selectionKey: 'Patient.alpha', valueSelector: 'Patient.alpha' },
            { name: 'beta', selectionKey: 'Patient.beta', valueSelector: 'Patient.beta' },
          ],
        }],
      },
      views: [{
        id: 'patient',
        title: 'Patients',
        output: 'patient',
        table: {
          columns: [
            { column: 'beta', visible: true },
            { column: 'alpha', visible: true },
          ],
        },
      }],
    };
    const bundle = {
      apiVersion: 'loom.calypr.org/explorer-authoring/v1',
      kind: 'ExplorerAuthoringBundle',
      project: 'HTAN_INT/order-project',
      explorerId: 'default',
      documents: [{
        ...document,
        candidateIds: ['candidate-alpha', 'candidate-beta'],
        candidateOccurrences: [
          { candidateId: 'candidate-alpha', occurrenceId: 'base' },
          { candidateId: 'candidate-beta', occurrenceId: 'base' },
        ],
      }],
    };
    const builderState = {
      apiVersion: 'loom.calypr.org/explorer-authoring/v1',
      kind: 'ExplorerBuilderState',
      project: 'HTAN_INT/order-project',
      explorerId: 'default',
      title: 'Default',
      bundle,
      catalog: {
        snapshotToken: 'snap-order',
        generation: 'generation-order',
        nodes: [{ nodeId: 'node-patient', resourceType: 'Patient' }],
        edges: [],
        candidates: [
          { candidateId: 'candidate-alpha', nodeId: 'node-patient', fieldRef: 'Patient.alpha', label: 'alpha', logicalType: 'string', filterable: true, chartable: false },
          { candidateId: 'candidate-beta', nodeId: 'node-patient', fieldRef: 'Patient.beta', label: 'beta', logicalType: 'string', filterable: true, chartable: false },
        ],
      },
      bindings: [{
        outputId: 'patient',
        baseNodeId: 'node-patient',
        baseResourceType: 'Patient',
        rowNodeId: 'node-patient',
        rowResourceType: 'Patient',
        candidateEmissions: [
          { candidateId: 'candidate-alpha', occurrenceId: 'base', emissionId: 'emission-alpha' },
          { candidateId: 'candidate-beta', occurrenceId: 'base', emissionId: 'emission-beta' },
        ],
      }],
      active: {},
      diagnostics: [],
    };
    const activeState = {
      project: 'HTAN_INT/order-project',
      explorerId: 'default',
      management: 'REPOSITORY',
      activeRevisionId: 'revision-order',
      updatedAt: '2026-08-24T16:00:00Z',
      activeUrl: '/explorers/default',
    };
    const refreshedBuilderState = {
      ...builderState,
      active: { revisionId: 'revision-order' },
    };
    let builderReads = 0;
    const fetchMock = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/authoring/v1/builder')) {
        builderReads += 1;
        return new Response(
          JSON.stringify(
            builderReads >= 2 ? refreshedBuilderState : builderState,
          ),
          { status: 200 },
        );
      }
      if (url.endsWith('/authoring/v1/publish')) {
        return new Response(JSON.stringify(builderState), { status: 200 });
      }
      return new Response(JSON.stringify(activeState), { status: 200 });
    });
    global.fetch = fetchMock as typeof global.fetch;
    try {
      const store = setupCoreStore();
      const builderArgs = {
        project: 'HTAN_INT/order-project',
        explorerId: 'default',
      };
      const builderSubscription = store.dispatch(
        explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.initiate(
          builderArgs,
        ),
      );
      await builderSubscription.unwrap();

      await store.dispatch(
        loomExplorerApi.endpoints.publishExplorer.initiate({
          project: 'HTAN_INT/order-project',
          explorerId: 'default',
          config,
          expectedDraftVersion: 0,
        }),
      ).unwrap();

      for (let attempt = 0; attempt < 10; attempt += 1) {
        const revision =
          explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.select(
            builderArgs,
          )(store.getState()).data?.active.revisionId;
        if (revision === 'revision-order') break;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const calls = fetchMock.mock.calls as unknown as Array<
        [RequestInfo | URL, RequestInit | undefined]
      >;
      const publishBody = JSON.parse(
        String(
          calls.find(([url]) =>
            String(url).endsWith('/authoring/v1/publish'),
          )?.[1]?.body,
        ),
      ) as { bundle: { documents: Array<{ presentation: Record<string, { order: number }> }> } };
      expect(publishBody.bundle.documents[0].presentation).toMatchObject({
        'emission-alpha': { order: 1 },
        'emission-beta': { order: 0 },
      });
      expect(builderReads).toBe(3);
      expect(
        explorerAuthoringApi.endpoints.getExplorerBuilderStateV1.select(
          builderArgs,
        )(store.getState()).data?.active.revisionId,
      ).toBe('revision-order');
      builderSubscription.unsubscribe();
      store.dispatch(explorerAuthoringApi.util.resetApiState());
    } finally {
      global.fetch = originalFetch;
    }
  });
});
