import type {
  ExplorerAuthoringDiagnostic,
  ExplorerBuilderCatalog,
  ExplorerBuilderCompileResult,
  ExplorerBuilderDocument,
  ExplorerBuilderPreviewResult,
  ExplorerBuilderState,
  ExplorerBuilderWorkspace,
} from '@gen3/core';

export interface DraftTable {
  readonly outputId: string;
  readonly tabId: string;
  readonly title: string;
  readonly visible?: boolean;
  /** The V2 authoring document is the editable source of truth. */
  readonly document: ExplorerBuilderDocument;
}

export interface DerivedOccurrence {
  readonly id: string;
  readonly index: number;
  readonly nodeId: string;
  readonly incomingEdgeId?: string;
  readonly parentId?: string;
  readonly depth: number;
  readonly resourceType: string;
}

export interface BuilderAuthoringState {
  readonly project: string;
  readonly explorerId: string;
  readonly catalog: ExplorerBuilderCatalog;
  /** Canonical server workspace; typed source bindings are intentionally read-only. */
  readonly workspace: ExplorerBuilderWorkspace | null;
  readonly tables: ReadonlyArray<DraftTable>;
  readonly selectedOutputId?: string;
  readonly selectedOccurrenceId: string;
  readonly receipt?: ExplorerBuilderCompileResult;
  readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnostic>;
  readonly dirty: boolean;
  readonly reconciliation: 'idle' | 'pending' | 'resolved' | 'stale' | 'repair';
  readonly preview?: ExplorerBuilderPreviewResult;
}

export const derivedOccurrences = (
  table: DraftTable | undefined,
  catalog: ExplorerBuilderCatalog,
): ReadonlyArray<DerivedOccurrence> => {
  if (!table) return [];
  const occurrences: DerivedOccurrence[] = [];
  const walk = (
    route: ExplorerBuilderDocument['route'],
    parentNodeId: string | undefined,
    parentId: string | undefined,
    depth: number,
  ) => {
    const node = catalog.nodes.find(
      (candidate) => candidate.resourceType === route.resourceType,
    );
    if (!node) return;
    const edge = parentNodeId
      ? catalog.edges.find(
          (candidate) =>
            candidate.fromNodeId === parentNodeId &&
            candidate.toNodeId === node.nodeId &&
            candidate.label === route.relationship,
        )
      : undefined;
    if (parentNodeId && !edge) return;
    occurrences.push({
      id: route.occurrenceId,
      index: occurrences.length,
      nodeId: node.nodeId,
      incomingEdgeId: edge?.edgeId,
      parentId,
      depth,
      resourceType: route.resourceType,
    });
    route.children?.forEach((child) =>
      walk(child, node.nodeId, route.occurrenceId, depth + 1),
    );
  };
  walk(table.document.route, undefined, undefined, 0);
  return occurrences;
};

export const routeNode = (
  route: ExplorerBuilderDocument['route'],
  occurrenceId: string,
): ExplorerBuilderDocument['route'] | undefined => {
  if (route.occurrenceId === occurrenceId) return route;
  for (const child of route.children ?? []) {
    const found = routeNode(child, occurrenceId);
    if (found) return found;
  }
  return undefined;
};

export const routeSubtreeOccurrenceIds = (
  route: ExplorerBuilderDocument['route'],
): ReadonlySet<string> => {
  const values = new Set<string>();
  const walk = (node: ExplorerBuilderDocument['route']) => {
    values.add(node.occurrenceId);
    node.children?.forEach(walk);
  };
  walk(route);
  return values;
};

export const replaceRouteNode = (
  route: ExplorerBuilderDocument['route'],
  occurrenceId: string,
  update: (
    node: ExplorerBuilderDocument['route'],
  ) => ExplorerBuilderDocument['route'] | undefined,
): ExplorerBuilderDocument['route'] | undefined => {
  if (route.occurrenceId === occurrenceId) return update(route);
  const children = (route.children ?? []).flatMap((child) => {
    const next = replaceRouteNode(child, occurrenceId, update);
    return next ? [next] : [];
  });
  return { ...route, children: children.length ? children : undefined };
};

const routeIdPart = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '') || 'resource';

export const nextRouteOccurrenceId = (
  route: ExplorerBuilderDocument['route'],
  parentOccurrenceId: string,
  resourceType: string,
  relationship: string,
): string => {
  const used = routeSubtreeOccurrenceIds(route);
  const resource = routeIdPart(resourceType);
  const prefix = parentOccurrenceId === 'base' ? '' : `${parentOccurrenceId}__`;
  let base = `${prefix}${resource}`;
  if (used.has(base)) base = `${base}__${routeIdPart(relationship)}`;
  let value = base;
  let suffix = 2;
  while (used.has(value)) value = `${base}_${suffix++}`;
  return value;
};

const tableFromDocument = (
  document: ExplorerBuilderDocument,
  tab: ExplorerBuilderWorkspace['tabs'][number] | undefined,
): DraftTable => ({
  outputId: document.output.id,
  tabId: tab?.id ?? document.output.id,
  title: tab?.title ?? document.output.title ?? document.output.id,
  visible: tab?.visible,
  document,
});

const tablesFromWorkspace = (
  workspace: ExplorerBuilderWorkspace | null,
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
  if (value.lifecycleState === 'READY' && !value.workspace) {
    throw new Error('Loom violated the READY authoring-state invariant.');
  }
  const tables = tablesFromWorkspace(value.workspace);
  return {
    ...identity,
    catalog: value.catalog,
    workspace: value.workspace,
    tables,
    selectedOutputId: tables[0]?.outputId,
    selectedOccurrenceId: 'base',
    diagnostics: [],
    dirty: false,
    reconciliation: value.workspace?.documents.length ? 'pending' : 'idle',
  };
};

export const completeDocument = (
  table: DraftTable,
): ExplorerBuilderDocument | undefined => {
  const title = table.title.trim() || table.document.output.title;
  return {
    ...table.document,
    output: {
      ...table.document.output,
      id: table.outputId,
      title,
    },
  };
};

export const workspaceFromState = (
  state: BuilderAuthoringState,
): ExplorerBuilderWorkspace => {
  const complete = state.tables.flatMap((table) => {
    const document = completeDocument(table);
    return document ? [{ table, document }] : [];
  });
  const validColumns = new Map(
    complete.map(({ document }) => [
      document.output.id,
      new Set(document.columns.map((column) => column.column)),
    ]),
  );
  const sharedFilterEntries = Object.entries(
    state.workspace?.sharedFilters ?? {},
  ).flatMap(([name, bindings]) => {
    const retained = bindings.filter((binding) =>
      validColumns.get(binding.outputId)?.has(binding.column),
    );
    return retained.length ? [[name, retained] as const] : [];
  });
  return {
    ...state.workspace,
    apiVersion: 'loom.calypr.org/explorer-authoring/v2',
    kind: 'ExplorerBuilderWorkspace',
    explorer: state.workspace?.explorer ?? { title: state.explorerId },
    documents: complete.map(({ document }) => document),
    tabs: complete.map(({ table, document }, order) => ({
      id: table.tabId,
      title: document.output.title,
      outputId: table.outputId,
      order,
      visible: table.visible ?? true,
    })),
    sharedFilters: sharedFilterEntries.length
      ? Object.fromEntries(sharedFilterEntries)
      : undefined,
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
export const intentFingerprint = (
  workspace: ExplorerBuilderWorkspace,
): string => JSON.stringify(canonicalize(workspace));

export const selectedTable = (state: BuilderAuthoringState) =>
  state.tables.find((table) => table.outputId === state.selectedOutputId);
