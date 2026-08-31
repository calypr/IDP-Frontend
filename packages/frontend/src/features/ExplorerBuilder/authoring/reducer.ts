import type {
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCandidate,
  ExplorerBuilderCatalog,
  ExplorerBuilderColumn,
  ExplorerBuilderCompileResult,
  ExplorerBuilderCommandsResult,
  ExplorerBuilderPreviewResult,
  ExplorerBuilderState,
} from '@gen3/core';
import {
  derivedOccurrences,
  replaceRouteNode,
  routeNode,
  routeSubtreeOccurrenceIds,
  stateFromBuilder,
  stateFromCommands,
  type BuilderAuthoringState,
  type DraftTable,
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
  | {
      readonly type: 'renameTable';
      readonly outputId: string;
      readonly title: string;
    }
  | {
      readonly type: 'reorderTable';
      readonly outputId: string;
      readonly before?: string;
    }
  | {
      readonly type: 'setRoot';
      readonly outputId: string;
      readonly nodeId: string;
    }
  | {
      readonly type: 'changeRoot';
      readonly outputId: string;
      readonly nodeId: string;
    }
  | {
      readonly type: 'addRouteChild';
      readonly outputId: string;
      readonly parentOccurrenceId: string;
      readonly edgeId: string;
      readonly occurrenceId: string;
    }
  | {
      readonly type: 'removeRouteSubtree';
      readonly outputId: string;
      readonly occurrenceId: string;
    }
  | {
      readonly type: 'addColumn';
      readonly outputId: string;
      readonly value: ExplorerBuilderColumn;
    }
  | {
      readonly type: 'addColumns';
      readonly outputId: string;
      readonly values: ReadonlyArray<ExplorerBuilderColumn>;
    }
  | {
      readonly type: 'updateColumn';
      readonly outputId: string;
      readonly column: string;
      readonly value: ExplorerBuilderColumn;
    }
  | {
      readonly type: 'removeColumn';
      readonly outputId: string;
      readonly column: string;
    }
  | { readonly type: 'compiling' }
  | {
      readonly type: 'commandsApplied';
      readonly value: ExplorerBuilderCommandsResult;
    }
  | { readonly type: 'compiled'; readonly value: ExplorerBuilderCompileResult }
  | {
      readonly type: 'catalogRefreshed';
      readonly catalog: ExplorerBuilderCatalog;
    }
  | {
      readonly type: 'candidatesLoaded';
      readonly candidates: ReadonlyArray<ExplorerBuilderCandidate>;
    }
  | {
      readonly type: 'repair';
      readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnostic>;
    }
  | { readonly type: 'requestRecompile' }
  | { readonly type: 'preview'; readonly value?: ExplorerBuilderPreviewResult }
  | { readonly type: 'published' };

const reconcileSharedFilters = (
  state: BuilderAuthoringState,
): BuilderAuthoringState['workspace'] => {
  if (!state.workspace?.sharedFilters) return state.workspace;
  const columnsByOutput = new Map(
    state.tables.map((table) => [
      table.outputId,
      new Set(table.document.columns.map((column) => column.column)),
    ]),
  );
  const entries = Object.entries(state.workspace.sharedFilters).flatMap(
    ([name, bindings]) => {
      const retained = bindings.filter((binding) =>
        columnsByOutput.get(binding.outputId)?.has(binding.column),
      );
      return retained.length ? [[name, retained] as const] : [];
    },
  );
  return {
    ...state.workspace,
    sharedFilters: entries.length ? Object.fromEntries(entries) : undefined,
  };
};

const invalidate = (
  state: BuilderAuthoringState,
  { preservePreview = false }: { readonly preservePreview?: boolean } = {},
): BuilderAuthoringState => ({
  ...state,
  workspace: reconcileSharedFilters(state),
  receipt: undefined,
  preview: preservePreview ? state.preview : undefined,
  diagnostics: [],
  dirty: true,
  reconciliation: 'idle',
});

const updateTable = (
  state: BuilderAuthoringState,
  outputId: string,
  update: (table: DraftTable) => DraftTable,
  options?: { readonly preservePreview?: boolean },
): BuilderAuthoringState => {
  const current = state.tables.find((table) => table.outputId === outputId);
  if (!current) return state;
  return invalidate(
    {
      ...state,
      tables: state.tables.map((table) =>
        table.outputId === outputId ? update(table) : table,
      ),
    },
    options,
  );
};

const keepColumnReferences = (
  document: DraftTable['document'],
  columns: DraftTable['document']['columns'],
): DraftTable['document'] => {
  const names = new Set(columns.map((column) => column.column));
  return {
    ...document,
    columns,
    fixedFilters: document.fixedFilters?.filter((filter) =>
      names.has(filter.column),
    ),
    actions: document.actions?.map((action) => ({
      ...action,
      columns: action.columns?.filter((column) => names.has(column.column)),
    })),
  };
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
    case 'addTable': {
      const next = invalidate({
        ...state,
        tables: [...state.tables, action.table],
        selectedOutputId: action.table.outputId,
        selectedOccurrenceId: 'base',
      });
      return {
        ...next,
        reconciliation: 'idle',
      };
    }
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
      return { ...next, reconciliation: 'idle' };
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
      const currentRoot = state.catalog.nodes.find(
        (candidate) =>
          candidate.resourceType === table?.document.rootResourceType,
      );
      if (!table || (action.type === 'setRoot' && currentRoot)) return state;
      if (action.type === 'changeRoot' && currentRoot?.nodeId === action.nodeId)
        return state;
      return {
        ...updateTable(state, action.outputId, (current) => ({
          ...current,
          document: {
            ...current.document,
            rootResourceType: node.resourceType,
            route: {
              occurrenceId: 'base',
              resourceType: node.resourceType,
            },
            columns: [],
            fixedFilters: undefined,
            actions: undefined,
          },
        })),
        selectedOccurrenceId: 'base',
      };
    }
    case 'addRouteChild': {
      const table = state.tables.find(
        (candidate) => candidate.outputId === action.outputId,
      );
      const occurrences = derivedOccurrences(table, state.catalog);
      const parent = occurrences.find(
        (occurrence) => occurrence.id === action.parentOccurrenceId,
      );
      const edge = state.catalog.edges.find(
        (candidate) =>
          candidate.edgeId === action.edgeId &&
          candidate.fromNodeId === parent?.nodeId,
      );
      const target = state.catalog.nodes.find(
        (candidate) => candidate.nodeId === edge?.toNodeId,
      );
      if (!table || !parent || !edge || !target) return state;
      const repeated = occurrences.some(
        (occurrence) => occurrence.incomingEdgeId === edge.edgeId,
      );
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
      if (maxSteps && parent.depth + 1 > maxSteps) return state;
      const route = replaceRouteNode(
        table.document.route,
        action.parentOccurrenceId,
        (current) => ({
          ...current,
          children: [
            ...(current.children ?? []),
            {
              occurrenceId: action.occurrenceId,
              resourceType: target.resourceType,
              relationship: edge.label,
            },
          ],
        }),
      );
      if (!route) return state;
      return {
        ...updateTable(state, action.outputId, (current) => ({
          ...current,
          document: { ...current.document, route },
        })),
        selectedOccurrenceId: action.occurrenceId,
      };
    }
    case 'removeRouteSubtree': {
      const table = state.tables.find(
        (candidate) => candidate.outputId === action.outputId,
      );
      if (!table || action.occurrenceId === 'base') return state;
      const subtree = routeNode(table.document.route, action.occurrenceId);
      if (!subtree) return state;
      const removedOccurrences = routeSubtreeOccurrenceIds(subtree);
      const route = replaceRouteNode(
        table.document.route,
        action.occurrenceId,
        () => undefined,
      );
      if (!route) return state;
      const next = updateTable(state, action.outputId, (current) => {
        const columns = current.document.columns.filter(
          (column) => !removedOccurrences.has(column.occurrenceId),
        );
        return {
          ...current,
          document: {
            ...keepColumnReferences(current.document, columns),
            route,
          },
        };
      });
      return { ...next, selectedOccurrenceId: 'base' };
    }
    case 'addColumn':
      return updateTable(state, action.outputId, (table) => {
        if (
          table.document.columns.some(
            (column) => column.column === action.value.column,
          )
        )
          return table;
        return {
          ...table,
          document: {
            ...table.document,
            columns: [...table.document.columns, action.value],
          },
        };
      });
    case 'addColumns':
      return updateTable(state, action.outputId, (table) => {
        const names = new Set(
          table.document.columns.map((column) => column.column),
        );
        const additions = action.values.filter((column) => {
          if (names.has(column.column)) return false;
          names.add(column.column);
          return true;
        });
        if (!additions.length) return table;
        return {
          ...table,
          document: {
            ...table.document,
            columns: [...table.document.columns, ...additions],
          },
        };
      });
    case 'updateColumn':
      return updateTable(
        state,
        action.outputId,
        (table) => ({
          ...table,
          document: {
            ...table.document,
            columns: table.document.columns.map((column) =>
              column.column === action.column ? action.value : column,
            ),
          },
        }),
        { preservePreview: true },
      );
    case 'removeColumn':
      return updateTable(state, action.outputId, (table) => ({
        ...table,
        document: keepColumnReferences(
          table.document,
          table.document.columns.filter(
            (column) => column.column !== action.column,
          ),
        ),
      }));
    case 'compiling':
      return { ...state, reconciliation: 'pending', diagnostics: [] };
    case 'commandsApplied':
      return stateFromCommands(state, action.value);
    case 'compiled': {
      const normalized = stateFromBuilder(
        {
          apiVersion: 'loom.calypr.org/explorer-authoring/v2',
          kind: 'ExplorerBuilderState',
          lifecycleState: 'READY',
          draftVersion: state.draftVersion,
          draftDigest: state.draftDigest,
          workspace: action.value.builder,
          catalog: state.catalog,
        },
        { project: state.project, explorerId: state.explorerId },
      );
      const tables = normalized.tables;
      return {
        ...state,
        workspace: action.value.builder,
        tables,
        selectedOutputId: tables.some(
          (table) => table.outputId === state.selectedOutputId,
        )
          ? state.selectedOutputId
          : tables[0]?.outputId,
        receipt: action.value,
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
        diagnostics: [],
        reconciliation: 'idle',
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
      return {
        ...state,
        reconciliation: 'repair',
        diagnostics: action.diagnostics,
      };
    case 'requestRecompile':
      return {
        ...state,
        receipt: undefined,
        preview: undefined,
        diagnostics: [],
        reconciliation: 'pending',
      };
    case 'preview':
      return { ...state, preview: action.value };
    case 'published':
      return { ...state, dirty: false };
  }
};
