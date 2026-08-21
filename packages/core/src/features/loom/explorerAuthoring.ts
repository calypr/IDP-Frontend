import type { DataframeSelector } from './types';

/** Structured diagnostics returned by Loom at every Builder boundary. */
export interface ExplorerAuthoringDiagnosticV1 {
  readonly severity: 'error' | 'warning' | 'info';
  readonly stage?: string;
  readonly code: string;
  readonly path?: string | null;
  readonly fieldPath?: string | null;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly requestId?: string;
}

/** Opaque catalog identities supplied by Loom. */
export interface LoomBuilderOutput { readonly id: string; readonly title?: string }
export interface LoomBuilderDocument {
  readonly kind: 'ExplorerBuilderDocument';
  readonly output: LoomBuilderOutput;
  readonly baseNodeId: string;
  readonly rowNodeId: string;
  readonly routeEdgeIds?: ReadonlyArray<string>;
  readonly routeOccurrences?: ReadonlyArray<{ readonly id: string; readonly index: number; readonly nodeId: string; readonly incomingEdgeId?: string }>;
  readonly candidateIds?: ReadonlyArray<string>;
  readonly candidateOccurrences?: ReadonlyArray<{ readonly candidateId: string; readonly occurrenceId: string }>;
  readonly presentation?: Readonly<Record<string, { readonly label?: string; readonly visible?: boolean; readonly order?: number; readonly table?: { readonly pinned?: boolean }; readonly filter?: { readonly label?: string }; readonly chart?: { readonly type: string; readonly title?: string } }>>;
}
export interface LoomAuthoringBundle {
  readonly apiVersion: 'loom.calypr.org/explorer-authoring/v1';
  readonly kind: 'ExplorerAuthoringBundle';
  readonly project: string;
  readonly explorerId: string;
  readonly title?: string;
  readonly document?: LoomBuilderDocument;
  readonly documents?: ReadonlyArray<LoomBuilderDocument>;
  readonly tabs?: ReadonlyArray<{ readonly id: string; readonly title: string; readonly outputId: string; readonly order: number; readonly visible?: boolean }>;
}
export interface LoomBuilderCatalog {
  readonly snapshotToken: string;
  readonly generation: string;
  readonly resolvedSchemaDigest?: string;
  readonly authorizationScopeDigest?: string;
  readonly nodes: ReadonlyArray<{ readonly nodeId: string; readonly resourceType: string }>;
  readonly edges: ReadonlyArray<{ readonly edgeId: string; readonly fromNodeId: string; readonly toNodeId: string; readonly label: string }>;
  readonly candidates: ReadonlyArray<{ readonly candidateId: string; readonly nodeId: string; readonly label: string; readonly logicalType: string; readonly filterable: boolean; readonly chartable: boolean }>;
}
export interface LoomResolvedBinding {
  readonly outputId: string;
  readonly outputTitle?: string;
  readonly baseNodeId: string;
  readonly baseResourceType: string;
  readonly rowNodeId: string;
  readonly rowResourceType: string;
  readonly rowGrain: string;
  readonly routeKind: string;
  readonly routeOccurrences: ReadonlyArray<{ readonly occurrenceId: string; readonly index: number; readonly nodeId: string; readonly resourceType: string; readonly incomingEdgeId?: string }>;
  readonly candidateEmissions: ReadonlyArray<{ readonly candidateId: string; readonly occurrenceId: string; readonly emissionId: string; readonly label: string; readonly logicalType: string; readonly filterable: boolean; readonly chartable: boolean }>;
}
export interface ExplorerBuilderStateV1 {
  readonly apiVersion: 'loom.calypr.org/explorer-authoring/v1';
  readonly kind: 'ExplorerBuilderState';
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly bundle: LoomAuthoringBundle;
  readonly catalog: LoomBuilderCatalog;
  readonly bindings: ReadonlyArray<LoomResolvedBinding>;
  readonly active: { readonly revisionId?: string; readonly state?: string; readonly generation?: string; readonly intentDigest?: string; readonly publishedAt?: string };
  readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnosticV1>;
}

/** Server-owned runtime projection retained for viewer/ETL consumers. */
export interface PublicationMetadata { readonly state: string; readonly generation?: string; readonly executionId?: string; readonly revisionId?: string; readonly updatedAt?: string }
export interface ExplorerRuntimeColumnV1 { readonly emissionId: string; readonly name: string; readonly label: string; readonly logicalType: string; readonly visible: boolean; readonly order: number; readonly repeated?: boolean; readonly filterable: boolean; readonly sortable?: boolean; readonly chartable: boolean; readonly aggregatable?: boolean }
export type ExplorerRuntimeColumnsV1 = ReadonlyArray<ExplorerRuntimeColumnV1> | Readonly<Record<string, ExplorerRuntimeColumnV1>>;
export interface ExplorerRuntimeBindingV1 { readonly emissionId: string; readonly outputId?: string; readonly label?: string; readonly type?: string; readonly title?: string }
export interface ExplorerRuntimeOutputV1 {
  readonly outputId: string;
  readonly name: string;
  readonly title: string;
  readonly rowLabel: string;
  readonly selector: DataframeSelector;
  readonly columns: ExplorerRuntimeColumnsV1;
  readonly table: { readonly columns: ReadonlyArray<ExplorerRuntimeBindingV1 & { readonly visible: boolean }> };
  readonly filters: ReadonlyArray<ExplorerRuntimeBindingV1>;
  readonly charts: ReadonlyArray<ExplorerRuntimeBindingV1>;
  readonly fixedFilters: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly query?: Readonly<Record<string, unknown>>;
  readonly materialization?: Readonly<Record<string, unknown>>;
}
export interface ExplorerRuntimeV1 {
  readonly generation?: string;
  readonly publication?: PublicationMetadata;
  readonly schema?: { readonly digest?: string; readonly version?: string };
  readonly outputs: ReadonlyArray<ExplorerRuntimeOutputV1>;
  readonly sharedFilters: Readonly<Record<string, ReadonlyArray<ExplorerRuntimeBindingV1>>>;
  readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnosticV1>;
}

/** Opaque generated metadata retained only for the runtime compatibility adapter. */
export interface ExplorerStateAuthoringBundleV1 {
  readonly apiVersion: 'loom.calypr.org/explorer-authoring/v1';
  readonly kind: 'ExplorerAuthoringBundle';
  readonly project: string;
  readonly explorerId: string;
  readonly title?: string;
  readonly document?: Readonly<Record<string, unknown>>;
  readonly documents?: ReadonlyArray<Readonly<Record<string, unknown>>>;
  readonly tabs?: ReadonlyArray<{ readonly id: string; readonly title: string; readonly outputId: string; readonly order: number; readonly visible?: boolean }>;
}
export interface ExplorerStateEmittedColumnV1 {
  readonly emissionId: string;
  readonly outputId: string;
  readonly nodeId?: string;
  readonly selectionId?: string;
  readonly candidateId?: string;
  readonly occurrenceId?: string;
  readonly publicColumn: string;
  readonly logicalType: string;
  readonly filterable: boolean;
  readonly chartable: boolean;
}
export interface ExplorerStatePhysicalColumnV1 { readonly name: string; readonly semanticPath?: string; readonly clickhouseType?: string; readonly logicalType?: string; readonly nullable?: boolean; readonly repeated?: boolean; readonly provenance?: string; readonly loomOwned?: boolean }
export interface ExplorerStateDatasetOutputV1 { readonly name: string; readonly state: string; readonly queryable: boolean; readonly fingerprint?: string; readonly selector?: DataframeSelector; readonly columns?: ReadonlyArray<ExplorerStatePhysicalColumnV1> }
export interface ExplorerStateMaterializationV1 { readonly outputId: string; readonly output: string; readonly materializationId: string; readonly fingerprint?: string; readonly selector?: DataframeSelector; readonly columns: ReadonlyArray<ExplorerStatePhysicalColumnV1> }

/** Runtime-only selected Explorer response. Editable state is never read here. */
export interface ExplorerStateV1 {
  readonly apiVersion: 'loom.calypr.org/explorer-state/v1';
  readonly kind: 'ExplorerState';
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly management: 'repository' | 'interactive' | 'REPOSITORY' | 'INTERACTIVE';
  readonly draft: { readonly bundle?: ExplorerStateAuthoringBundleV1; readonly receiptId?: string; readonly version: number; readonly digest: string; readonly intentDigest?: string };
  readonly active: { readonly bundle?: ExplorerStateAuthoringBundleV1; readonly revisionId?: string; readonly intentDigest?: string; readonly status?: string };
  readonly generated: {
    readonly recipeDigest?: string;
    readonly sourceGeneration?: string;
    readonly resolvedSchemaDigest?: string;
    readonly emittedColumns?: ReadonlyArray<ExplorerStateEmittedColumnV1>;
    readonly materializations?: ReadonlyArray<ExplorerStateMaterializationV1>;
    readonly dataset?: { readonly outputs: ReadonlyArray<ExplorerStateDatasetOutputV1> };
    readonly publication?: PublicationMetadata;
    readonly diagnostics?: ReadonlyArray<ExplorerAuthoringDiagnosticV1>;
  };
  readonly activeUrl: string;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
  readonly runtime?: ExplorerRuntimeV1;
}

const allowedKeys = new Set(['apiVersion', 'kind', 'project', 'explorerId', 'title', 'management', 'active', 'generated', 'activeUrl', 'updatedBy', 'updatedAt', 'runtime', 'draft']);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
export const isExplorerStateV1 = (value: unknown): value is ExplorerStateV1 => {
  if (!isRecord(value) || !Object.keys(value).every((key) => allowedKeys.has(key))) return false;
  return value.apiVersion === 'loom.calypr.org/explorer-state/v1' && value.kind === 'ExplorerState' && typeof value.project === 'string' && typeof value.explorerId === 'string' && typeof value.title === 'string' && typeof value.management === 'string';
};
export const assertExplorerStateV1 = (value: unknown): ExplorerStateV1 => {
  if (!isExplorerStateV1(value)) throw new Error('Loom returned an invalid ExplorerStateV1 response; legacy Explorer configuration fields are not supported.');
  return value;
};
