import type { ExplorerBuilderState } from '@gen3/core';
import {
  derivedOccurrences,
  nextRouteOccurrenceId,
  stateFromBuilder,
  workspaceFromState,
} from './model';
import { builderAuthoringReducer } from './reducer';

const ready: ExplorerBuilderState = {
  apiVersion: 'loom.calypr.org/explorer-authoring/v2',
  kind: 'ExplorerBuilderState',
  lifecycleState: 'READY',
  draftVersion: 1,
  draftDigest: 'sha256:draft',
  workspace: {
    apiVersion: 'loom.calypr.org/explorer-authoring/v2',
    kind: 'ExplorerBuilderWorkspace',
    explorer: { title: 'BForePC' },
    documents: [
      {
        kind: 'ExplorerBuilderDocument',
        output: { id: 'Specimen', title: 'Specimen' },
        rootResourceType: 'Specimen',
        route: { occurrenceId: 'base', resourceType: 'Specimen' },
        columns: [
          {
            column: 'specimen_identifier',
            label: 'HTAN_BIOSPECIMEN_ID',
            occurrenceId: 'base',
            source: {
              kind: 'identifierBySystem',
              match: 'https://aced-idp.org/project',
              projectionMode: 'FIRST',
            },
            table: { visible: true, order: 0 },
          },
        ],
      },
    ],
    tabs: [
      {
        id: 'specimen',
        title: 'Specimen',
        outputId: 'Specimen',
        order: 0,
        visible: true,
      },
    ],
  },
  catalog: {
    snapshotToken: 'snapshot',
    generation: 'generation',
    routePolicy: { allowRepeatedEdges: false, allowSelfLoops: false },
    nodes: [
      {
        nodeId: 'specimen-node',
        resourceType: 'Specimen',
        rowRootEligible: true,
        populated: true,
        documentCount: 1,
      },
    ],
    edges: [],
    candidates: [],
  },
};

describe('semantic Builder hydration', () => {
  it('reopens and recompiles the canonical workspace without reconstructing sources', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    expect(state.tables).toHaveLength(1);
    expect(workspaceFromState(state)).toEqual(ready.workspace);
  });

  it('does not serialize stale shared-filter bindings from preserved hot-reload state', () => {
    const state = stateFromBuilder(
      {
        ...ready,
        workspace: {
          ...ready.workspace!,
          sharedFilters: {
            document_reference_patient_identifier: [
              { outputId: 'Specimen', column: 'unknown_old_column' },
            ],
          },
        },
      },
      { project: 'project', explorerId: 'default' },
    );

    expect(workspaceFromState(state).sharedFilters).toBeUndefined();
  });

  it('serializes presentation edits from the V2 document into the next compile workspace', () => {
    const preview = {
      apiVersion: 'loom.calypr.org/explorer-authoring/v2' as const,
      kind: 'ExplorerBuilderPreview' as const,
      receiptId: 'receipt_preview',
      outputId: 'Specimen',
      columns: [],
      rows: [{ specimen_identifier: 'sample-1' }],
      rowCount: 1,
      diagnostics: [],
    };
    const state = {
      ...stateFromBuilder(ready, {
        project: 'project',
        explorerId: 'default',
      }),
      preview,
    };
    const original = state.tables[0].document.columns[0];
    const edited = builderAuthoringReducer(state, {
      type: 'updateColumn',
      outputId: 'Specimen',
      column: original.column,
      value: {
        ...original,
        label: 'Specimen identifier',
        table: { visible: false, order: 0 },
        filter: { label: 'Specimen identifier' },
        chart: { type: 'bar', title: 'Specimens' },
      },
    });

    expect(edited.dirty).toBe(true);
    expect(edited.reconciliation).toBe('idle');
    expect(edited.preview).toBe(preview);
    expect(workspaceFromState(edited).documents[0].columns[0]).toMatchObject({
      column: 'specimen_identifier',
      label: 'Specimen identifier',
      table: { visible: false, order: 0 },
      filter: { label: 'Specimen identifier' },
      chart: { type: 'bar', title: 'Specimens' },
      source: original.source,
    });
  });

  it('removes configured columns without candidate identity reconciliation', () => {
    const state = stateFromBuilder(
      {
        ...ready,
        workspace: {
          ...ready.workspace!,
          sharedFilters: {
            document_reference_patient_identifier: [
              { outputId: 'Specimen', column: 'specimen_identifier' },
            ],
          },
        },
      },
      {
        project: 'project',
        explorerId: 'default',
      },
    );
    const edited = builderAuthoringReducer(state, {
      type: 'removeColumn',
      outputId: 'Specimen',
      column: 'specimen_identifier',
    });

    expect(workspaceFromState(edited).documents[0].columns).toEqual([]);
    expect(workspaceFromState(edited).sharedFilters).toBeUndefined();
  });

  it('atomically removes old shared-filter bindings when starting a new query', () => {
    const state = stateFromBuilder(
      {
        ...ready,
        workspace: {
          ...ready.workspace!,
          sharedFilters: {
            document_reference_patient_identifier: [
              { outputId: 'Specimen', column: 'specimen_identifier' },
            ],
          },
        },
        catalog: {
          ...ready.catalog,
          nodes: [
            ...ready.catalog.nodes,
            {
              nodeId: 'patient-node',
              resourceType: 'Patient',
              rowRootEligible: true,
              populated: true,
              documentCount: 1,
            },
          ],
        },
      },
      {
        project: 'project',
        explorerId: 'default',
      },
    );
    const edited = builderAuthoringReducer(state, {
      type: 'changeRoot',
      outputId: 'Specimen',
      nodeId: 'patient-node',
    });

    expect(workspaceFromState(edited).documents[0].columns).toEqual([]);
    expect(workspaceFromState(edited).documents[0].route).toEqual({
      occurrenceId: 'base',
      resourceType: 'Patient',
    });
    expect(workspaceFromState(edited).sharedFilters).toBeUndefined();
  });

  it('adds a complete typed column without introducing candidate selection state', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    const edited = builderAuthoringReducer(state, {
      type: 'addColumn',
      outputId: 'Specimen',
      value: {
        column: 'birth_date',
        label: 'Birth date',
        logicalType: 'date',
        occurrenceId: 'base',
        source: {
          kind: 'field',
          fieldPath: 'birthDate',
          projectionMode: 'FIRST',
        },
        table: { visible: true, order: 1 },
      },
    });

    expect(workspaceFromState(edited).documents[0].columns[1]).toMatchObject({
      column: 'birth_date',
      source: { kind: 'field', fieldPath: 'birthDate' },
    });
  });

  it('does not serialize an invalid empty output title during reactive editing', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    const editing = builderAuthoringReducer(state, {
      type: 'renameTable',
      outputId: 'Specimen',
      title: '',
    });

    expect(workspaceFromState(editing).documents[0].output.title).toBe(
      'Specimen',
    );
    expect(workspaceFromState(editing).tabs[0].title).toBe('Specimen');
  });

  it('rejects READY state without authoring intent', () => {
    expect(() =>
      stateFromBuilder(
        { ...ready, workspace: null },
        { project: 'project', explorerId: 'default' },
      ),
    ).toThrow(/READY/);
  });

  it('keeps a refreshed catalog idle until compilation is requested', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    const refreshed = builderAuthoringReducer(state, {
      type: 'catalogRefreshed',
      catalog: { ...ready.catalog, snapshotToken: 'new-snapshot' },
    });
    expect(refreshed.reconciliation).toBe('idle');
    expect(refreshed.receipt).toBeUndefined();
    expect(refreshed.tables).toEqual(state.tables);
  });

  it('leaves an incomplete workspace editable after a catalog refresh', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    const incomplete = {
      ...state,
      tables: state.tables.map((table) => ({
        ...table,
        document: {
          ...table.document,
          rootResourceType: '',
          route: { occurrenceId: 'base', resourceType: '' },
        },
      })),
    };
    const refreshed = builderAuthoringReducer(incomplete, {
      type: 'catalogRefreshed',
      catalog: { ...ready.catalog, snapshotToken: 'new-snapshot' },
    });
    expect(refreshed.reconciliation).toBe('idle');
  });

  it('keeps a newly added blank table editable until a row root is selected', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    const blankTable = {
      outputId: 'blank-output',
      tabId: 'blank-tab',
      title: 'Blank table',
      document: {
        kind: 'ExplorerBuilderDocument' as const,
        output: { id: 'blank-output', title: 'Blank table' },
        rootResourceType: '',
        route: { occurrenceId: 'base', resourceType: '' },
        columns: [],
      },
    };

    const added = builderAuthoringReducer(state, {
      type: 'addTable',
      table: blankTable,
    });

    expect(added.reconciliation).toBe('idle');
    expect(added.selectedOutputId).toBe('blank-output');

    const rooted = builderAuthoringReducer(added, {
      type: 'setRoot',
      outputId: 'blank-output',
      nodeId: 'specimen-node',
    });
    expect(rooted.tables.at(-1)?.document.rootResourceType).toBe('Specimen');
    expect(rooted.reconciliation).toBe('idle');
  });

  it('hydrates, edits, and removes sibling branches without dropping unrelated routes', () => {
    const branched: ExplorerBuilderState = {
      ...ready,
      workspace: {
        ...ready.workspace!,
        sharedFilters: {
          participant: [
            { outputId: 'Specimen', column: 'patient__identifier' },
          ],
        },
        documents: [
          {
            ...ready.workspace!.documents[0],
            route: {
              occurrenceId: 'base',
              resourceType: 'Specimen',
              children: [
                {
                  occurrenceId: 'observation',
                  resourceType: 'Observation',
                  relationship: 'focus_Specimen',
                },
                {
                  occurrenceId: 'patient',
                  resourceType: 'Patient',
                  relationship: 'subject_Patient',
                },
              ],
            },
            columns: [
              ...ready.workspace!.documents[0].columns,
              {
                column: 'observation__status',
                label: 'Observation status',
                occurrenceId: 'observation',
                source: {
                  kind: 'field',
                  fieldPath: 'status',
                  projectionMode: 'FIRST',
                },
                table: { visible: true, order: 1 },
              },
              {
                column: 'patient__identifier',
                label: 'Participant',
                occurrenceId: 'patient',
                source: {
                  kind: 'field',
                  fieldPath: 'identifier[].value',
                  projectionMode: 'FIRST',
                },
                table: { visible: true, order: 2 },
              },
            ],
          },
        ],
      },
      catalog: {
        ...ready.catalog,
        nodes: [
          ...ready.catalog.nodes,
          {
            nodeId: 'observation-node',
            resourceType: 'Observation',
            rowRootEligible: true,
            populated: true,
            documentCount: 2,
          },
          {
            nodeId: 'patient-node',
            resourceType: 'Patient',
            rowRootEligible: true,
            populated: true,
            documentCount: 2,
          },
          {
            nodeId: 'condition-node',
            resourceType: 'Condition',
            rowRootEligible: true,
            populated: true,
            documentCount: 2,
          },
        ],
        edges: [
          {
            edgeId: 'specimen-observation',
            fromNodeId: 'specimen-node',
            toNodeId: 'observation-node',
            label: 'focus_Specimen',
          },
          {
            edgeId: 'specimen-patient',
            fromNodeId: 'specimen-node',
            toNodeId: 'patient-node',
            label: 'subject_Patient',
          },
          {
            edgeId: 'observation-condition',
            fromNodeId: 'observation-node',
            toNodeId: 'condition-node',
            label: 'focus_Condition',
          },
        ],
      },
    };
    const state = stateFromBuilder(branched, {
      project: 'project',
      explorerId: 'default',
    });
    expect(
      derivedOccurrences(state.tables[0], state.catalog).map(({ id }) => id),
    ).toEqual(['base', 'observation', 'patient']);
    expect(workspaceFromState(state)).toEqual(branched.workspace);

    const occurrenceId = nextRouteOccurrenceId(
      state.tables[0].document.route,
      'observation',
      'Condition',
      'focus_Condition',
    );
    const withNestedBranch = builderAuthoringReducer(state, {
      type: 'addRouteChild',
      outputId: 'Specimen',
      parentOccurrenceId: 'observation',
      edgeId: 'observation-condition',
      occurrenceId,
    });
    expect(occurrenceId).toBe('observation__condition');
    expect(
      derivedOccurrences(
        withNestedBranch.tables[0],
        withNestedBranch.catalog,
      ).map(({ id }) => id),
    ).toEqual(['base', 'observation', 'observation__condition', 'patient']);

    const edited = builderAuthoringReducer(withNestedBranch, {
      type: 'removeRouteSubtree',
      outputId: 'Specimen',
      occurrenceId: 'patient',
    });
    expect(
      derivedOccurrences(edited.tables[0], edited.catalog).map(({ id }) => id),
    ).toEqual(['base', 'observation', 'observation__condition']);
    expect(
      workspaceFromState(edited).documents[0].columns.map(
        (column) => column.column,
      ),
    ).toContain('observation__status');
    expect(
      workspaceFromState(edited).documents[0].columns.map(
        (column) => column.column,
      ),
    ).not.toContain('patient__identifier');
    expect(workspaceFromState(edited).sharedFilters).toBeUndefined();
  });

  it('replaces local identities with the authoritative command workspace', () => {
    const state = stateFromBuilder(ready, {
      project: 'project',
      explorerId: 'default',
    });
    const workspace = {
      ...ready.workspace!,
      documents: ready.workspace!.documents.map((document) => ({
        ...document,
        output: { ...document.output, id: 'out_backend' },
      })),
      tabs: ready.workspace!.tabs.map((tab) => ({
        ...tab,
        id: 'tab_backend',
        outputId: 'out_backend',
      })),
    };
    const next = builderAuthoringReducer(state, {
      type: 'commandsApplied',
      value: {
        commandId: 'command-1',
        workspace,
        draftVersion: 2,
        draftDigest: 'sha256:next',
        results: [
          {
            type: 'TABLE_CREATED',
            outputId: 'out_backend',
            tabId: 'tab_backend',
            occurrenceId: 'base',
          },
        ],
        diagnostics: [],
      },
    });
    expect(next.selectedOutputId).toBe('out_backend');
    expect(next.draftVersion).toBe(2);
    expect(next.workspace).toEqual(workspace);
    expect(next.reconciliation).toBe('idle');

    const requested = builderAuthoringReducer(next, {
      type: 'requestRecompile',
    });
    expect(requested.reconciliation).toBe('pending');
    expect(requested.dirty).toBe(true);
  });

  it('preserves the selected traversal node after a table presentation update', () => {
    const workspace = {
      ...ready.workspace!,
      documents: ready.workspace!.documents.map((document) => ({
        ...document,
        route: {
          ...document.route,
          children: [
            {
              occurrenceId: 'observation',
              resourceType: 'Observation',
              relationship: 'focus_Specimen',
            },
          ],
        },
      })),
    };
    const state = {
      ...stateFromBuilder(
        { ...ready, workspace },
        { project: 'project', explorerId: 'default' },
      ),
      selectedOccurrenceId: 'observation',
    };

    const next = builderAuthoringReducer(state, {
      type: 'commandsApplied',
      value: {
        commandId: 'command-2',
        workspace,
        draftVersion: 2,
        draftDigest: 'sha256:next',
        results: [
          {
            type: 'TABLE_CHANGED',
            outputId: 'Specimen',
            column: 'observation__status',
          },
        ],
        diagnostics: [],
      },
    });

    expect(next.selectedOccurrenceId).toBe('observation');
  });

  it('falls back to the root when the selected traversal node was removed', () => {
    const state = {
      ...stateFromBuilder(ready, {
        project: 'project',
        explorerId: 'default',
      }),
      selectedOccurrenceId: 'removed-occurrence',
    };

    const next = builderAuthoringReducer(state, {
      type: 'commandsApplied',
      value: {
        commandId: 'command-3',
        workspace: ready.workspace!,
        draftVersion: 2,
        draftDigest: 'sha256:next',
        results: [{ type: 'TABLE_CHANGED', outputId: 'Specimen' }],
        diagnostics: [],
      },
    });

    expect(next.selectedOccurrenceId).toBe('base');
  });
});
