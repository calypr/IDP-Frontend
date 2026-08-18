import type { DataframeSelector, LoomColumn, LoomDataset } from './types';

export type ExplorerManagement = 'repository' | 'interactive';
export type ExplorerLifecycleState = 'published' | 'unpublished' | 'conflict';

export interface ExplorerMetadataV2 {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly management: ExplorerManagement;
}

export interface RecipeFieldV2 {
  readonly name: string;
  readonly label?: string;
  readonly logicalType?: string;
  readonly repeated?: boolean;
  readonly family?: 'field' | 'catalog' | 'dynamic' | 'extension' | 'pivot';
  readonly selectionKey?: string;
  readonly valueSelector?: string;
  readonly familyName?: string;
  readonly familyKind?: string;
  readonly extensionMapping?: string;
  readonly [key: string]: unknown;
}

export interface RecipeTraversalV2 {
  readonly alias: string;
  /** Native Loom recipe target resource. */
  readonly toResourceType?: string;
  /** Native Loom relationship name. */
  readonly name?: string;
  /** Legacy aliases are accepted only while hydrating older drafts. New
   * Builder writes use toResourceType/name. */
  readonly resourceType?: string;
  readonly relationship?: string;
  readonly direction?: 'outbound' | 'inbound';
  readonly children?: ReadonlyArray<RecipeTraversalV2>;
  readonly fields?: ReadonlyArray<RecipeFieldV2>;
  readonly [key: string]: unknown;
}

export interface RecipeOutputV2 {
  readonly name: string;
  readonly title?: string;
  readonly rootResourceType?: string;
  readonly rowGrain?: string;
  readonly fields?: ReadonlyArray<RecipeFieldV2>;
  readonly traversals?: ReadonlyArray<RecipeTraversalV2>;
  readonly [key: string]: unknown;
}

/** A typed envelope around Loom's executable recipe. Unknown recipe families
 * are preserved so loading and saving an untouched V2 document is lossless. */
export interface RecipeBundleV2 {
  readonly schemaVersion?: number;
  /** Server-produced executable recipe identity used by dataframe requests. */
  readonly name?: string;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  readonly outputs?: ReadonlyArray<RecipeOutputV2>;
  readonly [key: string]: unknown;
}

export interface RecipeSelectorMetadata {
  readonly recipeName?: string;
  readonly translationVersion?: string;
}

const firstNonEmptyString = (
  ...values: ReadonlyArray<unknown>
): string | undefined => {
  const value = values.find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
  return value?.trim();
};

/**
 * Converts the server-returned executable recipe identity into the only
 * selector accepted by Loom dataframe operations.
 */
export const dataframeSelectorForRecipeOutput = (
  recipe: RecipeBundleV2,
  output: string,
  metadata?: RecipeSelectorMetadata,
): DataframeSelector => {
  const recipeName = firstNonEmptyString(
    recipe.recipeName,
    recipe.name,
    metadata?.recipeName,
  );
  const translationVersion = firstNonEmptyString(
    recipe.translationVersion,
    metadata?.translationVersion,
  );
  const outputName = output.trim();
  if (!recipeName || !translationVersion || !outputName) {
    throw new Error(
      `Loom cannot query Explorer output ${output || '<unnamed>'} without the server recipe name, translation version, and output.`,
    );
  }
  return {
    recipe: recipeName,
    translationVersion,
    output: outputName,
  };
};

/**
 * Scope an authoring request to the output currently being inspected.
 *
 * A saved Explorer packet can contain several outputs, and an untouched
 * repository packet may contain legacy declarations that are not valid for a
 * different table. Loom's discovery and preview contracts are output-scoped;
 * sending the whole bundle makes an unrelated output poison an otherwise
 * valid request. Preserve the recipe envelope (including generation and
 * translation metadata) while replacing only its output list.
 */
export const recipeForOutput = (
  recipe: RecipeBundleV2,
  output: string,
): RecipeBundleV2 => ({
  ...recipe,
  outputs: (recipe.outputs ?? []).filter(
    (candidate) => candidate.name === output,
  ),
});

/**
 * Scope a complete Explorer packet to one table for output-scoped Loom
 * authoring requests. Full drafts keep every table; discovery and preview do
 * not, because an unrelated legacy output must not invalidate the table the
 * author is inspecting.
 */
export const configForOutput = (
  config: ExplorerConfigV2,
  output: string,
): ExplorerConfigV2 => {
  const sharedFilters = config.sharedFilters
    ? Object.fromEntries(
        Object.entries(config.sharedFilters)
          .map(([name, mappings]) => [
            name,
            mappings.filter((mapping) => mapping.output === output),
          ])
          .filter(([, mappings]) => mappings.length > 0),
      )
    : undefined;
  return {
    ...config,
    recipe: recipeForOutput(config.recipe, output),
    views: config.views.filter((view) => view.output === output),
    ...(sharedFilters ? { sharedFilters } : { sharedFilters: undefined }),
  };
};

/** The only authored Explorer contract. Presentation and executable recipe
 * are intentionally carried in one V2 packet. */
export interface ExplorerConfigV2 {
  readonly apiVersion: 'loom.calypr.org/explorer-config/v2';
  readonly kind: 'ExplorerConfig';
  readonly project: string;
  readonly explorer: ExplorerMetadataV2;
  readonly recipe: RecipeBundleV2;
  readonly views: ReadonlyArray<ExplorerViewV2>;
  readonly sharedFilters?: Readonly<
    Record<string, ReadonlyArray<SharedFilterMappingV2>>
  >;
  readonly fileActions?: FileActionsV2;
  /** Preserve forward-compatible V2 presentation/recipe envelope fields when
   * a packet is loaded and saved by an older Builder. */
  readonly [key: string]: unknown;
}

export interface SharedFilterMappingV2 {
  readonly output: string;
  readonly column: string;
  readonly label?: string;
  readonly logicalType?: string;
}

export interface FileActionsV2 {
  readonly extensions?: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly actions?: Readonly<Record<string, string>>;
}
export interface ExplorerViewV2 {
  readonly id: string;
  readonly title: string;
  readonly output: string;
  readonly rowLabel?: string;
  readonly table: { readonly columns: ReadonlyArray<ExplorerTableColumnV2> };
  readonly filters?: ReadonlyArray<{
    readonly column: string;
    readonly label?: string;
  }>;
  readonly charts?: ReadonlyArray<{
    readonly column: string;
    readonly type: string;
    readonly title?: string;
  }>;
  readonly fixedFilters?: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly actions?: ReadonlyArray<{
    readonly type: string;
    readonly title: string;
    readonly fileName?: string;
    readonly output?: string;
    readonly columns?: ReadonlyArray<string>;
  }>;
}

export interface ExplorerTableColumnV2 {
  readonly column: string;
  readonly label?: string;
  readonly visible: boolean;
  readonly order?: number;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
}

export interface ExplorerDraftMetadata {
  readonly draftVersion: number;
  readonly draftDigest: string;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
}

export interface ExplorerPublicationMetadata {
  readonly activeRevisionId?: string;
  readonly activeUrl?: string;
  readonly shareUrl?: string;
  readonly publishedAt?: string;
}

export interface ExplorerDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly configPath?: string;
  readonly fieldPath?: string | null;
  readonly details?: Readonly<Record<string, unknown>>;
  /** Authenticated Loom endpoint that produced this diagnostic, when known. */
  readonly endpoint?: string;
  readonly requestId?: string;
  readonly retryable?: boolean;
  readonly timestamp?: string;
}

/** The physical column contract emitted by a compiled Loom output. Keeping
 * this separate from the UI column model lets immutable revisions retain the
 * exact execution schema that was materialized. */
export interface ExplorerPhysicalColumnV2 {
  readonly name: string;
  readonly clickhouseType?: string;
  readonly logicalType?: string;
  readonly nullable?: boolean;
  readonly repeated?: boolean;
  readonly filterable?: boolean;
  readonly sortable?: boolean;
  readonly aggregatable?: boolean;
  readonly chartable?: boolean;
}

export interface ExplorerMaterializationMappingV2 {
  readonly outputId?: string;
  readonly output: string;
  readonly materializationId: string;
  readonly selector?: DataframeSelector;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  /** Frozen mapping from logical recipe output columns to physical columns. */
  readonly columns: ReadonlyArray<ExplorerPhysicalColumnV2>;
  readonly columnMappings?: Readonly<Record<string, string>>;
}

/** Metadata shared by drafts, immutable revisions, and active publications.
 * All values are server-produced; the Builder must not synthesize them. */
export interface ExplorerLifecycleMetadataV2 {
  readonly publicationId?: string;
  readonly recipeDigest?: string;
  readonly resolvedSchemaDigest?: string;
  readonly sourceGeneration?: string;
  readonly sourceCommit?: string;
  readonly executionId?: string;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  readonly physicalColumns?: ReadonlyArray<ExplorerPhysicalColumnV2>;
  readonly materializationMappings?: ReadonlyArray<ExplorerMaterializationMappingV2>;
  readonly frozenMaterializationMappings?: ReadonlyArray<ExplorerMaterializationMappingV2>;
  readonly publishedAt?: string;
}

export interface ExplorerState extends ExplorerLifecycleMetadataV2 {
  readonly project: string;
  readonly explorerId: string;
  readonly management: 'REPOSITORY' | 'INTERACTIVE';
  /** Repository/default metadata responses may intentionally have no draft. */
  readonly draftConfig?: ExplorerConfigV2;
  readonly baselineConfig?: Readonly<Record<string, unknown>>;
  readonly draftVersion: number;
  readonly draftDigest: string;
  readonly activeConfig?: ExplorerConfigV2;
  readonly activeRevisionId?: string;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
  readonly diagnostics?: ReadonlyArray<ExplorerDiagnostic>;
  readonly dataset?: ExplorerDatasetMetadataV2;
  readonly emittedColumns?: ReadonlyArray<ExplorerPhysicalColumnV2>;
  readonly publication?: ExplorerPublicationMetadataV2;
  readonly publicationState?: string;
  readonly datasets?: ReadonlyArray<LoomDataset>;
  readonly materializations?: ReadonlyArray<ExplorerMaterializationV2>;
  readonly activeUrl?: string;
  readonly shareUrl?: string;
}

export interface ExplorerMaterializationV2 {
  readonly outputId: string;
  readonly output: string;
  readonly materializationId: string;
  readonly columns: ReadonlyArray<LoomColumn>;
}

export interface ExplorerDatasetOutputV2 {
  readonly name: string;
  /** Canonical executable recipe output. Some deployments also expose a
   * display/legacy `name`; dataframe selectors must use this value when it is
   * present. */
  readonly output?: string;
  readonly state: string;
  readonly queryable: boolean;
  readonly selector?: DataframeSelector;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  readonly materializationId?: string;
  readonly columns?: ReadonlyArray<ExplorerPhysicalColumnV2>;
}

export interface ExplorerDatasetMetadataV2 {
  readonly generation?: string;
  readonly schemaDigest?: string;
  readonly outputs: ReadonlyArray<ExplorerDatasetOutputV2>;
}

export interface ExplorerPublicationMetadataV2 {
  readonly state: string;
  readonly generation?: string;
  readonly executionId?: string;
  readonly revisionId?: string;
  readonly updatedAt?: string;
}
export interface RepositoryExplorerConfig extends ExplorerLifecycleMetadataV2 {
  readonly project: string;
  readonly explorerId: string;
  readonly management: 'REPOSITORY' | 'INTERACTIVE';
  /**
   * Repository/default responses may contain deployment metadata without a
   * presentation document. Interactive Explorer responses still include the
   * authored V2 document here.
   */
  readonly activeConfig?: ExplorerConfigV2;
  /** Recipe/schema baseline for the repository default; not a presentation packet. */
  readonly baselineConfig?: Readonly<Record<string, unknown>>;
  /** Draft/publication fields are returned by the V2 authoring endpoints. */
  readonly draftConfig?: ExplorerConfigV2;
  readonly draftVersion?: number;
  readonly draftDigest?: string;
  readonly activeRevisionId?: string;
  readonly updatedBy?: string;
  readonly sourceGeneration?: string;
  readonly sourceCommit?: string;
  readonly executionId?: string;
  /** Live schema/readiness metadata for the repository default Explorer. */
  readonly datasets?: ReadonlyArray<LoomDataset>;
  readonly dataset?: ExplorerDatasetMetadataV2;
  readonly emittedColumns?: ReadonlyArray<ExplorerPhysicalColumnV2>;
  readonly publication?: ExplorerPublicationMetadataV2;
  readonly publicationState?: string;
  /** Kept for compatibility with the older activeConfig response shape. */
  readonly materializations?: ReadonlyArray<{
    readonly outputId: string;
    readonly output: string;
    readonly materializationId: string;
    readonly columns: ReadonlyArray<LoomColumn>;
  }>;
  readonly updatedAt: string;
  readonly diagnostics?: ReadonlyArray<ExplorerDiagnostic>;
  readonly activeUrl?: string;
  readonly shareUrl?: string;
}

export type ExplorerApiErrorCode =
  | 'DRAFT_CONFLICT'
  | 'PUBLICATION_CONFLICT'
  | 'EXPLORER_NOT_FOUND'
  | 'REPOSITORY_READ_ONLY'
  | 'VALIDATION_FAILED'
  | 'CATALOG_INCOMPLETE'
  | 'AUTHENTICATION_REQUIRED';

export interface ExplorerApiError {
  readonly status: number | 'FETCH_ERROR' | 'CUSTOM_ERROR';
  readonly code?: ExplorerApiErrorCode | string;
  readonly message?: string;
  readonly currentVersion?: number;
  readonly currentDigest?: string;
  readonly updatedAt?: string;
  readonly diagnostics?: ReadonlyArray<ExplorerDiagnostic>;
  readonly endpoint?: string;
  readonly requestId?: string;
  readonly fieldPath?: string | null;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface ExplorerAuthoringCatalogRequest {
  readonly project: string;
  readonly explorerId: string;
  readonly output: string;
  readonly config: ExplorerConfigV2;
  /** Immutable dataset generation returned by the project graph. Candidate
   * discovery must inspect the same generation as the graph and preview. */
  readonly datasetGeneration?: string;
}

export interface ExplorerAuthoringCandidate {
  readonly id: string;
  readonly resourceType: string;
  readonly path: string;
  readonly label: string;
  /** Exact public dataframe column name supplied by Loom when known. */
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
  /** Native recipe declaration metadata returned by Loom. These values are
   * used to author fields; the candidate id remains snapshot-local and is
   * never persisted in ExplorerConfig V2. */
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

export interface ExplorerAuthoringCatalogResponse {
  readonly snapshotToken: string;
  readonly catalogDigest: string;
  readonly sourceGeneration?: string;
  readonly resolvedSchemaDigest?: string;
  readonly authScopeDigest?: string;
  readonly baseRecipeDigest?: string;
  readonly complete: boolean;
  readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
  readonly resources: ReadonlyArray<{
    readonly resourceType: string;
    readonly label: string;
    readonly count?: number;
  }>;
  readonly relationships: ReadonlyArray<{
    readonly id: string;
    readonly source: string;
    readonly target: string;
    readonly label: string;
    readonly linkCount?: number;
    readonly cardinality?: string;
    readonly direction?: 'outbound' | 'inbound';
  }>;
  readonly candidates: ReadonlyArray<ExplorerAuthoringCandidate>;
}

export interface ExplorerAuthoringCompileRequest {
  readonly project: string;
  readonly explorerId: string;
  readonly output: string;
  readonly config: ExplorerConfigV2;
  readonly snapshotToken: string;
  readonly selectedCandidateIdsByNode: Readonly<
    Record<string, ReadonlyArray<string>>
  >;
  readonly expectedDraftVersion?: number;
  readonly expectedDraftDigest?: string;
}

export interface ExplorerAuthoringCompileResponse {
  readonly config: ExplorerConfigV2;
  readonly output: string;
  readonly digest: string;
  readonly snapshotToken: string;
  readonly recipeDigest?: string;
  readonly resolvedSchemaDigest?: string;
  readonly sourceGeneration?: string;
  readonly emittedColumns: ReadonlyArray<{
    readonly name: string;
    readonly logicalType: string;
    readonly filterable: boolean;
    readonly chartable: boolean;
  }>;
  readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
  readonly materializationMappings?: ReadonlyArray<ExplorerMaterializationMappingV2>;
}

export interface ExplorerConfigValidationResult {
  readonly valid: boolean;
  readonly diagnostics: ReadonlyArray<ExplorerDiagnostic>;
}

/** Lightweight envelope validation for client-side request guardrails. Loom
 * remains authoritative for semantic, catalog, and execution validation. */
export const validateExplorerConfigV2 = (
  value: unknown,
  expectedProject?: string,
  expectedExplorerId?: string,
): ExplorerConfigValidationResult => {
  const diagnostics: ExplorerDiagnostic[] = [];
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  if (!record) {
    diagnostics.push({
      severity: 'error',
      code: 'INVALID_EXPLORER_CONFIG',
      message: 'ExplorerConfig V2 must be a JSON object.',
      configPath: '$',
    });
    return { valid: false, diagnostics };
  }
  if (record.apiVersion !== 'loom.calypr.org/explorer-config/v2')
    diagnostics.push({
      severity: 'error',
      code: 'UNSUPPORTED_EXPLORER_CONFIG_VERSION',
      message: 'ExplorerConfig must use loom.calypr.org/explorer-config/v2.',
      configPath: '$.apiVersion',
    });
  if (record.kind !== 'ExplorerConfig')
    diagnostics.push({
      severity: 'error',
      code: 'INVALID_EXPLORER_CONFIG_KIND',
      message: 'ExplorerConfig V2 must have kind ExplorerConfig.',
      configPath: '$.kind',
    });
  if (typeof record.project !== 'string' || !record.project.trim())
    diagnostics.push({
      severity: 'error',
      code: 'PROJECT_REQUIRED',
      message: 'ExplorerConfig V2 requires a project identity.',
      configPath: '$.project',
    });
  else if (expectedProject && record.project !== expectedProject)
    diagnostics.push({
      severity: 'error',
      code: 'PROJECT_MISMATCH',
      message: 'ExplorerConfig project does not match the requested project.',
      configPath: '$.project',
    });
  const explorer =
    record.explorer && typeof record.explorer === 'object'
      ? (record.explorer as Record<string, unknown>)
      : undefined;
  if (!explorer) {
    diagnostics.push({
      severity: 'error',
      code: 'EXPLORER_IDENTITY_REQUIRED',
      message: 'ExplorerConfig V2 requires an explorer identity.',
      configPath: '$.explorer',
    });
  } else {
    if (typeof explorer.id !== 'string' || !explorer.id.trim())
      diagnostics.push({
        severity: 'error',
        code: 'EXPLORER_ID_REQUIRED',
        message: 'ExplorerConfig V2 requires explorer.id.',
        configPath: '$.explorer.id',
      });
    else if (expectedExplorerId && explorer.id !== expectedExplorerId)
      diagnostics.push({
        severity: 'error',
        code: 'EXPLORER_ID_MISMATCH',
        message:
          'ExplorerConfig explorer.id does not match the requested Explorer.',
        configPath: '$.explorer.id',
      });
    if (
      explorer.management !== 'repository' &&
      explorer.management !== 'interactive'
    )
      diagnostics.push({
        severity: 'error',
        code: 'INVALID_EXPLORER_MANAGEMENT',
        message:
          'ExplorerConfig explorer.management must be repository or interactive.',
        configPath: '$.explorer.management',
      });
  }
  if (
    !record.recipe ||
    typeof record.recipe !== 'object' ||
    Array.isArray(record.recipe)
  )
    diagnostics.push({
      severity: 'error',
      code: 'RECIPE_REQUIRED',
      message: 'ExplorerConfig V2 requires a recipe envelope.',
      configPath: '$.recipe',
    });
  if (!Array.isArray(record.views))
    diagnostics.push({
      severity: 'error',
      code: 'VIEWS_REQUIRED',
      message: 'ExplorerConfig V2 requires a views array.',
      configPath: '$.views',
    });
  return { valid: diagnostics.length === 0, diagnostics };
};

export const isExplorerConfigV2 = (value: unknown): value is ExplorerConfigV2 =>
  validateExplorerConfigV2(value).valid;
