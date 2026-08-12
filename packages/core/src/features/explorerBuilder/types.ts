import type { JSONValue } from '../../types';
import type { LoomColumn } from '../loom';

export interface BuilderDiagnostic {
  readonly severity: 'error' | 'warning';
  readonly code: string;
  readonly configPath?: string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly requestId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface BuilderProject {
  readonly organization: string;
  readonly project: string;
}

export type RecipeAuthoringDocument = Readonly<Record<string, JSONValue>>;
export type ExplorerAuthoringDocument = Readonly<Record<string, JSONValue>>;

/**
 * Researcher-facing concept metadata returned by Loom's semantic catalog.
 * These fields intentionally remain open strings: deployments can add source
 * systems, families, rules, and logical types without a frontend release.
 */
export interface SemanticConceptSource {
  readonly system?: string;
  readonly standardVersion?: string;
  readonly kind?: string;
  readonly resourceType?: string;
  readonly keyPaths?: ReadonlyArray<string>;
  readonly valuePaths?: ReadonlyArray<string>;
  readonly logicalType?: string;
  readonly terminology?: Readonly<Record<string, string>>;
  readonly [key: string]: unknown;
}

export interface SemanticConceptSelector {
  readonly sourcePath?: string;
  readonly valuePath?: string;
  readonly [key: string]: unknown;
}

export interface SemanticConceptColumn {
  readonly name: string;
  readonly logicalType?: string;
  readonly nullable?: boolean;
  readonly repeated?: boolean;
  readonly filterable?: boolean;
  readonly sortable?: boolean;
  readonly aggregatable?: boolean;
  readonly [key: string]: unknown;
}

export interface SemanticConceptPopulation {
  readonly recordCount?: number;
  readonly fraction?: number;
  readonly [key: string]: unknown;
}

export interface SemanticConceptExamples {
  readonly values?: ReadonlyArray<unknown>;
  readonly suppressed?: boolean;
  readonly reason?: string;
  readonly [key: string]: unknown;
}

export interface SemanticConceptRepetition {
  readonly shape?: string;
  readonly rowExpansion?: string;
  readonly maxItemsObserved?: number;
  readonly [key: string]: unknown;
}

export interface SemanticConcept {
  readonly id: string;
  readonly label: string;
  readonly family?: string;
  readonly ruleId: string;
  readonly description?: string;
  readonly source?: SemanticConceptSource;
  readonly selector?: SemanticConceptSelector;
  readonly column: SemanticConceptColumn;
  readonly population?: SemanticConceptPopulation;
  readonly examples?: SemanticConceptExamples;
  readonly repetition?: SemanticConceptRepetition;
  readonly [key: string]: unknown;
}

export interface SemanticConceptFamily {
  readonly id: string;
  readonly label?: string;
  readonly concepts: ReadonlyArray<SemanticConcept>;
  readonly [key: string]: unknown;
}

export interface SemanticConceptResource {
  readonly resourceType: string;
  readonly label?: string;
  readonly documentCount?: number;
  readonly families: ReadonlyArray<SemanticConceptFamily>;
  readonly [key: string]: unknown;
}

export interface SemanticCatalogCompleteness {
  readonly state?: string;
  readonly resourceLimit?: number;
  readonly conceptLimitPerResource?: number;
  readonly returnedResourceCount?: number;
  readonly returnedConceptCount?: number;
  readonly [key: string]: unknown;
}

export interface SemanticCatalogDiagnostic {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface SemanticConceptCatalog {
  readonly schemaVersion: number;
  readonly catalogId?: string;
  readonly project?: Readonly<{ organization?: string; project?: string }>;
  readonly source?: Readonly<Record<string, unknown>>;
  readonly completeness?: SemanticCatalogCompleteness;
  readonly resources: ReadonlyArray<SemanticConceptResource>;
  readonly diagnostics: ReadonlyArray<SemanticCatalogDiagnostic>;
}

/** A single, value-bearing column offered by Loom for one authored recipe family. */
export interface RecipeColumnCandidate {
  readonly id: string;
  readonly output: string;
  readonly nodePath: string;
  readonly familyId: string;
  readonly familyKind: 'FIELD' | 'CATALOG_PROJECTION' | 'DYNAMIC' | 'EXTENSION' | 'PIVOT' | string;
  readonly familyName: string;
  readonly patchPath: string;
  readonly rawKey: string;
  /** Exact native value to write to the family's columns declaration. */
  readonly selectionKey: string;
  readonly rawSystem: string;
  readonly rawCode: string;
  readonly extensionUrl: string;
  readonly publicName: string;
  readonly label: string;
  readonly valueSelector: string;
  readonly valueType: string;
  readonly cardinality: string;
  readonly population: number;
  readonly examples: ReadonlyArray<string>;
  readonly selected: boolean;
  readonly complete: boolean;
  readonly diagnostic: string;
  /** Serialized native ExtensionColumnMapping when familyKind is EXTENSION. */
  readonly extensionMapping?: string;
}

export interface RecipeColumnCandidateCompleteness {
  readonly complete: boolean;
  readonly totalCount: number;
  readonly returnedCount: number;
  readonly blockingDiagnosticCount: number;
}

export interface RecipeColumnCandidateConnection {
  readonly nodes: ReadonlyArray<RecipeColumnCandidate>;
  readonly pageInfo: Readonly<{ hasNextPage: boolean; endCursor?: string | null }>;
  readonly completeness: RecipeColumnCandidateCompleteness;
  readonly diagnostics: ReadonlyArray<SemanticCatalogDiagnostic>;
}

export interface PublishedOutputRef {
  readonly output: string;
  readonly materializationId: string;
  readonly recipeName: string;
  readonly translationVersion: string;
  readonly recipeDigest: string;
  readonly resolvedSchemaDigest: string;
  readonly sourceGeneration: string;
  readonly columns?: ReadonlyArray<LoomColumn>;
}

export interface RecipeDraftValidation {
  readonly recipeDigest?: string;
  readonly resolvedSchemaDigest?: string;
  readonly sourceGeneration?: string;
  readonly outputs: ReadonlyArray<{
    readonly name: string;
    readonly rootResourceType: string;
    readonly rowGrain: string;
    readonly columns: ReadonlyArray<LoomColumn>;
  }>;
  readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
}

export interface RecipeDraftPreview {
  readonly validation: RecipeDraftValidation;
  readonly output: string;
  readonly columns: ReadonlyArray<LoomColumn>;
  readonly rows: ReadonlyArray<Readonly<Record<string, JSONValue>>>;
  readonly rowCount: number;
}

export interface ProjectRecipeDraft {
  readonly project: string;
  readonly source: 'platform-default' | 'project-draft';
  readonly draftVersion: number;
  readonly document: RecipeAuthoringDocument;
  readonly authoringDigest: string;
  readonly baseRevisionId?: string | null;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
}

export interface ProjectRecipeRevision {
  readonly id: string;
  readonly project: string;
  readonly revisionNumber: number;
  readonly recipeName: string;
  readonly translationVersion: string;
  readonly canonicalDocument?: RecipeAuthoringDocument;
  readonly authoringDigest: string;
  readonly recipeDigest: string;
  readonly resolvedSchemaDigest: string;
  readonly sourceGeneration: string;
  readonly status: 'VALIDATING' | 'MATERIALIZING' | 'READY' | 'FAILED';
  readonly outputs: ReadonlyArray<PublishedOutputRef>;
  readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
  readonly createdBy?: string;
  readonly createdAt: string;
  readonly readyAt?: string | null;
}

export interface ExplorerBuilderState {
  readonly projectId: string;
  readonly configId: string;
  readonly title: string;
  readonly draftContent: ExplorerAuthoringDocument;
  readonly draftVersion: number;
  readonly baseRevisionId?: string | null;
  readonly activeReleaseId?: string | null;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
}

export interface ExplorerConfigRevision {
  readonly id: string;
  readonly projectId: string;
  readonly configId: string;
  readonly revisionNumber: number;
  readonly content: ExplorerAuthoringDocument;
  readonly contentDigest: string;
  readonly loomRecipeRevisionId: string;
  readonly publishedOutputs: ReadonlyArray<PublishedOutputRef>;
  readonly status: 'VALID' | 'VALID_WITH_OMISSIONS' | 'INVALID';
  readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
  readonly createdBy?: string;
  readonly createdAt: string;
}

export interface ExplorerRelease {
  readonly releaseId: string;
  readonly explorerRevisionId: string;
  readonly shareUrl: string;
}

export interface ResolvedExplorerRelease {
  readonly status: 'VALID' | 'VALID_WITH_OMISSIONS' | 'UNAVAILABLE';
  readonly releaseId: string;
  readonly configRevisionId: string;
  readonly project: BuilderProject;
  readonly recipeRevisionId: string;
  readonly recipeName: string;
  readonly translationVersion: string;
  readonly recipeDigest: string;
  readonly sourceGeneration: string;
  readonly outputs: Readonly<Record<string, PublishedOutputRef>>;
  readonly config: ExplorerAuthoringDocument;
  readonly errors: ReadonlyArray<BuilderDiagnostic>;
  readonly warnings: ReadonlyArray<BuilderDiagnostic>;
  readonly acknowledgedOmissions: ReadonlyArray<BuilderDiagnostic>;
}

export interface BuilderApiError {
  readonly status: number | string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly diagnostics: ReadonlyArray<BuilderDiagnostic>;
  readonly currentVersion?: number;
  readonly currentDigest?: string;
  readonly updatedAt?: string;
}
