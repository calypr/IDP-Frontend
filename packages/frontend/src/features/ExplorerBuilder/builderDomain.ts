import type {
  ExplorerConfigV2,
  ExplorerDiagnostic,
  ExplorerLifecycleMetadataV2,
  ExplorerTableColumnV2,
  ExplorerViewV2,
  RecipeFieldV2,
  RecipeOutputV2,
  RecipeTraversalV2,
} from '@gen3/core';

export type ResourceType =
  | 'Patient'
  | 'Specimen'
  | 'File'
  | 'DocumentReference'
  | 'ResearchSubject'
  | 'MedicationAdministration'
  | 'GroupMember'
  | string;

export interface GraphResource {
  readonly resourceType: ResourceType;
  readonly label: string;
  readonly count?: number;
  readonly fields: ReadonlyArray<CatalogCandidate>;
}

export interface GraphRelationship {
  readonly id: string;
  readonly source: ResourceType;
  readonly target: ResourceType;
  readonly label: string;
  readonly linkCount?: number;
  readonly cardinality?: string;
  readonly direction?: 'outbound' | 'inbound';
}

/** Keep only resources that can participate in a dataframe traversal. */
export const filterLinkedGraph = (
  resources: ReadonlyArray<GraphResource>,
  relationships: ReadonlyArray<GraphRelationship>,
): {
  readonly resources: ReadonlyArray<GraphResource>;
  readonly relationships: ReadonlyArray<GraphRelationship>;
} => {
  const populatedTypes = new Set(
    resources
      .filter((resource) => resource.count !== 0 && resource.fields.length > 0)
      .map((resource) => resource.resourceType),
  );
  const linkedTypes = new Set<string>();
  const usableRelationships = relationships.filter(
    (relationship) =>
      populatedTypes.has(relationship.source) &&
      populatedTypes.has(relationship.target),
  );
  usableRelationships.forEach((relationship) => {
    linkedTypes.add(relationship.source);
    linkedTypes.add(relationship.target);
  });
  return {
    resources: resources.filter(
      (resource) =>
        populatedTypes.has(resource.resourceType) &&
        linkedTypes.has(resource.resourceType),
    ),
    relationships: usableRelationships.filter(
      (relationship) =>
        linkedTypes.has(relationship.source) &&
        linkedTypes.has(relationship.target),
    ),
  };
};

/** Returns every resource reachable from a row root, with no UI depth cap. */
export const graphDistancesFromRoot = (
  root: ResourceType | undefined,
  relationships: ReadonlyArray<GraphRelationship>,
): ReadonlyMap<string, number> => {
  const distances = new Map<string, number>();
  if (!root) return distances;
  distances.set(root, 0);
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const distance = distances.get(current) ?? 0;
    for (const relationship of relationships) {
      const next =
        relationship.source === current
          ? relationship.target
          : relationship.target === current
            ? relationship.source
            : undefined;
      if (next && !distances.has(next)) {
        distances.set(next, distance + 1);
        queue.push(next);
      }
    }
  }
  return distances;
};

export interface CatalogCandidate {
  readonly id: string;
  readonly resourceType: ResourceType;
  readonly path: string;
  readonly label: string;
  readonly publicName?: string;
  readonly logicalType: string;
  readonly repeated: boolean;
  readonly populationCount?: number;
  readonly examples?: ReadonlyArray<string>;
  readonly family?: 'field' | 'catalog' | 'dynamic' | 'extension' | 'pivot';
  readonly recommended?: boolean;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
  readonly technicalDetails?: string;
  readonly selectionKey?: string;
  readonly valueSelector?: string;
  readonly familyName?: string;
  readonly familyKind?: string;
  readonly nodePath?: ReadonlyArray<string>;
  readonly output?: string;
  readonly population?: number;
  readonly selected?: boolean;
  readonly complete?: boolean;
  readonly diagnostic?: string;
  readonly extensionMapping?: string;
}

export interface CatalogSnapshot {
  readonly snapshotToken?: string;
  readonly catalogDigest?: string;
  readonly sourceGeneration?: string;
  readonly resolvedSchemaDigest?: string;
  readonly authScopeDigest?: string;
  readonly baseRecipeDigest?: string;
  readonly complete: boolean;
  readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
  readonly resources: ReadonlyArray<GraphResource>;
  readonly relationships: ReadonlyArray<GraphRelationship>;
}

export interface TraversalNode {
  readonly key: string;
  readonly resourceType: ResourceType;
  readonly label: string;
  readonly parentKey?: string;
  readonly relationshipId?: string;
  readonly children: ReadonlyArray<TraversalNode>;
  readonly selectedCandidateIds: ReadonlyArray<string>;
}

export interface BuilderColumn extends ExplorerTableColumnV2 {
  readonly logicalType?: string;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
}

export interface BuilderTableState {
  readonly output: string;
  readonly title: string;
  readonly rootResourceType?: ResourceType;
  readonly rowGrain?: string;
  readonly traversal: ReadonlyArray<TraversalNode>;
  readonly columns: ReadonlyArray<BuilderColumn>;
  readonly filters: ReadonlyArray<{
    readonly column: string;
    readonly label?: string;
  }>;
  readonly charts: ReadonlyArray<{
    readonly column: string;
    readonly type: 'pie';
    readonly title?: string;
  }>;
  readonly fixedFilters: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly actions: ReadonlyArray<{
    readonly type: string;
    readonly title: string;
    readonly output?: string;
    readonly columns?: ReadonlyArray<string>;
  }>;
}

export interface BuilderSessionState {
  readonly project: string;
  readonly explorerId: string;
  readonly management: 'REPOSITORY' | 'INTERACTIVE';
  readonly config: ExplorerConfigV2 | null;
  /** Last draft packet acknowledged by the server. */
  readonly serverDraftConfig: ExplorerConfigV2 | null;
  readonly activeConfig: ExplorerConfigV2 | null;
  readonly draftVersion: number;
  readonly draftDigest: string;
  readonly activeRevisionId?: string;
  readonly updatedAt?: string;
  readonly publishedAt?: string;
  readonly activeUrl?: string;
  readonly shareUrl?: string;
  /** Server-produced digests and frozen materialization facts for the current
   * draft/publication. They never participate in local recipe editing. */
  readonly lifecycleMetadata: ExplorerLifecycleMetadataV2;
  readonly selectedOutput?: string;
  readonly selectedResource?: ResourceType;
  readonly selectedNodeKey?: string;
  readonly expandedNodes: ReadonlySet<string>;
  readonly catalog: CatalogSnapshot;
  /** Snapshot-scoped candidate selections never serialized into ExplorerConfig. */
  readonly selectedCandidateIdsByNode: Readonly<
    Record<string, ReadonlyArray<string>>
  >;
  readonly dirty: boolean;
  readonly lifecycle:
    | 'idle'
    | 'saving'
    | 'publishing'
    | 'saved'
    | 'published'
    | 'error';
  readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
  readonly conflict?: {
    readonly currentVersion?: number;
    readonly currentDigest?: string;
    readonly updatedAt?: string;
  };
  /** Successful previews are retained by their complete output/digest key. */
  readonly previewCache: Readonly<Record<string, PreviewState>>;
  readonly preview: Readonly<Record<string, PreviewState>>;
}

export interface PreviewState {
  readonly digest: string;
  readonly status: 'idle' | 'loading' | 'ready' | 'error';
  readonly data?: {
    readonly output: string;
    readonly columns: ReadonlyArray<{
      readonly name: string;
      readonly logicalType?: string;
      readonly filterable?: boolean;
      readonly chartable?: boolean;
    }>;
    readonly rows: ReadonlyArray<Record<string, unknown>>;
    readonly rowCount: number;
  };
  readonly error?: string;
}

export type BuilderAction =
  | {
      readonly type: 'load';
      readonly state: Pick<
        BuilderSessionState,
        | 'config'
        | 'serverDraftConfig'
        | 'activeConfig'
        | 'draftVersion'
        | 'draftDigest'
        | 'activeRevisionId'
        | 'management'
        | 'lifecycleMetadata'
      >;
    }
  | { readonly type: 'selectOutput'; readonly output?: string }
  | {
      readonly type: 'selectResource';
      readonly resource?: ResourceType;
      readonly nodeKey?: string;
    }
  | { readonly type: 'toggleNode'; readonly key: string }
  | { readonly type: 'setCatalog'; readonly catalog: CatalogSnapshot }
  | {
      readonly type: 'setRoot';
      readonly output: string;
      readonly resourceType: ResourceType;
      readonly label?: string;
    }
  | {
      readonly type: 'addTraversal';
      readonly output: string;
      readonly relationship: GraphRelationship;
    }
  | {
      readonly type: 'removeTraversal';
      readonly output: string;
      readonly nodeKey: string;
    }
  | {
      readonly type: 'setCandidate';
      readonly output: string;
      readonly nodeKey: string;
      readonly candidate: CatalogCandidate;
      readonly selected: boolean;
    }
  | {
      readonly type: 'setColumnLabel';
      readonly output: string;
      readonly column: string;
      readonly label: string;
    }
  | {
      readonly type: 'setColumnVisible';
      readonly output: string;
      readonly column: string;
      readonly visible: boolean;
    }
  | {
      readonly type: 'reorderColumn';
      readonly output: string;
      readonly column: string;
      readonly before?: string;
    }
  | {
      readonly type: 'setFilter';
      readonly output: string;
      readonly column: string;
      readonly enabled: boolean;
      readonly label?: string;
    }
  | {
      readonly type: 'setChart';
      readonly output: string;
      readonly column: string;
      readonly enabled: boolean;
      readonly title?: string;
    }
  | {
      readonly type: 'setFixedFilter';
      readonly output: string;
      readonly column: string;
      readonly values: ReadonlyArray<string>;
    }
  | {
      readonly type: 'clearFixedFilter';
      readonly output: string;
      readonly column: string;
    }
  | {
      readonly type: 'setSharedFilter';
      readonly name: string;
      readonly mappings: ReadonlyArray<{
        readonly output: string;
        readonly column: string;
        readonly label?: string;
        readonly logicalType?: string;
      }>;
    }
  | { readonly type: 'removeSharedFilter'; readonly name: string }
  | {
      readonly type: 'addAction';
      readonly output: string;
      readonly action: BuilderTableState['actions'][number];
    }
  | {
      readonly type: 'removeAction';
      readonly output: string;
      readonly index: number;
    }
  | {
      readonly type: 'setFileAction';
      readonly name: string;
      readonly targetRoute: string;
    }
  | { readonly type: 'removeFileAction'; readonly name: string }
  | {
      readonly type: 'setFileActionExtensions';
      readonly extension: string;
      readonly actions: ReadonlyArray<string>;
    }
  | { readonly type: 'removeTable'; readonly output: string }
  | {
      readonly type: 'addTable';
      readonly output: string;
      readonly title: string;
    }
  | {
      readonly type: 'duplicateTable';
      readonly output: string;
      readonly sourceOutput: string;
      readonly title: string;
    }
  | {
      readonly type: 'renameTable';
      readonly output: string;
      readonly title: string;
    }
  | {
      readonly type: 'editMetadata';
      readonly title?: string;
      readonly description?: string;
    }
  | {
      readonly type: 'reorderTable';
      readonly output: string;
      readonly before?: string;
    }
  | { readonly type: 'saving' }
  | {
      readonly type: 'saved';
      readonly config: ExplorerConfigV2;
      readonly draftVersion: number;
      readonly draftDigest: string;
      readonly updatedAt?: string;
      readonly lifecycleMetadata?: ExplorerLifecycleMetadataV2;
    }
  | { readonly type: 'publishing' }
  | {
      readonly type: 'published';
      readonly config: ExplorerConfigV2;
      readonly revisionId?: string;
      readonly draftVersion: number;
      readonly draftDigest: string;
      readonly publishedAt?: string;
      readonly activeUrl?: string;
      readonly shareUrl?: string;
      readonly lifecycleMetadata?: ExplorerLifecycleMetadataV2;
    }
  | {
      readonly type: 'error';
      readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
      readonly conflict?: BuilderSessionState['conflict'];
    }
  | { readonly type: 'discard' }
  | {
      readonly type: 'previewLoading';
      readonly output: string;
      readonly digest: string;
    }
  | {
      readonly type: 'previewReady';
      readonly output: string;
      readonly digest: string;
      readonly data: NonNullable<PreviewState['data']>;
    }
  | {
      readonly type: 'previewError';
      readonly output: string;
      readonly digest: string;
      readonly error: string;
    };

export const slugifyExplorerId = (name: string): string => {
  const slug = name
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56);
  if (!slug) return '';
  return /^[a-z]/.test(slug) ? slug : `explorer-${slug}`;
};

export const rowGrainForResource = (resourceType: string): string => {
  switch (resourceType.trim()) {
    case 'Patient':
      return 'patient';
    case 'Specimen':
      return 'specimen';
    case 'File':
    case 'DocumentReference':
      return 'file';
    case 'ResearchSubject':
      return 'study_enrollment';
    case 'GroupMember':
      return 'group_member';
    case 'Observation':
      return 'observation';
    case 'Condition':
      return 'diagnosis';
    default:
      return (
        resourceType
          .trim()
          .replace(/([a-z])([A-Z])/g, '$1_$2')
          .replace(/[^A-Za-z0-9_]+/g, '_')
          .toLocaleLowerCase() || 'resource'
      );
  }
};

const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, stable(child)]),
    );
  return value;
};

export const canonicalizeExplorerConfig = (config: ExplorerConfigV2): string =>
  JSON.stringify(stable(config));

export const digestExplorerConfig = async (
  config: ExplorerConfigV2,
): Promise<string> => {
  const canonical = canonicalizeExplorerConfig(config);
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonical),
    );
    return `sha256:${Array.from(new Uint8Array(bytes))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return `canonical:${canonical}`;
};

export const digestExplorerPreview = async (
  config: ExplorerConfigV2,
  output: string,
  limit: number,
): Promise<string> => {
  const canonical = JSON.stringify({
    config: canonicalizeExplorerConfig(config),
    output,
    limit,
  });
  if (globalThis.crypto?.subtle && typeof TextEncoder !== 'undefined') {
    const bytes = await globalThis.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonical),
    );
    return `sha256:${Array.from(new Uint8Array(bytes))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return `canonical:${canonical}`;
};

const outputList = (config: ExplorerConfigV2): ReadonlyArray<RecipeOutputV2> =>
  config.recipe.outputs ?? [];
const tableView = (
  config: ExplorerConfigV2,
  output: string,
): ExplorerViewV2 | undefined =>
  config.views.find((view) => view.output === output);

/**
 * `order` was a Builder-only column layout field. The V2 wire contract uses
 * the order of `table.columns` itself, and Loom rejects unknown fields, so
 * remove the legacy field as configs enter the Builder.
 */
const withoutColumnOrder = (
  column: ExplorerTableColumnV2,
): ExplorerTableColumnV2 => {
  const { order: _order, ...withoutOrder } = column as ExplorerTableColumnV2 & {
    readonly order?: unknown;
  };
  return withoutOrder;
};

const withoutBuilderColumnOrder = (
  config: ExplorerConfigV2,
): ExplorerConfigV2 => ({
  ...config,
  views: config.views.map((view) => ({
    ...view,
    table: {
      ...view.table,
      columns: view.table.columns.map(withoutColumnOrder),
    },
  })),
});

const cloneTraversal = (traversal: RecipeTraversalV2): RecipeTraversalV2 => ({
  ...traversal,
  fields: traversal.fields?.map((field) => ({ ...field })),
  children: traversal.children?.map(cloneTraversal),
});

/** Read the native V2 traversal keys. The legacy aliases are only understood
 * while hydrating older repository packets; all new mutations below emit the
 * native `toResourceType` and `name` keys. */
export const traversalTargetResource = (traversal: RecipeTraversalV2): string =>
  traversal.toResourceType ?? traversal.resourceType ?? '';
export const traversalRelationshipName = (
  traversal: RecipeTraversalV2,
): string => traversal.name ?? traversal.relationship ?? '';

type MutableRecipeOutput = {
  name: string;
  title?: string;
  rootResourceType?: string;
  rowGrain?: string;
  fields?: RecipeFieldV2[];
  traversals?: RecipeTraversalV2[];
  [key: string]: unknown;
};
type MutableView = {
  id: string;
  title: string;
  output: string;
  rowLabel?: string;
  table: { columns: BuilderColumn[] };
  filters?: Array<{ column: string; label?: string }>;
  charts?: Array<{ column: string; type: string; title?: string }>;
  fixedFilters?: Record<string, string[]>;
  actions?: Array<{
    type: string;
    title: string;
    fileName?: string;
    output?: string;
    columns?: string[];
  }>;
};

const traversalNodeFromRecipe = (item: RecipeTraversalV2): TraversalNode => ({
  key: item.alias,
  resourceType: traversalTargetResource(item),
  label: traversalRelationshipName(item) || traversalTargetResource(item),
  children: (item.children ?? []).map(traversalNodeFromRecipe),
  selectedCandidateIds: [],
  relationshipId: item.alias,
});

const tableFromConfig = (
  config: ExplorerConfigV2,
  output: RecipeOutputV2,
): BuilderTableState => {
  const view = tableView(config, output.name);
  const traversal = (output.traversals ?? []).map(traversalNodeFromRecipe);
  return {
    output: output.name,
    title: view?.title ?? output.title ?? output.name,
    rootResourceType: output.rootResourceType,
    rowGrain: output.rowGrain,
    traversal,
    columns: (
      view?.table.columns ??
      (output.fields ?? []).map((field) => ({
        column: field.name,
        label: field.label,
        visible: true,
        logicalType: field.logicalType,
        filterable: true,
        chartable: false,
      }))
    ).map(withoutColumnOrder),
    filters: view?.filters ?? [],
    charts: (view?.charts ?? []).filter(
      (chart): chart is { column: string; type: 'pie'; title?: string } =>
        chart.type === 'pie',
    ),
    fixedFilters: view?.fixedFilters ?? {},
    actions: view?.actions ?? [],
  };
};

export const builderTables = (
  config: ExplorerConfigV2 | null,
): ReadonlyArray<BuilderTableState> =>
  config
    ? outputList(config).map((output) => tableFromConfig(config, output))
    : [];

const updateConfig = (
  config: ExplorerConfigV2,
  fn: (outputs: MutableRecipeOutput[], views: MutableView[]) => void,
): ExplorerConfigV2 => {
  const outputs = outputList(config).map((output) => ({
    ...output,
    fields: output.fields?.map((field) => ({ ...field })),
    traversals: output.traversals?.map(cloneTraversal),
  })) as MutableRecipeOutput[];
  const views = config.views.map((view) => ({
    ...view,
    table: {
      ...view.table,
      columns: view.table.columns.map((column) => ({ ...column })),
    },
    filters: view.filters?.map((filter) => ({ ...filter })),
    charts: view.charts?.map((chart) => ({ ...chart })),
    fixedFilters: view.fixedFilters
      ? Object.fromEntries(
          Object.entries(view.fixedFilters).map(([key, values]) => [
            key,
            [...values],
          ]),
        )
      : undefined,
    actions: view.actions?.map((action) => ({
      ...action,
      columns: action.columns ? [...action.columns] : undefined,
    })),
  })) as MutableView[];
  fn(outputs, views);
  return {
    ...config,
    recipe: { ...config.recipe, outputs },
    views,
  } as ExplorerConfigV2;
};

const withEdit = (
  state: BuilderSessionState,
  config: ExplorerConfigV2,
): BuilderSessionState => ({
  ...state,
  config,
  dirty: true,
  lifecycle: 'idle',
  diagnostics: [],
});
const selectedTable = (
  state: BuilderSessionState,
  output: string,
): BuilderTableState | undefined =>
  builderTables(state.config).find((table) => table.output === output);

const updateView = (
  config: ExplorerConfigV2,
  output: string,
  mutate: (view: MutableView, recipeOutput: MutableRecipeOutput) => void,
): ExplorerConfigV2 =>
  updateConfig(config, (outputs, views) => {
    const recipeOutput = outputs.find((candidate) => candidate.name === output);
    const view = views.find((candidate) => candidate.output === output);
    if (!recipeOutput || !view) return;
    mutate(view, recipeOutput);
  });

const flattenNodes = (nodes: ReadonlyArray<TraversalNode>): TraversalNode[] =>
  nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);

const traversalAliasParts = (value: string): string[] =>
  value
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .map((part) => part.toLowerCase())
    .filter(Boolean);

const recipeTraversalAlias = (
  relationship: GraphRelationship,
  usedAliases: ReadonlySet<string>,
): string => {
  const parts = [
    ...traversalAliasParts(relationship.target),
    ...traversalAliasParts(relationship.label),
  ];
  const base = (parts.join('_') || 'related_resource').replace(
    /^[^a-z]+/,
    'related_',
  );
  let alias = base;
  let suffix = 2;
  while (usedAliases.has(alias)) {
    alias = `${base}_${suffix}`;
    suffix += 1;
  }
  return alias;
};

const collectTraversalAliases = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
): Set<string> => {
  const aliases = new Set<string>();
  const visit = (items: ReadonlyArray<RecipeTraversalV2>) =>
    items.forEach((item) => {
      aliases.add(item.alias);
      visit(item.children ?? []);
    });
  visit(nodes);
  return aliases;
};

export const traversalAliasForRelationship = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  relationship: GraphRelationship,
): string => {
  let existing: string | undefined;
  const visit = (items: ReadonlyArray<RecipeTraversalV2>) =>
    items.forEach((item) => {
      const sameDirection =
        (item.direction ?? 'outbound') ===
          (relationship.direction ?? 'outbound') &&
        traversalTargetResource(item) === relationship.target;
      const graphEdgeIsReversed =
        item.direction === 'inbound' &&
        relationship.direction !== 'inbound' &&
        traversalTargetResource(item) === relationship.source;
      if (
        !existing &&
        traversalRelationshipName(item) === relationship.label &&
        (sameDirection || graphEdgeIsReversed)
      )
        existing = item.alias;
      visit(item.children ?? []);
    });
  visit(nodes);
  return (
    existing ??
    recipeTraversalAlias(relationship, collectTraversalAliases(nodes))
  );
};

export const traversalIncludesRelationship = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  relationship: GraphRelationship,
  rootResourceType?: ResourceType,
): boolean => {
  let included = false;
  const visit = (
    items: ReadonlyArray<RecipeTraversalV2>,
    parentResourceType: ResourceType | undefined,
  ) =>
    items.forEach((item) => {
      const direction = item.direction ?? 'outbound';
      const outbound =
        direction === 'outbound' &&
        parentResourceType === relationship.source &&
        traversalTargetResource(item) === relationship.target;
      const inbound =
        direction === 'inbound' &&
        parentResourceType === relationship.target &&
        traversalTargetResource(item) === relationship.source;
      if (
        traversalRelationshipName(item) === relationship.label &&
        (outbound || inbound)
      )
        included = true;
      visit(item.children ?? [], traversalTargetResource(item));
    });
  visit(nodes, rootResourceType);
  return included;
};

const appendTraversal = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  relationship: GraphRelationship,
): { readonly nodes: RecipeTraversalV2[]; readonly alias: string } => {
  const alias = traversalAliasForRelationship(nodes, relationship);
  const child: RecipeTraversalV2 = {
    alias,
    toResourceType: relationship.target,
    name: relationship.label,
    direction: relationship.direction ?? 'outbound',
    children: [],
    fields: [],
  };
  const containsResource = (
    items: ReadonlyArray<RecipeTraversalV2>,
    resource: string,
  ): boolean =>
    items.some(
      (item) =>
        traversalTargetResource(item) === resource ||
        containsResource(item.children ?? [], resource),
    );
  const sourceExists = containsResource(nodes, relationship.source);
  if (!sourceExists) return { nodes: [...nodes, child], alias };
  const attach = (
    items: ReadonlyArray<RecipeTraversalV2>,
  ): { readonly nodes: RecipeTraversalV2[]; readonly attached: boolean } => {
    let attached = false;
    const next = items.map((node) => {
      if (traversalTargetResource(node) === relationship.source) {
        attached = true;
        return { ...node, children: [...(node.children ?? []), child] };
      }
      const result = attach(node.children ?? []);
      if (result.attached) attached = true;
      return { ...node, children: result.nodes };
    });
    return { nodes: next, attached };
  };
  const result = attach(nodes);
  return { nodes: result.attached ? result.nodes : [...nodes, child], alias };
};

const traversalContainsResource = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  resourceType: string,
): boolean =>
  nodes.some(
    (node) =>
      traversalTargetResource(node) === resourceType ||
      traversalContainsResource(node.children ?? [], resourceType),
  );
const removeTraversal = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  key: string,
): RecipeTraversalV2[] =>
  nodes
    .filter((node) => node.alias !== key)
    .map((node) => ({
      ...node,
      children: removeTraversal(node.children ?? [], key),
    }));
const traversalNode = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  key: string,
): RecipeTraversalV2 | undefined => {
  for (const node of nodes) {
    if (node.alias === key) return node;
    const nested = traversalNode(node.children ?? [], key);
    if (nested) return nested;
  }
  return undefined;
};
const traversalSubtreeAliases = (
  node: RecipeTraversalV2,
): ReadonlySet<string> => {
  const aliases = new Set<string>();
  const visit = (item: RecipeTraversalV2) => {
    aliases.add(item.alias);
    item.children?.forEach(visit);
  };
  visit(node);
  return aliases;
};
const traversalSubtreeFields = (
  node: RecipeTraversalV2,
): ReadonlySet<string> => {
  const fields = new Set<string>();
  const visit = (item: RecipeTraversalV2) => {
    item.fields?.forEach((field) => fields.add(field.name));
    item.children?.forEach(visit);
  };
  visit(node);
  return fields;
};
const mutateTraversal = (
  nodes: ReadonlyArray<RecipeTraversalV2>,
  key: string,
  mutate: (node: RecipeTraversalV2) => RecipeTraversalV2,
): RecipeTraversalV2[] =>
  nodes.map((node) =>
    node.alias === key
      ? mutate({ ...node })
      : {
          ...node,
          children: mutateTraversal(node.children ?? [], key, mutate),
        },
  );
const recipeNodeKey = (nodeKey: string): string => {
  const separator = nodeKey.indexOf('|');
  return separator < 0 ? nodeKey : nodeKey.slice(separator + 1);
};

export const previewCacheKey = (output: string, digest: string): string =>
  `${output}|${digest}`;

const fieldsForNode = (
  output: MutableRecipeOutput,
  nodeKey: string,
): RecipeFieldV2[] => {
  const key = recipeNodeKey(nodeKey);
  if (key === `root:${output.rootResourceType}`)
    return [...(output.fields ?? [])];
  let fields: RecipeFieldV2[] = [];
  const visit = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
    nodes.forEach((node) => {
      if (node.alias === key) fields = [...(node.fields ?? [])];
      else visit(node.children ?? []);
    });
  visit(output.traversals ?? []);
  return fields;
};
const fieldMatchesCandidate = (
  field: RecipeFieldV2,
  candidate: CatalogCandidate,
): boolean =>
  field.name === candidate.publicName ||
  field.name === candidate.path ||
  (candidate.selectionKey !== undefined &&
    field.selectionKey === candidate.selectionKey) ||
  (candidate.valueSelector !== undefined &&
    field.valueSelector === candidate.valueSelector);
const publicColumnNameForCandidate = (
  candidate: CatalogCandidate,
  nodeKey: string,
  view: MutableView,
): string => {
  const safeIdentifier = (value: string): string => {
    const normalized = value
      .trim()
      .replace(/[^A-Za-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
    if (!normalized) return 'column';
    return /^[0-9]/.test(normalized) ? `column_${normalized}` : normalized;
  };
  const nodeAlias = recipeNodeKey(nodeKey);
  const relationTarget = nodeAlias.includes('/')
    ? nodeAlias.split('/').filter(Boolean).at(-1)
    : undefined;
  const prefix = (
    relationTarget ||
    candidate.resourceType ||
    nodeAlias
  ).replace(/[^A-Za-z0-9]+/g, '_');
  const requested =
    candidate.publicName?.trim() ||
    (nodeAlias.startsWith('root:')
      ? candidate.path
      : `${prefix}__${candidate.path}`);
  const safeRequested = safeIdentifier(requested);
  const used = new Set(view.table.columns.map((column) => column.column));
  if (!used.has(safeRequested)) return safeRequested;
  let suffix = 2;
  while (used.has(`${safeRequested}_${suffix}`)) suffix += 1;
  return `${safeRequested}_${suffix}`;
};
const setFieldsForNode = (
  output: MutableRecipeOutput,
  nodeKey: string,
  fields: RecipeFieldV2[],
) => {
  const key = recipeNodeKey(nodeKey);
  if (key === `root:${output.rootResourceType}`) {
    output.fields = fields;
    return;
  }
  output.traversals = mutateTraversal(output.traversals ?? [], key, (node) => ({
    ...node,
    fields,
  }));
};
const pruneSharedFilterReferences = (
  config: ExplorerConfigV2,
  output?: string,
  column?: string,
): ExplorerConfigV2 => {
  if (!config.sharedFilters) return config;
  const sharedFilters = Object.fromEntries(
    Object.entries(config.sharedFilters)
      .map(([name, mappings]) => [
        name,
        mappings.filter(
          (mapping) =>
            !(
              mapping.output === output &&
              (!column || mapping.column === column)
            ),
        ),
      ])
      .filter(([, mappings]) => mappings.length > 0),
  );
  if (Object.keys(sharedFilters).length > 0)
    return { ...config, sharedFilters };
  const { sharedFilters: _removed, ...withoutSharedFilters } = config;
  return withoutSharedFilters;
};

const pruneSharedFilterColumns = (
  config: ExplorerConfigV2,
  output: string,
  columns: ReadonlySet<string>,
): ExplorerConfigV2 => {
  if (!config.sharedFilters || columns.size === 0) return config;
  const sharedFilters = Object.fromEntries(
    Object.entries(config.sharedFilters)
      .map(([name, mappings]) => [
        name,
        mappings.filter(
          (mapping) =>
            !(mapping.output === output && columns.has(mapping.column)),
        ),
      ])
      .filter(([, mappings]) => mappings.length > 0),
  );
  if (Object.keys(sharedFilters).length > 0)
    return { ...config, sharedFilters };
  const { sharedFilters: _removed, ...withoutSharedFilters } = config;
  return withoutSharedFilters;
};

export const explorerBuilderReducer = (
  state: BuilderSessionState,
  action: BuilderAction,
): BuilderSessionState => {
  switch (action.type) {
    case 'load':
      return {
        ...state,
        ...action.state,
        dirty: false,
        lifecycle: 'idle',
        diagnostics: [],
        conflict: undefined,
      };
    case 'selectOutput':
      return {
        ...state,
        selectedOutput: action.output,
        selectedResource: undefined,
        selectedNodeKey: undefined,
      };
    case 'selectResource':
      return {
        ...state,
        selectedResource: action.resource,
        selectedNodeKey: action.nodeKey,
      };
    case 'toggleNode': {
      const expanded = new Set(state.expandedNodes);
      if (expanded.has(action.key)) expanded.delete(action.key);
      else expanded.add(action.key);
      return { ...state, expandedNodes: expanded };
    }
    case 'setCatalog': {
      const output = state.config?.recipe.outputs?.find(
        (candidate) => candidate.name === state.selectedOutput,
      ) as MutableRecipeOutput | undefined;
      const selectedCandidateIdsByNode = {
        ...state.selectedCandidateIdsByNode,
      };
      if (output) {
        for (const resource of action.catalog.resources) {
          const fields = resource.fields;
          const grouped = new Map<string, CatalogCandidate[]>();
          for (const candidate of fields) {
            const nodePath = candidate.nodePath ?? [];
            const nodeKey = `${state.selectedOutput ?? candidate.output ?? ''}|${nodePath.length > 0 ? nodePath[nodePath.length - 1] : `root:${resource.resourceType}`}`;
            const existing = grouped.get(nodeKey) ?? [];
            existing.push(candidate);
            grouped.set(nodeKey, existing);
          }
          for (const [nodeKey, candidates] of grouped) {
            if (selectedCandidateIdsByNode[nodeKey]) continue;
            const fieldsForNodeNow = fieldsForNode(output, nodeKey);
            selectedCandidateIdsByNode[nodeKey] = candidates
              .filter(
                (candidate) =>
                  // Loom's candidate snapshot is authoritative for family
                  // selections. A dynamic/extension/pivot key may be
                  // selected in its native family without having a matching
                  // ordinary `fields[]` declaration.
                  candidate.selected === true ||
                  fieldsForNodeNow.some((field) =>
                    fieldMatchesCandidate(field, candidate),
                  ),
              )
              .map((candidate) => candidate.id);
          }
        }
      }
      return {
        ...state,
        catalog: action.catalog,
        selectedCandidateIdsByNode,
        diagnostics: action.catalog.diagnostics,
      };
    }
    case 'setRoot': {
      if (!state.config) return state;
      const config = updateConfig(state.config, (outputs, views) => {
        const output = outputs.find(
          (candidate) => candidate.name === action.output,
        );
        const view = views.find(
          (candidate) => candidate.output === action.output,
        );
        if (!output || !view) return;
        output.rootResourceType = action.resourceType;
        output.rowGrain = rowGrainForResource(action.resourceType);
        output.fields = [];
        output.traversals = [];
        view.table = { ...view.table, columns: [] };
        view.filters = [];
        view.charts = [];
        view.fixedFilters = {};
      });
      return withEdit(
        {
          ...state,
          selectedOutput: action.output,
          selectedResource: action.resourceType,
          selectedNodeKey: `${action.output}|root:${action.resourceType}`,
          selectedCandidateIdsByNode: {},
        },
        config,
      );
    }
    case 'addTraversal': {
      if (!state.config) return state;
      const currentOutput = outputList(state.config).find(
        (candidate) => candidate.name === action.output,
      );
      if (
        !currentOutput?.rootResourceType ||
        action.relationship.source === action.relationship.target ||
        action.relationship.target === currentOutput.rootResourceType ||
        traversalContainsResource(
          currentOutput.traversals ?? [],
          action.relationship.target,
        )
      )
        return state;
      const sourceIsIncluded =
        action.relationship.source === currentOutput.rootResourceType ||
        traversalContainsResource(
          currentOutput.traversals ?? [],
          action.relationship.source,
        );
      if (!sourceIsIncluded) return state;
      const currentTraversals = currentOutput.traversals ?? [];
      const appended = appendTraversal(currentTraversals, action.relationship);
      const config = updateView(state.config, action.output, (view, output) => {
        output.traversals = appended.nodes;
        view.rowLabel = view.rowLabel ?? output.rootResourceType;
      });
      return withEdit(
        {
          ...state,
          selectedResource: action.relationship.target,
          selectedNodeKey: `${action.output}|${appended.alias}`,
        },
        config,
      );
    }
    case 'removeTraversal': {
      if (!state.config) return state;
      const currentOutput = outputList(state.config).find(
        (candidate) => candidate.name === action.output,
      );
      const removedNode = currentOutput
        ? traversalNode(currentOutput.traversals ?? [], action.nodeKey)
        : undefined;
      if (!removedNode) return state;
      const removedFields = traversalSubtreeFields(removedNode);
      const removedAliases = traversalSubtreeAliases(removedNode);
      const config = updateView(state.config, action.output, (view, output) => {
        output.traversals = removeTraversal(
          output.traversals ?? [],
          action.nodeKey,
        );
        view.table = {
          ...view.table,
          columns: view.table.columns.filter(
            (column) => !removedFields.has(column.column),
          ),
        };
        view.filters = view.filters?.filter(
          (filter) => !removedFields.has(filter.column),
        );
        view.charts = view.charts?.filter(
          (chart) => !removedFields.has(chart.column),
        );
        if (view.fixedFilters) {
          const fixedFilters = Object.fromEntries(
            Object.entries(view.fixedFilters).filter(
              ([column]) => !removedFields.has(column),
            ),
          );
          view.fixedFilters = fixedFilters;
        }
        view.actions = view.actions?.map((item) => ({
          ...item,
          columns: item.columns?.filter((column) => !removedFields.has(column)),
        }));
      });
      const cleanedConfig = pruneSharedFilterColumns(
        config,
        action.output,
        removedFields,
      );
      const selectedNodeSuffix = state.selectedNodeKey?.startsWith(
        `${action.output}|`,
      )
        ? state.selectedNodeKey.slice(action.output.length + 1)
        : undefined;
      const selectionRemoved = selectedNodeSuffix
        ? removedAliases.has(selectedNodeSuffix)
        : false;
      const selectedCandidateIdsByNode = Object.fromEntries(
        Object.entries(state.selectedCandidateIdsByNode).filter(
          ([key]) =>
            ![...removedAliases].some(
              (alias) => key === `${action.output}|${alias}`,
            ),
        ),
      );
      const nextState = selectionRemoved
        ? {
            ...state,
            selectedResource: currentOutput?.rootResourceType,
            selectedNodeKey: `${action.output}|root:${currentOutput?.rootResourceType ?? ''}`,
            selectedCandidateIdsByNode,
          }
        : { ...state, selectedCandidateIdsByNode };
      return withEdit(nextState, cleanedConfig);
    }
    case 'setCandidate': {
      if (!state.config) return state;
      let removedFieldName: string | undefined;
      const config = updateView(state.config, action.output, (view, output) => {
        const targetFields = fieldsForNode(output, action.nodeKey);
        const existing = targetFields.findIndex((field) =>
          fieldMatchesCandidate(field, action.candidate),
        );
        if (action.selected && existing < 0) {
          const publicName = publicColumnNameForCandidate(
            action.candidate,
            action.nodeKey,
            view,
          );
          const recipeNode = recipeNodeKey(action.nodeKey);
          const selectorRoot = recipeNode.startsWith('root:')
            ? 'root'
            : recipeNode;
          const candidatePath = action.candidate.path
            .trim()
            .replace(/^root\./, '');
          const directExpression =
            (action.candidate.family ?? 'field') === 'field' && candidatePath
              ? { select: `${selectorRoot}.${candidatePath}` }
              : undefined;
          const field: RecipeFieldV2 = {
            name: publicName,
            ...(directExpression ? { expr: directExpression } : {}),
            logicalType: action.candidate.logicalType,
            repeated: action.candidate.repeated,
            family: action.candidate.family ?? 'field',
            ...(action.candidate.selectionKey
              ? { selectionKey: action.candidate.selectionKey }
              : {}),
            ...(action.candidate.valueSelector
              ? { valueSelector: action.candidate.valueSelector }
              : {}),
            ...(action.candidate.familyName
              ? { familyName: action.candidate.familyName }
              : {}),
            ...(action.candidate.familyKind
              ? { familyKind: action.candidate.familyKind }
              : {}),
            ...(action.candidate.extensionMapping
              ? { extensionMapping: action.candidate.extensionMapping }
              : {}),
          };
          setFieldsForNode(output, action.nodeKey, [...targetFields, field]);
          view.table = {
            ...view.table,
            columns: [
              ...view.table.columns,
              {
                column: field.name,
                label: field.label,
                visible: true,
                filterable: action.candidate.filterable,
                chartable: action.candidate.chartable,
              },
            ],
          };
        } else if (!action.selected && existing >= 0) {
          const fieldName = targetFields[existing].name;
          removedFieldName = fieldName;
          setFieldsForNode(
            output,
            action.nodeKey,
            targetFields.filter((_field, index) => index !== existing),
          );
          view.table = {
            ...view.table,
            columns: view.table.columns.filter(
              (column) => column.column !== fieldName,
            ),
          };
          view.filters = view.filters?.filter(
            (filter) => filter.column !== fieldName,
          );
          view.charts = view.charts?.filter(
            (chart) => chart.column !== fieldName,
          );
          if (view.fixedFilters) {
            const fixedFilters = { ...view.fixedFilters };
            delete fixedFilters[fieldName];
            view.fixedFilters = fixedFilters;
          }
        }
      });
      const selectedForNode = new Set(
        state.selectedCandidateIdsByNode[action.nodeKey] ?? [],
      );
      if (action.selected) selectedForNode.add(action.candidate.id);
      else selectedForNode.delete(action.candidate.id);
      return withEdit(
        {
          ...state,
          selectedResource: action.candidate.resourceType,
          selectedNodeKey: action.nodeKey,
          selectedCandidateIdsByNode: {
            ...state.selectedCandidateIdsByNode,
            [action.nodeKey]: Array.from(selectedForNode),
          },
        },
        action.selected
          ? config
          : pruneSharedFilterReferences(
              config,
              action.output,
              removedFieldName ??
                action.candidate.publicName ??
                action.candidate.path,
            ),
      );
    }
    case 'setColumnLabel': {
      if (!state.config) return state;
      const config = updateView(state.config, action.output, (view) => {
        view.table = {
          ...view.table,
          columns: view.table.columns.map((column) =>
            column.column === action.column
              ? { ...column, label: action.label }
              : column,
          ),
        };
        view.filters = view.filters?.map((filter) =>
          filter.column === action.column
            ? { ...filter, label: action.label }
            : filter,
        );
        view.charts = view.charts?.map((chart) =>
          chart.column === action.column
            ? { ...chart, title: action.label }
            : chart,
        );
      });
      const sharedFilters =
        config.sharedFilters &&
        Object.fromEntries(
          Object.entries(config.sharedFilters).map(([name, mappings]) => [
            name,
            mappings.map((mapping) =>
              mapping.output === action.output &&
              mapping.column === action.column
                ? { ...mapping, label: action.label }
                : mapping,
            ),
          ]),
        );
      return withEdit(
        state,
        sharedFilters ? { ...config, sharedFilters } : config,
      );
    }
    case 'setColumnVisible': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          view.table = {
            ...view.table,
            columns: view.table.columns.map((column) =>
              column.column === action.column
                ? { ...column, visible: action.visible }
                : column,
            ),
          };
        }),
      );
    }
    case 'reorderColumn': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          const columns = [...view.table.columns];
          const sourceIndex = columns.findIndex(
            (column) => column.column === action.column,
          );
          if (sourceIndex < 0) return;
          const [source] = columns.splice(sourceIndex, 1);
          const targetIndex = action.before
            ? columns.findIndex((column) => column.column === action.before)
            : columns.length;
          columns.splice(
            targetIndex < 0 ? columns.length : targetIndex,
            0,
            source,
          );
          view.table = {
            ...view.table,
            columns,
          };
        }),
      );
    }
    case 'setFilter': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          const filters =
            view.filters?.filter((filter) => filter.column !== action.column) ??
            [];
          view.filters = action.enabled
            ? [...filters, { column: action.column, label: action.label }]
            : filters;
        }),
      );
    }
    case 'setChart': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          const charts =
            view.charts?.filter((chart) => chart.column !== action.column) ??
            [];
          view.charts = action.enabled
            ? [
                ...charts,
                { column: action.column, type: 'pie', title: action.title },
              ]
            : charts;
        }),
      );
    }
    case 'setFixedFilter': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          view.fixedFilters = {
            ...(view.fixedFilters ?? {}),
            [action.column]: [...action.values],
          };
        }),
      );
    }
    case 'clearFixedFilter': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          const fixedFilters = { ...(view.fixedFilters ?? {}) };
          delete fixedFilters[action.column];
          view.fixedFilters = fixedFilters;
        }),
      );
    }
    case 'setSharedFilter': {
      if (!state.config || !action.name.trim()) return state;
      const sharedFilters = {
        ...(state.config.sharedFilters ?? {}),
        [action.name.trim()]: action.mappings.map((mapping) => ({
          ...mapping,
        })),
      };
      return withEdit(state, { ...state.config, sharedFilters });
    }
    case 'removeSharedFilter': {
      if (!state.config) return state;
      const sharedFilters = { ...(state.config.sharedFilters ?? {}) };
      delete sharedFilters[action.name];
      return withEdit(state, { ...state.config, sharedFilters });
    }
    case 'addAction': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          view.actions = [
            ...(view.actions ?? []),
            {
              type: action.action.type,
              title: action.action.title,
              output: action.action.output,
              columns: action.action.columns
                ? [...action.action.columns]
                : undefined,
            },
          ];
        }),
      );
    }
    case 'removeAction': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateView(state.config, action.output, (view) => {
          view.actions = (view.actions ?? []).filter(
            (_item, index) => index !== action.index,
          );
        }),
      );
    }
    case 'setFileAction': {
      if (!state.config || !action.name.trim() || !action.targetRoute.trim())
        return state;
      const fileActions = {
        ...(state.config.fileActions ?? {}),
        actions: {
          ...(state.config.fileActions?.actions ?? {}),
          [action.name.trim()]: action.targetRoute.trim(),
        },
      };
      return withEdit(state, { ...state.config, fileActions });
    }
    case 'removeFileAction': {
      if (!state.config) return state;
      const actions = { ...(state.config.fileActions?.actions ?? {}) };
      delete actions[action.name];
      const extensions = Object.fromEntries(
        Object.entries(state.config.fileActions?.extensions ?? {})
          .map(([extension, names]) => [
            extension,
            names.filter((name) => name !== action.name),
          ])
          .filter(([, names]) => names.length > 0),
      );
      return withEdit(state, {
        ...state.config,
        fileActions: {
          ...(state.config.fileActions ?? {}),
          actions,
          extensions,
        },
      });
    }
    case 'setFileActionExtensions': {
      if (!state.config || !action.extension.trim()) return state;
      const extension = action.extension.trim().toLocaleLowerCase();
      const extensions = { ...(state.config.fileActions?.extensions ?? {}) };
      if (action.actions.length === 0) delete extensions[extension];
      else extensions[extension] = [...action.actions];
      return withEdit(state, {
        ...state.config,
        fileActions: { ...(state.config.fileActions ?? {}), extensions },
      });
    }
    case 'removeTable': {
      if (!state.config) return state;
      const config = updateConfig(state.config, (outputs, views) => {
        const index = outputs.findIndex(
          (output) => output.name === action.output,
        );
        if (index >= 0) outputs.splice(index, 1);
        for (let i = views.length - 1; i >= 0; i -= 1)
          if (views[i].output === action.output) views.splice(i, 1);
      });
      const nextOutput = outputList(config)[0]?.name;
      const nextRoot = outputList(config).find(
        (output) => output.name === nextOutput,
      )?.rootResourceType;
      return withEdit(
        {
          ...state,
          selectedOutput: nextOutput,
          selectedResource: nextRoot,
          selectedNodeKey:
            nextOutput && nextRoot
              ? `${nextOutput}|root:${nextRoot}`
              : undefined,
        },
        pruneSharedFilterReferences(config, action.output),
      );
    }
    case 'addTable': {
      if (!state.config) return state;
      const config = updateConfig(state.config, (outputs, views) => {
        outputs.push({
          name: action.output,
          title: action.title,
          fields: [],
          traversals: [],
        });
        views.push({
          id: `view-${action.output}`,
          title: action.title,
          output: action.output,
          table: { columns: [] },
        });
      });
      return withEdit(
        {
          ...state,
          selectedOutput: action.output,
          selectedResource: undefined,
          selectedNodeKey: undefined,
          selectedCandidateIdsByNode: {},
        },
        config,
      );
    }
    case 'duplicateTable': {
      if (!state.config) return state;
      const config = updateConfig(state.config, (outputs, views) => {
        const source = outputs.find(
          (candidate) => candidate.name === action.sourceOutput,
        );
        const sourceView = views.find(
          (candidate) => candidate.output === action.sourceOutput,
        );
        if (!source || !sourceView) return;
        outputs.push({
          ...source,
          name: action.output,
          title: action.title,
          fields: source.fields?.map((field) => ({ ...field })),
          traversals: source.traversals?.map(cloneTraversal),
        });
        views.push({
          ...sourceView,
          id: `view-${action.output}`,
          output: action.output,
          title: action.title,
          table: {
            ...sourceView.table,
            columns: sourceView.table.columns.map((column) => ({ ...column })),
          },
          filters: sourceView.filters?.map((filter) => ({ ...filter })),
          charts: sourceView.charts?.map((chart) => ({ ...chart })),
          fixedFilters: sourceView.fixedFilters
            ? Object.fromEntries(
                Object.entries(sourceView.fixedFilters).map(([key, values]) => [
                  key,
                  [...values],
                ]),
              )
            : undefined,
          actions: sourceView.actions?.map((item) => ({
            type: item.type,
            title: item.title,
            fileName: item.fileName,
            output: item.output,
            columns: item.columns ? [...item.columns] : undefined,
          })),
        });
      });
      const duplicatedRoot = outputList(config).find(
        (output) => output.name === action.output,
      )?.rootResourceType;
      return withEdit(
        {
          ...state,
          selectedOutput: action.output,
          selectedResource: duplicatedRoot,
          selectedNodeKey: duplicatedRoot
            ? `${action.output}|root:${duplicatedRoot}`
            : undefined,
          selectedCandidateIdsByNode: {},
        },
        config,
      );
    }
    case 'renameTable': {
      if (!state.config) return state;
      return withEdit(
        state,
        updateConfig(state.config, (outputs, views) => {
          const output = outputs.find(
            (candidate) => candidate.name === action.output,
          );
          const view = views.find(
            (candidate) => candidate.output === action.output,
          );
          if (output) output.title = action.title;
          if (view) view.title = action.title;
        }),
      );
    }
    case 'editMetadata': {
      if (!state.config) return state;
      return withEdit(state, {
        ...state.config,
        explorer: {
          ...state.config.explorer,
          ...(action.title === undefined ? {} : { title: action.title }),
          ...(action.description === undefined
            ? {}
            : { description: action.description }),
        },
      });
    }
    case 'reorderTable': {
      if (!state.config) return state;
      const config = updateConfig(state.config, (outputs, views) => {
        const outputIndex = outputs.findIndex(
          (candidate) => candidate.name === action.output,
        );
        if (outputIndex < 0) return;
        const [item] = outputs.splice(outputIndex, 1);
        const targetIndex = action.before
          ? outputs.findIndex((candidate) => candidate.name === action.before)
          : outputs.length;
        outputs.splice(targetIndex < 0 ? outputs.length : targetIndex, 0, item);
        const viewIndex = views.findIndex(
          (candidate) => candidate.output === action.output,
        );
        if (viewIndex >= 0) {
          const [view] = views.splice(viewIndex, 1);
          const viewTarget = action.before
            ? views.findIndex((candidate) => candidate.output === action.before)
            : views.length;
          views.splice(viewTarget < 0 ? views.length : viewTarget, 0, view);
        }
      });
      return withEdit(state, config);
    }
    case 'saving':
      return { ...state, lifecycle: 'saving', diagnostics: [] };
    case 'saved':
      return {
        ...state,
        config: action.config,
        serverDraftConfig: action.config,
        draftVersion: action.draftVersion,
        draftDigest: action.draftDigest,
        updatedAt: action.updatedAt,
        lifecycleMetadata: action.lifecycleMetadata ?? state.lifecycleMetadata,
        dirty: false,
        lifecycle: 'saved',
        diagnostics: [],
        conflict: undefined,
      };
    case 'publishing':
      return { ...state, lifecycle: 'publishing', diagnostics: [] };
    case 'published':
      return {
        ...state,
        config: action.config,
        serverDraftConfig: action.config,
        activeConfig: action.config,
        activeRevisionId: action.revisionId,
        draftVersion: action.draftVersion,
        draftDigest: action.draftDigest,
        publishedAt: action.publishedAt,
        activeUrl: action.activeUrl,
        shareUrl: action.shareUrl,
        lifecycleMetadata: action.lifecycleMetadata ?? state.lifecycleMetadata,
        dirty: false,
        lifecycle: 'published',
        diagnostics: [],
        conflict: undefined,
      };
    case 'error':
      return {
        ...state,
        lifecycle: 'error',
        diagnostics: action.diagnostics,
        conflict: action.conflict,
      };
    case 'discard': {
      const target = state.activeConfig ?? state.serverDraftConfig;
      if (!target) return state;
      const selectedOutput = target.recipe.outputs?.some(
        (output) => output.name === state.selectedOutput,
      )
        ? state.selectedOutput
        : target.recipe.outputs?.[0]?.name;
      const selectedRoot = target.recipe.outputs?.find(
        (output) => output.name === selectedOutput,
      )?.rootResourceType;
      return {
        ...state,
        config: target,
        dirty: false,
        lifecycle: 'idle',
        diagnostics: [],
        conflict: undefined,
        selectedOutput,
        selectedResource: selectedRoot,
        selectedCandidateIdsByNode: {},
        selectedNodeKey:
          selectedOutput && selectedRoot
            ? `${selectedOutput}|root:${selectedRoot}`
            : undefined,
      };
    }
    case 'previewLoading':
      return {
        ...state,
        preview: {
          ...state.preview,
          [action.output]: {
            digest: action.digest,
            status: 'loading',
            data: state.preview[action.output]?.data,
          },
        },
      };
    case 'previewReady': {
      if (state.preview[action.output]?.digest !== action.digest) return state;
      const preview = {
        digest: action.digest,
        status: 'ready' as const,
        data: action.data,
      };
      return {
        ...state,
        previewCache: {
          ...state.previewCache,
          [previewCacheKey(action.output, action.digest)]: preview,
        },
        preview: {
          ...state.preview,
          [action.output]: preview,
        },
      };
    }
    case 'previewError': {
      if (state.preview[action.output]?.digest !== action.digest) return state;
      return {
        ...state,
        preview: {
          ...state.preview,
          [action.output]: {
            digest: action.digest,
            status: 'error',
            error: action.error,
            data: state.preview[action.output]?.data,
          },
        },
      };
    }
  }
};

export const createBuilderSession = (
  project: string,
  explorerId = 'default',
): BuilderSessionState => ({
  project,
  explorerId,
  management: explorerId === 'default' ? 'REPOSITORY' : 'INTERACTIVE',
  config: null,
  serverDraftConfig: null,
  activeConfig: null,
  draftVersion: 0,
  draftDigest: '',
  lifecycleMetadata: {},
  selectedNodeKey: undefined,
  expandedNodes: new Set<string>(),
  // Catalog discovery is authoritative; the Builder remains empty until the
  // Loom authoring snapshot has been loaded.
  catalog: {
    complete: false,
    diagnostics: [],
    resources: [],
    relationships: [],
  },
  selectedCandidateIdsByNode: {},
  dirty: false,
  lifecycle: 'idle',
  diagnostics: [],
  previewCache: {},
  preview: {},
});

export const initialStateFromConfig = async (
  project: string,
  state: BuilderSessionState,
  config: ExplorerConfigV2,
  version = 0,
  digest?: string,
  activeConfig: ExplorerConfigV2 | null = config,
  updatedAt?: string,
  lifecycleMetadata: ExplorerLifecycleMetadataV2 = {},
): Promise<BuilderSessionState> => {
  const normalizedConfig = withoutBuilderColumnOrder(config);
  const normalizedActiveConfig = activeConfig
    ? withoutBuilderColumnOrder(activeConfig)
    : null;
  const selectedOutput =
    normalizedConfig.recipe.outputs?.[0]?.name ?? normalizedConfig.views[0]?.output;
  const root = normalizedConfig.recipe.outputs?.find(
    (output) => output.name === selectedOutput,
  )?.rootResourceType;
  return {
    ...state,
    project,
    config: normalizedConfig,
    serverDraftConfig: normalizedConfig,
    activeConfig: normalizedActiveConfig,
    draftVersion: version,
    draftDigest:
      digest ?? (await digestExplorerConfig(normalizedConfig)),
    updatedAt,
    lifecycleMetadata,
    selectedOutput,
    selectedResource: root,
    selectedNodeKey:
      selectedOutput && root ? `${selectedOutput}|root:${root}` : undefined,
    selectedCandidateIdsByNode: {},
    dirty: false,
    lifecycle: 'idle',
  };
};

export const tableColumns = (
  state: BuilderSessionState,
  output = state.selectedOutput,
): ReadonlyArray<BuilderColumn> =>
  selectedTable(state, output ?? '')?.columns ?? [];
export const traversalNodes = (
  state: BuilderSessionState,
  output = state.selectedOutput,
): ReadonlyArray<TraversalNode> =>
  selectedTable(state, output ?? '')?.traversal ?? [];
export const allTraversalNodes = (
  state: BuilderSessionState,
  output = state.selectedOutput,
): ReadonlyArray<TraversalNode> => flattenNodes(traversalNodes(state, output));

export const applyCompiledColumnCapabilities = (
  config: ExplorerConfigV2,
  output: string,
  emittedColumns: ReadonlyArray<{
    readonly name: string;
    readonly logicalType: string;
    readonly filterable: boolean;
    readonly chartable: boolean;
  }>,
): ExplorerConfigV2 =>
  updateView(config, output, (view) => {
    const capabilities = new Map(
      emittedColumns.map((column) => [column.name, column]),
    );
    view.table = {
      ...view.table,
      columns: view.table.columns.map((column) => {
        const emitted = capabilities.get(column.column);
        return emitted
          ? {
              ...column,
              filterable: emitted.filterable,
              chartable: emitted.chartable,
            }
          : column;
      }),
    };
  });

export const presentationDiagnostics = (
  config: ExplorerConfigV2,
): ReadonlyArray<ExplorerDiagnostic> => {
  const outputNames = new Set(
    (config.recipe.outputs ?? []).map((output) => output.name),
  );
  const fieldsForOutput = (outputName: string): Set<string> => {
    const output = config.recipe.outputs?.find(
      (candidate) => candidate.name === outputName,
    );
    const names = new Set<string>(
      output?.fields?.map((field) => field.name) ?? [],
    );
    const visit = (nodes: ReadonlyArray<RecipeTraversalV2>) =>
      nodes.forEach((node) => {
        node.fields?.forEach((field) => names.add(field.name));
        visit(node.children ?? []);
      });
    visit(output?.traversals ?? []);
    return names;
  };
  const diagnostics: ExplorerDiagnostic[] = [];
  for (const view of config.views) {
    if (!outputNames.has(view.output))
      diagnostics.push({
        severity: 'error',
        code: 'VIEW_OUTPUT_MISSING',
        message: `View ${view.id} references missing output ${view.output}.`,
        configPath: `views.${view.id}.output`,
      });
    const fields = fieldsForOutput(view.output);
    for (const column of view.table.columns)
      if (!fields.has(column.column))
        diagnostics.push({
          severity: 'error',
          code: 'VIEW_COLUMN_MISSING',
          message: `View ${view.title} references missing emitted column ${column.column}.`,
          configPath: `views.${view.id}.table.columns.${column.column}`,
        });
    for (const filter of view.filters ?? [])
      if (!fields.has(filter.column))
        diagnostics.push({
          severity: 'error',
          code: 'FILTER_COLUMN_MISSING',
          message: `Filter references missing emitted column ${filter.column}.`,
          configPath: `views.${view.id}.filters.${filter.column}`,
        });
    for (const chart of view.charts ?? [])
      if (!fields.has(chart.column))
        diagnostics.push({
          severity: 'error',
          code: 'CHART_COLUMN_MISSING',
          message: `Chart references missing emitted column ${chart.column}.`,
          configPath: `views.${view.id}.charts.${chart.column}`,
        });
    for (const column of Object.keys(view.fixedFilters ?? {}))
      if (!fields.has(column))
        diagnostics.push({
          severity: 'error',
          code: 'FIXED_FILTER_COLUMN_MISSING',
          message: `Fixed filter references missing emitted column ${column}.`,
          configPath: `views.${view.id}.fixedFilters.${column}`,
        });
    for (const action of view.actions ?? [])
      for (const column of action.columns ?? [])
        if (!fields.has(column))
          diagnostics.push({
            severity: 'error',
            code: 'ACTION_COLUMN_MISSING',
            message: `Action references missing emitted column ${column}.`,
            configPath: `views.${view.id}.actions.${action.type}.${column}`,
          });
  }
  const actions = new Set(Object.keys(config.fileActions?.actions ?? {}));
  for (const [extension, names] of Object.entries(
    config.fileActions?.extensions ?? {},
  ))
    for (const name of names)
      if (!actions.has(name))
        diagnostics.push({
          severity: 'error',
          code: 'FILE_ACTION_REFERENCE_MISSING',
          message: `File extension ${extension} references missing action ${name}.`,
          configPath: `fileActions.extensions.${extension}`,
        });
  return diagnostics;
};
