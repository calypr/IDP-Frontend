import type {
  ExplorerBuilderCompileResult,
  ExplorerBuilderState,
} from '@gen3/core';
import {
  derivedOccurrences,
  selectionPresentationKey,
  stateFromBuilder,
  workspaceFromState,
} from './model';
import { builderAuthoringReducer } from './reducer';

const apiVersion = 'loom.calypr.org/explorer-authoring/v2' as const;
const catalog = {
  snapshotToken: 'snapshot',
  generation: 'generation',
  routePolicy: { allowRepeatedEdges: true, allowSelfLoops: true },
  nodes: [
    {
      nodeId: 'specimen',
      resourceType: 'Specimen',
      rowRootEligible: true,
      rowGrain: 'specimen',
      populated: true,
      documentCount: 4,
    },
    {
      nodeId: 'patient',
      resourceType: 'Patient',
      rowRootEligible: false,
      populated: true,
      documentCount: 2,
    },
  ],
  edges: [
    {
      edgeId: 'specimen-patient',
      fromNodeId: 'specimen',
      toNodeId: 'patient',
      label: 'subject',
    },
    {
      edgeId: 'patient-specimen',
      fromNodeId: 'patient',
      toNodeId: 'specimen',
      label: 'specimens',
    },
    {
      edgeId: 'specimen-self',
      fromNodeId: 'specimen',
      toNodeId: 'specimen',
      label: 'related',
    },
  ],
  candidates: [
    {
      candidateId: 'specimen-id',
      nodeId: 'specimen',
      label: 'Identifier',
      logicalType: 'string',
      filterable: true,
      chartable: false,
      projectionModes: ['VALUE', 'COUNT'],
      defaultProjectionMode: 'VALUE',
    },
  ],
};
const builderState = (): ExplorerBuilderState => ({
  apiVersion,
  kind: 'ExplorerBuilderState',
  catalog,
  workspace: {
    apiVersion,
    kind: 'ExplorerBuilderWorkspace',
    documents: [
      {
        kind: 'ExplorerBuilderDocument',
        output: { id: 'specimens', title: 'Biospecimens' },
        rootNodeId: 'specimen',
        routeSteps: [],
        selections: [],
        presentation: {},
      },
    ],
    tabs: [
      {
        id: 'tab-specimens',
        title: 'Biospecimens',
        outputId: 'specimens',
        order: 0,
      },
    ],
  },
});
const initial = () =>
  stateFromBuilder(builderState(), { project: 'p', explorerId: 'e' });

describe('V2 Builder authoring reducer', () => {
  it('stores only candidate, occurrence, and projection intent', () => {
    const selected = builderAuthoringReducer(initial(), {
      type: 'toggleCandidate',
      outputId: 'specimens',
      occurrenceId: 'base',
      candidateId: 'specimen-id',
      projectionMode: 'VALUE',
      selected: true,
    });
    const document = workspaceFromState(selected).documents[0];
    expect(document.selections).toEqual([
      {
        candidateId: 'specimen-id',
        occurrenceId: 'base',
        projectionMode: 'VALUE',
      },
    ]);
    expect(JSON.stringify(document)).not.toMatch(
      /baseNodeId|rowNodeId|routeEdgeIds|candidateIds|expr|selector/,
    );
  });

  it('allows eligible roots only', () => {
    const blank = builderAuthoringReducer(initial(), {
      type: 'addTable',
      table: {
        outputId: 'new',
        tabId: 'tab-new',
        title: 'New',
        routeSteps: [],
        selections: [],
        presentation: {},
      },
    });
    expect(
      builderAuthoringReducer(blank, {
        type: 'setRoot',
        outputId: 'new',
        nodeId: 'patient',
      }),
    ).toBe(blank);
    expect(
      builderAuthoringReducer(blank, {
        type: 'setRoot',
        outputId: 'new',
        nodeId: 'specimen',
      }).tables.at(-1)?.rootNodeId,
    ).toBe('specimen');
  });

  it('derives omitted and explicit occurrences across repeated and self-loop routes', () => {
    let state = builderAuthoringReducer(initial(), {
      type: 'appendEdge',
      outputId: 'specimens',
      edgeId: 'specimen-patient',
      occurrenceId: 'patient-step',
    });
    state = builderAuthoringReducer(state, {
      type: 'appendEdge',
      outputId: 'specimens',
      edgeId: 'patient-specimen',
      occurrenceId: 'specimen-again',
    });
    state = builderAuthoringReducer(state, {
      type: 'appendEdge',
      outputId: 'specimens',
      edgeId: 'specimen-self',
      occurrenceId: 'specimen-self',
    });
    expect(derivedOccurrences(state.tables[0], state.catalog)).toEqual([
      { id: 'base', index: 0, nodeId: 'specimen' },
      {
        id: 'patient-step',
        index: 1,
        nodeId: 'patient',
        incomingEdgeId: 'specimen-patient',
      },
      {
        id: 'specimen-again',
        index: 2,
        nodeId: 'specimen',
        incomingEdgeId: 'patient-specimen',
      },
      {
        id: 'specimen-self',
        index: 3,
        nodeId: 'specimen',
        incomingEdgeId: 'specimen-self',
      },
    ]);
    const loaded = {
      ...state.tables[0],
      routeSteps: [{ edgeId: 'specimen-patient' }],
    };
    expect(derivedOccurrences(loaded, state.catalog)[1].id).toBe('step-1');
  });

  it('changes projection and keeps presentation on the new selection identity', () => {
    let state = builderAuthoringReducer(initial(), {
      type: 'toggleCandidate',
      outputId: 'specimens',
      occurrenceId: 'base',
      candidateId: 'specimen-id',
      projectionMode: 'VALUE',
      selected: true,
    });
    const selection = state.tables[0].selections[0];
    state = builderAuthoringReducer(state, {
      type: 'setPresentation',
      outputId: 'specimens',
      selection,
      value: { label: 'Specimen', visible: true, filter: { label: 'Specimen' } },
    });
    state = builderAuthoringReducer(state, {
      type: 'setProjection',
      outputId: 'specimens',
      occurrenceId: 'base',
      candidateId: 'specimen-id',
      projectionMode: 'COUNT',
    });
    const next = state.tables[0].selections[0];
    expect(next.projectionMode).toBe('COUNT');
    expect(state.tables[0].presentation[selectionPresentationKey(next)]).toMatchObject({
      label: 'Specimen',
      filter: { label: 'Specimen' },
    });
  });

  it('invalidates one workspace receipt for table and presentation edits', () => {
    const receipt: ExplorerBuilderCompileResult = {
      apiVersion,
      kind: 'ExplorerBuilderReceipt',
      receiptId: 'receipt',
      snapshotToken: 'snapshot',
      builder: builderState().workspace!,
      outputs: [{ outputId: 'specimens', emissions: [] }],
      diagnostics: [],
    };
    const compiled = builderAuthoringReducer(initial(), {
      type: 'compiled',
      value: receipt,
    });
    const renamed = builderAuthoringReducer(compiled, {
      type: 'renameTable',
      outputId: 'specimens',
      title: 'Renamed',
    });
    expect(renamed.receipt).toBeUndefined();
    expect(renamed.reconciliation).toBe('pending');
  });

  it('refreshes only the catalog on stale recovery and preserves local edits', () => {
    const renamed = builderAuthoringReducer(initial(), {
      type: 'renameTable',
      outputId: 'specimens',
      title: 'Local title',
    });
    const refreshed = builderAuthoringReducer(renamed, {
      type: 'catalogRefreshed',
      catalog: { ...catalog, snapshotToken: 'snapshot-2' },
    });
    expect(refreshed.tables[0].title).toBe('Local title');
    expect(refreshed.catalog.snapshotToken).toBe('snapshot-2');
    expect(refreshed.reconciliation).toBe('stale');
  });

  it('adds, deletes, and reorders complete table/tab pairs', () => {
    let state = builderAuthoringReducer(initial(), {
      type: 'addTable',
      table: {
        outputId: 'patients',
        tabId: 'tab-patients',
        title: 'Patients',
        rootNodeId: 'specimen',
        routeSteps: [],
        selections: [],
        presentation: {},
      },
    });
    state = builderAuthoringReducer(state, {
      type: 'reorderTable',
      outputId: 'patients',
      before: 'specimens',
    });
    expect(workspaceFromState(state).tabs.map((tab) => tab.outputId)).toEqual([
      'patients',
      'specimens',
    ]);
    state = builderAuthoringReducer(state, {
      type: 'removeTable',
      outputId: 'specimens',
    });
    expect(workspaceFromState(state).documents.map((document) => document.output.id)).toEqual([
      'patients',
    ]);
  });
});
