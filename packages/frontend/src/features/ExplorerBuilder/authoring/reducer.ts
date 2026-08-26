import type {
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCandidate,
  ExplorerBuilderCatalog,
  ExplorerBuilderCompileResult,
  ExplorerBuilderPreviewResult,
  ExplorerBuilderSelection,
  ExplorerBuilderState,
} from '@gen3/core';
import {
  derivedOccurrences,
  selectionPresentationKey,
  stateFromBuilder,
  type BuilderAuthoringState,
  type DraftTable,
  type PresentationBinding,
} from './model';

export type BuilderAction =
  | {
      readonly type: 'hydrate';
      readonly value: ExplorerBuilderState;
      readonly explorerId?: string;
    }
  | { readonly type: 'selectTable'; readonly outputId: string }
  | { readonly type: 'selectOccurrence'; readonly occurrenceId: string }
  | { readonly type: 'addTable'; readonly table: DraftTable }
  | { readonly type: 'removeTable'; readonly outputId: string }
  | { readonly type: 'renameTable'; readonly outputId: string; readonly title: string }
  | { readonly type: 'reorderTable'; readonly outputId: string; readonly before?: string }
  | { readonly type: 'setRoot'; readonly outputId: string; readonly nodeId: string }
  | { readonly type: 'changeRoot'; readonly outputId: string; readonly nodeId: string }
  | {
      readonly type: 'appendEdge';
      readonly outputId: string;
      readonly edgeId: string;
      readonly occurrenceId: string;
    }
  | { readonly type: 'truncateRoute'; readonly outputId: string; readonly occurrenceId: string }
  | {
      readonly type: 'toggleCandidate';
      readonly outputId: string;
      readonly occurrenceId: string;
      readonly candidateId: string;
      readonly projectionMode: string;
      readonly selected: boolean;
    }
  | {
      readonly type: 'setProjection';
      readonly outputId: string;
      readonly occurrenceId: string;
      readonly candidateId: string;
      readonly projectionMode: string;
    }
  | {
      readonly type: 'setPresentation';
      readonly outputId: string;
      readonly selection: ExplorerBuilderSelection;
      readonly value: PresentationBinding;
    }
  | { readonly type: 'compiling' }
  | { readonly type: 'compiled'; readonly value: ExplorerBuilderCompileResult }
  | { readonly type: 'catalogRefreshed'; readonly catalog: ExplorerBuilderCatalog }
  | { readonly type: 'candidatesLoaded'; readonly candidates: ReadonlyArray<ExplorerBuilderCandidate> }
  | { readonly type: 'repair'; readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnostic> }
  | { readonly type: 'requestRecompile' }
  | { readonly type: 'preview'; readonly value?: ExplorerBuilderPreviewResult }
  | { readonly type: 'published' };

const invalidate = (state: BuilderAuthoringState): BuilderAuthoringState => ({
  ...state,
  receipt: undefined,
  preview: undefined,
  diagnostics: [],
  dirty: true,
  reconciliation: 'pending',
});

const updateTable = (
  state: BuilderAuthoringState,
  outputId: string,
  update: (table: DraftTable) => DraftTable,
): BuilderAuthoringState => {
  const current = state.tables.find((table) => table.outputId === outputId);
  if (!current) return state;
  return invalidate({
    ...state,
    tables: state.tables.map((table) =>
      table.outputId === outputId ? update(table) : table,
    ),
  });
};

const sameSelection = (
  selection: ExplorerBuilderSelection,
  candidateId: string,
  occurrenceId: string,
) =>
  selection.candidateId === candidateId &&
  selection.occurrenceId === occurrenceId;

const keepPresentationFor = (
  presentation: DraftTable['presentation'],
  selections: ReadonlyArray<ExplorerBuilderSelection>,
) => {
  const keys = new Set(selections.map(selectionPresentationKey));
  return Object.fromEntries(
    Object.entries(presentation).filter(([key]) => keys.has(key)),
  );
};

export const builderAuthoringReducer = (
  state: BuilderAuthoringState,
  action: BuilderAction,
): BuilderAuthoringState => {
  switch (action.type) {
    case 'hydrate':
      return stateFromBuilder(action.value, {
        project: state.project,
        explorerId: action.explorerId ?? state.explorerId,
      });
    case 'selectTable':
      return state.tables.some((table) => table.outputId === action.outputId)
        ? {
            ...state,
            selectedOutputId: action.outputId,
            selectedOccurrenceId: 'base',
            preview: undefined,
          }
        : state;
    case 'selectOccurrence': {
      const table = state.tables.find(
        (candidate) => candidate.outputId === state.selectedOutputId,
      );
      return derivedOccurrences(table, state.catalog).some(
        (occurrence) => occurrence.id === action.occurrenceId,
      )
        ? { ...state, selectedOccurrenceId: action.occurrenceId }
        : state;
    }
    case 'addTable':
      return invalidate({
        ...state,
        tables: [...state.tables, action.table],
        selectedOutputId: action.table.outputId,
        selectedOccurrenceId: 'base',
        reconciliation: action.table.rootNodeId ? 'pending' : 'idle',
      });
    case 'removeTable': {
      const tables = state.tables.filter(
        (table) => table.outputId !== action.outputId,
      );
      const next = invalidate({
        ...state,
        tables,
        selectedOutputId:
          state.selectedOutputId === action.outputId
            ? tables[0]?.outputId
            : state.selectedOutputId,
        selectedOccurrenceId: 'base',
      });
      return { ...next, reconciliation: tables.length ? 'pending' : 'idle' };
    }
    case 'renameTable':
      return updateTable(state, action.outputId, (table) => ({
        ...table,
        title: action.title,
      }));
    case 'reorderTable': {
      const moving = state.tables.find(
        (table) => table.outputId === action.outputId,
      );
      if (!moving) return state;
      const tables = state.tables.filter(
        (table) => table.outputId !== action.outputId,
      );
      const index = action.before
        ? tables.findIndex((table) => table.outputId === action.before)
        : tables.length;
      tables.splice(index < 0 ? tables.length : index, 0, moving);
      return invalidate({ ...state, tables });
    }
    case 'setRoot':
    case 'changeRoot': {
      const node = state.catalog.nodes.find(
        (candidate) => candidate.nodeId === action.nodeId,
      );
      if (!node?.rowRootEligible) return state;
      const table = state.tables.find(
        (candidate) => candidate.outputId === action.outputId,
      );
      if (!table || (action.type === 'setRoot' && table.rootNodeId)) return state;
      if (action.type === 'changeRoot' && table.rootNodeId === action.nodeId)
        return state;
      return {
        ...updateTable(state, action.outputId, (current) => ({
          ...current,
          rootNodeId: action.nodeId,
          routeSteps: [],
          selections: [],
          presentation: {},
        })),
        selectedOccurrenceId: 'base',
      };
    }
    case 'appendEdge': {
      const table = state.tables.find(
        (candidate) => candidate.outputId === action.outputId,
      );
      const tail = derivedOccurrences(table, state.catalog).at(-1)?.nodeId;
      const edge = state.catalog.edges.find(
        (candidate) =>
          candidate.edgeId === action.edgeId && candidate.fromNodeId === tail,
      );
      if (!table?.rootNodeId || !edge) return state;
      const repeated = table.routeSteps.some((step) => step.edgeId === edge.edgeId);
      const allowsRepeated =
        state.catalog.routePolicy.allowRepeatedEdges ??
        state.catalog.routePolicy.repeatedEdges ??
        false;
      const allowsSelfLoop =
        state.catalog.routePolicy.allowSelfLoops ??
        state.catalog.routePolicy.selfLoops ??
        false;
      if (repeated && !allowsRepeated) return state;
      if (edge.fromNodeId === edge.toNodeId && !allowsSelfLoop) return state;
      const maxSteps = state.catalog.routePolicy.maxSteps;
      if (maxSteps && table.routeSteps.length >= maxSteps) return state;
      return updateTable(state, action.outputId, (current) => ({
        ...current,
        routeSteps: [
          ...current.routeSteps,
          { edgeId: action.edgeId, occurrenceId: action.occurrenceId },
        ],
      }));
    }
    case 'truncateRoute': {
      const table = state.tables.find(
        (candidate) => candidate.outputId === action.outputId,
      );
      const occurrences = derivedOccurrences(table, state.catalog);
      const occurrenceIndex = occurrences.findIndex(
        (occurrence) => occurrence.id === action.occurrenceId,
      );
      if (!table || occurrenceIndex < 0) return state;
      const retained = new Set(
        occurrences.slice(0, occurrenceIndex + 1).map(({ id }) => id),
      );
      return updateTable(state, action.outputId, (current) => {
        const selections = current.selections.filter((selection) =>
          retained.has(selection.occurrenceId),
        );
        return {
          ...current,
          routeSteps: current.routeSteps.slice(0, occurrenceIndex),
          selections,
          presentation: keepPresentationFor(current.presentation, selections),
        };
      });
    }
    case 'toggleCandidate': {
      const table = state.tables.find(
        (candidate) => candidate.outputId === action.outputId,
      );
      if (
        !derivedOccurrences(table, state.catalog).some(
          (occurrence) => occurrence.id === action.occurrenceId,
        )
      )
        return state;
      return updateTable(state, action.outputId, (current) => {
        const selections = action.selected
          ? [
              ...current.selections.filter(
                (selection) =>
                  !sameSelection(
                    selection,
                    action.candidateId,
                    action.occurrenceId,
                  ),
              ),
              {
                candidateId: action.candidateId,
                occurrenceId: action.occurrenceId,
                projectionMode: action.projectionMode,
              },
            ]
          : current.selections.filter(
              (selection) =>
                !sameSelection(
                  selection,
                  action.candidateId,
                  action.occurrenceId,
                ),
            );
        return {
          ...current,
          selections,
          presentation: keepPresentationFor(current.presentation, selections),
        };
      });
    }
    case 'setProjection':
      return updateTable(state, action.outputId, (table) => {
        const current = table.selections.find((selection) =>
          sameSelection(selection, action.candidateId, action.occurrenceId),
        );
        if (!current || current.projectionMode === action.projectionMode)
          return table;
        const next = { ...current, projectionMode: action.projectionMode };
        const previousKey = selectionPresentationKey(current);
        const nextKey = selectionPresentationKey(next);
        const presentation = { ...table.presentation };
        if (presentation[previousKey]) {
          presentation[nextKey] = presentation[previousKey];
          delete presentation[previousKey];
        }
        return {
          ...table,
          selections: table.selections.map((selection) =>
            selection === current ? next : selection,
          ),
          presentation,
        };
      });
    case 'setPresentation':
      return updateTable(state, action.outputId, (table) => ({
        ...table,
        presentation: {
          ...table.presentation,
          [selectionPresentationKey(action.selection)]: action.value,
        },
      }));
    case 'compiling':
      return { ...state, reconciliation: 'pending', diagnostics: [] };
    case 'compiled': {
      const normalized = stateFromBuilder(
        {
          apiVersion: 'loom.calypr.org/explorer-authoring/v2',
          kind: 'ExplorerBuilderState',
          workspace: action.value.builder,
          catalog: state.catalog,
        },
        { project: state.project, explorerId: state.explorerId },
      );
      const tables = normalized.tables.map((table) => {
        const local = state.tables.find(
          (candidate) => candidate.outputId === table.outputId,
        );
        const presentation = { ...table.presentation, ...local?.presentation };
        const output = action.value.outputs.find(
          (candidate) => candidate.outputId === table.outputId,
        );
        output?.emissions.forEach((emission, index) => {
          const key = selectionPresentationKey(emission);
          presentation[key] ??= {
            label: emission.label,
            visible: true,
            order: index,
            table: {},
          };
        });
        return { ...table, presentation };
      });
      return {
        ...state,
        tables,
        selectedOutputId:
          tables.some((table) => table.outputId === state.selectedOutputId)
            ? state.selectedOutputId
            : tables[0]?.outputId,
        receipt: action.value,
        emissions: action.value.outputs.flatMap((output) => output.emissions),
        diagnostics: action.value.diagnostics,
        reconciliation: action.value.diagnostics.some(
          (diagnostic) => diagnostic.severity === 'error',
        )
          ? 'repair'
          : 'resolved',
      };
    }
    case 'catalogRefreshed':
      return {
        ...state,
        catalog: action.catalog,
        receipt: undefined,
        preview: undefined,
        reconciliation: 'stale',
      };
    case 'candidatesLoaded': {
      const candidates = new Map(
        (state.catalog.candidates ?? []).map((candidate) => [
          candidate.candidateId,
          candidate,
        ]),
      );
      action.candidates.forEach((candidate) =>
        candidates.set(candidate.candidateId, candidate),
      );
      return {
        ...state,
        catalog: { ...state.catalog, candidates: [...candidates.values()] },
      };
    }
    case 'repair':
      return { ...state, reconciliation: 'repair', diagnostics: action.diagnostics };
    case 'requestRecompile':
      return { ...state, reconciliation: 'pending', diagnostics: [] };
    case 'preview':
      return { ...state, preview: action.value };
    case 'published':
      return { ...state, dirty: false };
  }
};
