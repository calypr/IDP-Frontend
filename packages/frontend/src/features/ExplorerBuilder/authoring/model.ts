import type {
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCandidate,
  ExplorerBuilderCatalog,
  ExplorerBuilderCompileResult,
  ExplorerBuilderDocument,
  ExplorerBuilderEmission,
  ExplorerBuilderPreviewResult,
  ExplorerBuilderSelection,
  ExplorerBuilderState,
  ExplorerBuilderWorkspace,
  ExplorerPresentationIntent,
} from '@gen3/core';

export type PresentationBinding = ExplorerPresentationIntent;
export type DraftSelection = ExplorerBuilderSelection;

export interface DraftTable {
  readonly outputId: string;
  readonly tabId: string;
  readonly title: string;
  readonly visible?: boolean;
  readonly rootNodeId?: string;
  readonly routeSteps: ExplorerBuilderDocument['routeSteps'];
  readonly selections: ReadonlyArray<DraftSelection>;
  readonly presentation: Readonly<Record<string, PresentationBinding>>;
}

export interface DerivedOccurrence {
  readonly id: string;
  readonly index: number;
  readonly nodeId: string;
  readonly incomingEdgeId?: string;
}

export interface BuilderAuthoringState {
  readonly project: string;
  readonly explorerId: string;
  readonly catalog: ExplorerBuilderCatalog;
  readonly tables: ReadonlyArray<DraftTable>;
  readonly selectedOutputId?: string;
  readonly selectedOccurrenceId: string;
  readonly receipt?: ExplorerBuilderCompileResult;
  readonly emissions: ReadonlyArray<ExplorerBuilderEmission>;
  readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnostic>;
  readonly dirty: boolean;
  readonly reconciliation: 'idle' | 'pending' | 'resolved' | 'stale' | 'repair';
  readonly preview?: ExplorerBuilderPreviewResult;
}

export const selectionPresentationKey = ({
  candidateId,
  occurrenceId,
  projectionMode,
}: DraftSelection): string =>
  [candidateId, occurrenceId, projectionMode]
    .map((value) => encodeURIComponent(value))
    .join('::');

export const derivedOccurrences = (
  table: DraftTable | undefined,
  catalog: ExplorerBuilderCatalog,
): ReadonlyArray<DerivedOccurrence> => {
  if (!table?.rootNodeId) return [];
  const occurrences: DerivedOccurrence[] = [
    { id: 'base', index: 0, nodeId: table.rootNodeId },
  ];
  let tail = table.rootNodeId;
  table.routeSteps.forEach((step, stepIndex) => {
    const edge = catalog.edges.find(
      (candidate) =>
        candidate.edgeId === step.edgeId && candidate.fromNodeId === tail,
    );
    if (!edge) return;
    occurrences.push({
      id: step.occurrenceId ?? `step-${stepIndex + 1}`,
      index: stepIndex + 1,
      nodeId: edge.toNodeId,
      incomingEdgeId: edge.edgeId,
    });
    tail = edge.toNodeId;
  });
  return occurrences;
};

export const routeTailNodeId = (
  table: DraftTable | undefined,
  catalog: ExplorerBuilderCatalog,
): string | undefined => derivedOccurrences(table, catalog).at(-1)?.nodeId;

const tableFromDocument = (
  document: ExplorerBuilderDocument,
  tab: ExplorerBuilderWorkspace['tabs'][number] | undefined,
): DraftTable => ({
  outputId: document.output.id,
  tabId: tab?.id ?? document.output.id,
  title: tab?.title ?? document.output.title ?? document.output.id,
  visible: tab?.visible,
  rootNodeId: document.rootNodeId,
  routeSteps: document.routeSteps,
  selections: document.selections,
  presentation: document.presentation ?? {},
});

const tablesFromWorkspace = (
  workspace: ExplorerBuilderWorkspace | null | undefined,
): ReadonlyArray<DraftTable> => {
  if (!workspace) return [];
  const documents = new Map(
    workspace.documents.map((document) => [document.output.id, document]),
  );
  const tables = [...workspace.tabs]
    .sort((left, right) => left.order - right.order)
    .flatMap((tab) => {
      const document = documents.get(tab.outputId);
      return document ? [tableFromDocument(document, tab)] : [];
    });
  workspace.documents.forEach((document) => {
    if (!tables.some((table) => table.outputId === document.output.id)) {
      tables.push(tableFromDocument(document, undefined));
    }
  });
  return tables;
};

export const stateFromBuilder = (
  value: ExplorerBuilderState,
  identity: { readonly project: string; readonly explorerId: string },
): BuilderAuthoringState => {
  const tables = tablesFromWorkspace(value.workspace);
  return {
    ...identity,
    catalog: value.catalog,
    tables,
    selectedOutputId: tables[0]?.outputId,
    selectedOccurrenceId: 'base',
    diagnostics: [],
    emissions: [],
    dirty: false,
    reconciliation: value.workspace?.documents.length ? 'pending' : 'idle',
  };
};

export const completeDocument = (
  table: DraftTable,
  catalog: ExplorerBuilderCatalog,
): ExplorerBuilderDocument | undefined => {
  if (!table.rootNodeId) return undefined;
  const occurrenceIds = new Set(
    derivedOccurrences(table, catalog).map((occurrence) => occurrence.id),
  );
  const selections = table.selections.filter((selection) =>
    occurrenceIds.has(selection.occurrenceId),
  );
  const presentationKeys = new Set(selections.map(selectionPresentationKey));
  return {
    kind: 'ExplorerBuilderDocument',
    output: { id: table.outputId, title: table.title },
    rootNodeId: table.rootNodeId,
    routeSteps: table.routeSteps,
    selections,
    presentation: Object.fromEntries(
      Object.entries(table.presentation).filter(([key]) =>
        presentationKeys.has(key),
      ),
    ),
  };
};

export const workspaceFromState = (
  state: BuilderAuthoringState,
): ExplorerBuilderWorkspace => {
  const complete = state.tables.flatMap((table) => {
    const document = completeDocument(table, state.catalog);
    return document ? [{ table, document }] : [];
  });
  return {
    apiVersion: 'loom.calypr.org/explorer-authoring/v2',
    kind: 'ExplorerBuilderWorkspace',
    documents: complete.map(({ document }) => document),
    tabs: complete.map(({ table }, order) => ({
      id: table.tabId,
      title: table.title,
      outputId: table.outputId,
      order,
      visible: table.visible ?? true,
    })),
  };
};

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
};
export const intentFingerprint = (workspace: ExplorerBuilderWorkspace): string =>
  JSON.stringify(canonicalize(workspace));

export const selectedTable = (state: BuilderAuthoringState) =>
  state.tables.find((table) => table.outputId === state.selectedOutputId);

export const emissionsForOutput = (
  receipt: ExplorerBuilderCompileResult | undefined,
  outputId: string | undefined,
): ReadonlyArray<ExplorerBuilderEmission> =>
  receipt?.outputs.find((output) => output.outputId === outputId)?.emissions ??
  [];

export const selectedEmissions = (state: BuilderAuthoringState) =>
  state.emissions.filter(
    (emission) => emission.outputId === state.selectedOutputId,
  );

export const presentationForEmission = (
  table: DraftTable | undefined,
  emission: ExplorerBuilderEmission,
): PresentationBinding | undefined =>
  table?.presentation[
    selectionPresentationKey({
      candidateId: emission.candidateId,
      occurrenceId: emission.occurrenceId,
      projectionMode: emission.projectionMode,
    })
  ];

export const visibleEmissions = (state: BuilderAuthoringState) => {
  const table = selectedTable(state);
  return [...selectedEmissions(state)]
    .filter(
      (emission) => presentationForEmission(table, emission)?.visible !== false,
    )
    .sort(
      (left, right) =>
        (presentationForEmission(table, left)?.order ?? Number.MAX_SAFE_INTEGER) -
        (presentationForEmission(table, right)?.order ?? Number.MAX_SAFE_INTEGER),
    );
};

export const catalogCandidates = (
  catalog: ExplorerBuilderCatalog,
  nodeId: string | undefined,
): ReadonlyArray<ExplorerBuilderCandidate> =>
  (catalog.candidates ?? []).filter((candidate) => candidate.nodeId === nodeId);
