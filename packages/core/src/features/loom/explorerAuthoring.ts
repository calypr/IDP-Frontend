import { z } from 'zod';
import type { DataframeSelector } from './types';

export const EXPLORER_AUTHORING_API_VERSION =
  'loom.calypr.org/explorer-authoring/v2' as const;

const opaqueIdSchema = z.string().trim().min(1);
const projectionModeSchema = opaqueIdSchema.regex(/^[A-Z][A-Z0-9_]*$/);
const unknownRecordSchema = z.record(z.string(), z.unknown());

/** Strict wire contracts for Loom's browser authoring surface. */
export const explorerAuthoringDiagnosticSchema = z
  .object({
    severity: z.enum(['error', 'warning', 'info']),
    stage: z.string().optional(),
    code: opaqueIdSchema,
    path: z.string().nullable().optional(),
    fieldPath: z.string().nullable().optional(),
    message: z.string(),
    details: unknownRecordSchema.optional(),
    requestId: z.string().optional(),
  })
  .strict();
export type ExplorerAuthoringDiagnostic = z.infer<
  typeof explorerAuthoringDiagnosticSchema
>;

export const explorerPresentationIntentSchema = z
  .object({
    label: z.string().optional(),
    visible: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
    table: z.object({ pinned: z.boolean().optional() }).strict().optional(),
    filter: z.object({ label: z.string().optional() }).strict().optional(),
    chart: z
      .object({ type: opaqueIdSchema, title: z.string().optional() })
      .strict()
      .optional(),
  })
  .strict();
export type ExplorerPresentationIntent = z.infer<
  typeof explorerPresentationIntentSchema
>;

export const explorerBuilderRouteStepSchema = z
  .object({
    edgeId: opaqueIdSchema,
    occurrenceId: opaqueIdSchema.optional(),
  })
  .strict();
export type ExplorerBuilderRouteStep = z.infer<
  typeof explorerBuilderRouteStepSchema
>;
export const explorerBuilderSelectionSchema = z
  .object({
    candidateId: opaqueIdSchema,
    occurrenceId: opaqueIdSchema,
    projectionMode: projectionModeSchema,
  })
  .strict();
export type ExplorerBuilderSelection = z.infer<
  typeof explorerBuilderSelectionSchema
>;
export const explorerBuilderDocumentSchema = z
  .object({
    kind: z.literal('ExplorerBuilderDocument'),
    output: z
      .object({ id: opaqueIdSchema, title: z.string().optional() })
      .strict(),
    rootNodeId: opaqueIdSchema,
    routeSteps: z.array(explorerBuilderRouteStepSchema),
    selections: z.array(explorerBuilderSelectionSchema),
    presentation: z
      .record(z.string(), explorerPresentationIntentSchema)
      .optional(),
  })
  .strict();
export type ExplorerBuilderDocument = z.infer<
  typeof explorerBuilderDocumentSchema
>;

export const explorerBuilderTabSchema = z
  .object({
    id: opaqueIdSchema,
    title: z.string(),
    outputId: opaqueIdSchema,
    order: z.number().int().nonnegative(),
    visible: z.boolean().optional(),
  })
  .strict();
export const explorerBuilderWorkspaceSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerBuilderWorkspace'),
    documents: z.array(explorerBuilderDocumentSchema),
    tabs: z.array(explorerBuilderTabSchema),
  })
  .strict()
  .superRefine((workspace, context) => {
    const outputIds = workspace.documents.map((document) => document.output.id);
    const tabIds = workspace.tabs.map((tab) => tab.id);
    const tabOutputIds = workspace.tabs.map((tab) => tab.outputId);
    const duplicate = (values: ReadonlyArray<string>) =>
      values.find((value, index) => values.indexOf(value) !== index);
    if (duplicate(outputIds)) {
      context.addIssue({
        code: 'custom',
        path: ['documents'],
        message: 'Document output IDs must be unique.',
      });
    }
    if (duplicate(tabIds)) {
      context.addIssue({
        code: 'custom',
        path: ['tabs'],
        message: 'Tab IDs must be unique.',
      });
    }
    if (
      duplicate(tabOutputIds) ||
      outputIds.length !== tabOutputIds.length ||
      outputIds.some((outputId) => !tabOutputIds.includes(outputId))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['tabs'],
        message: 'Tabs and document outputs must have a one-to-one mapping.',
      });
    }
  });
export type ExplorerBuilderWorkspace = z.infer<
  typeof explorerBuilderWorkspaceSchema
>;

export const explorerBuilderRoutePolicySchema = z
  .object({
    allowRepeatedEdges: z.boolean().optional(),
    allowSelfLoops: z.boolean().optional(),
    repeatedEdges: z.boolean().optional(),
    selfLoops: z.boolean().optional(),
    maxSteps: z.number().int().positive().nullable().optional(),
  })
  .strict();
export const explorerBuilderCatalogNodeSchema = z
  .object({
    nodeId: opaqueIdSchema,
    resourceType: opaqueIdSchema,
    rowRootEligible: z.boolean(),
    rowGrain: z.string().optional(),
    populated: z.boolean(),
    documentCount: z.number().int().nonnegative(),
  })
  .strict();
export const explorerBuilderCatalogEdgeSchema = z
  .object({
    edgeId: opaqueIdSchema,
    fromNodeId: opaqueIdSchema,
    toNodeId: opaqueIdSchema,
    label: z.string(),
    populated: z.boolean().optional(),
  })
  .strict();
export const explorerBuilderCandidateSchema = z
  .object({
    candidateId: opaqueIdSchema,
    nodeId: opaqueIdSchema,
    label: z.string(),
    logicalType: opaqueIdSchema,
    repeated: z.boolean().optional(),
    filterable: z.boolean(),
    chartable: z.boolean(),
    projectionModes: z.array(projectionModeSchema).min(1),
    defaultProjectionMode: projectionModeSchema,
  })
  .strict();
export const explorerBuilderCatalogSchema = z
  .object({
    snapshotToken: opaqueIdSchema,
    generation: opaqueIdSchema,
    resolvedSchemaDigest: z.string().optional(),
    authorizationScopeDigest: z.string().optional(),
    complete: z.boolean().optional(),
    routePolicy: explorerBuilderRoutePolicySchema,
    nodes: z.array(explorerBuilderCatalogNodeSchema),
    edges: z.array(explorerBuilderCatalogEdgeSchema),
    candidates: z.array(explorerBuilderCandidateSchema).optional(),
  })
  .strict();
export type ExplorerBuilderCatalog = z.infer<
  typeof explorerBuilderCatalogSchema
>;
export type ExplorerBuilderCandidate = z.infer<
  typeof explorerBuilderCandidateSchema
>;

export const explorerBuilderStateSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerBuilderState'),
    workspace: explorerBuilderWorkspaceSchema.nullable().optional(),
    catalog: explorerBuilderCatalogSchema,
  })
  .strict();
export type ExplorerBuilderState = z.infer<typeof explorerBuilderStateSchema>;

export const explorerBuilderEmissionSchema = z
  .object({
    outputId: opaqueIdSchema,
    candidateId: opaqueIdSchema,
    occurrenceId: opaqueIdSchema,
    projectionMode: projectionModeSchema,
    emissionId: opaqueIdSchema,
    publicColumn: opaqueIdSchema,
    label: z.string(),
    logicalType: opaqueIdSchema,
    filterable: z.boolean(),
    chartable: z.boolean(),
  })
  .strict();
export type ExplorerBuilderEmission = z.infer<
  typeof explorerBuilderEmissionSchema
>;
export const explorerBuilderReceiptOutputSchema = z
  .object({
    outputId: opaqueIdSchema,
    title: z.string().optional(),
    rowGrain: z.string().optional(),
    emissions: z.array(explorerBuilderEmissionSchema),
  })
  .strict();
export const explorerBuilderCompileResultSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerBuilderReceipt'),
    receiptId: opaqueIdSchema,
    snapshotToken: opaqueIdSchema,
    generation: z.string().optional(),
    intentDigest: z.string().optional(),
    compilerVersion: z.string().optional(),
    builder: explorerBuilderWorkspaceSchema,
    outputs: z.array(explorerBuilderReceiptOutputSchema),
    diagnostics: z.array(explorerAuthoringDiagnosticSchema),
  })
  .strict();
export type ExplorerBuilderCompileResult = z.infer<
  typeof explorerBuilderCompileResultSchema
>;

export const explorerBuilderPreviewColumnSchema =
  explorerBuilderEmissionSchema;
export const explorerBuilderPreviewResultSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerBuilderPreview'),
    receiptId: opaqueIdSchema,
    outputId: opaqueIdSchema,
    columns: z.array(explorerBuilderPreviewColumnSchema),
    rows: z.array(unknownRecordSchema).nullable(),
    rowCount: z.number().int().nonnegative(),
    diagnostics: z.array(explorerAuthoringDiagnosticSchema),
  })
  .strict();
export type ExplorerBuilderPreviewResult = z.infer<
  typeof explorerBuilderPreviewResultSchema
>;

export const explorerBuilderPublishResultSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerBuilderPublication'),
    receiptId: opaqueIdSchema,
    revisionId: opaqueIdSchema,
    state: z.string(),
    outputs: z.array(
      z
        .object({
          outputId: opaqueIdSchema,
          state: z.string(),
          materializationId: z.string().optional(),
        })
        .strict(),
    ),
    diagnostics: z.array(explorerAuthoringDiagnosticSchema),
  })
  .strict();
export type ExplorerBuilderPublishResult = z.infer<
  typeof explorerBuilderPublishResultSchema
>;

export const explorerBuilderSuggestionsResultSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerBuilderCandidateSuggestions'),
    snapshotToken: opaqueIdSchema,
    nodeId: opaqueIdSchema,
    candidates: z.array(explorerBuilderCandidateSchema),
    diagnostics: z.array(explorerAuthoringDiagnosticSchema),
  })
  .strict();
export type ExplorerBuilderSuggestionsResult = z.infer<
  typeof explorerBuilderSuggestionsResultSchema
>;

export const explorerAuthoringCapabilitiesSchema = z
  .object({
    apiVersion: z.literal(EXPLORER_AUTHORING_API_VERSION),
    kind: z.literal('ExplorerAuthoringCapabilities'),
    operations: z.array(z.string()),
    previewLimits: z.array(z.number().int().positive()).optional(),
    features: z
      .object({
        emissionFilters: z.boolean(),
        emissionCharts: z.boolean(),
        sharedFilters: z.boolean(),
        fixedFilters: z.boolean(),
        fileActions: z.boolean(),
        deleteExplorer: z.boolean(),
      })
      .strict(),
  })
  .strict();
export type ExplorerAuthoringCapabilities = z.infer<
  typeof explorerAuthoringCapabilitiesSchema
>;

export const explorerAuthoringErrorSchema = z
  .object({
    code: opaqueIdSchema,
    message: z.string(),
    diagnostics: z.array(explorerAuthoringDiagnosticSchema).optional(),
    requestId: z.string().optional(),
    details: unknownRecordSchema.optional(),
  })
  .strict();
export type ExplorerAuthoringError = z.infer<
  typeof explorerAuthoringErrorSchema
>;

export const assertExplorerBuilderState = (value: unknown) =>
  explorerBuilderStateSchema.parse(value);
export const assertExplorerBuilderCompileResult = (value: unknown) =>
  explorerBuilderCompileResultSchema.parse(value);
export const assertExplorerBuilderPreviewResult = (value: unknown) =>
  explorerBuilderPreviewResultSchema.parse(value);
export const assertExplorerBuilderPublishResult = (value: unknown) =>
  explorerBuilderPublishResultSchema.parse(value);

/** Server-owned runtime projection retained for viewer/ETL consumers. */
export interface PublicationMetadata {
  readonly state: string;
  readonly generation?: string;
  readonly executionId?: string;
  readonly revisionId?: string;
  readonly updatedAt?: string;
}
export interface ExplorerRuntimeColumnV1 {
  readonly emissionId: string;
  readonly name: string;
  readonly label: string;
  readonly logicalType: string;
  readonly visible: boolean;
  readonly order: number;
  readonly repeated?: boolean;
  readonly filterable: boolean;
  readonly sortable?: boolean;
  readonly chartable: boolean;
  readonly aggregatable?: boolean;
}
export type ExplorerRuntimeColumnsV1 = ReadonlyArray<ExplorerRuntimeColumnV1>;
export interface ExplorerRuntimeBindingV1 {
  readonly emissionId: string;
  readonly outputId?: string;
  readonly label?: string;
  readonly type?: string;
  readonly title?: string;
}
export interface ExplorerRuntimeOutputV1 {
  readonly outputId: string;
  readonly name: string;
  readonly title: string;
  readonly rowLabel: string;
  readonly selector: DataframeSelector;
  readonly columns: ExplorerRuntimeColumnsV1;
  readonly table: {
    readonly columns: ReadonlyArray<
      ExplorerRuntimeBindingV1 & { readonly visible: boolean }
    >;
  };
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
  readonly sharedFilters: Readonly<
    Record<string, ReadonlyArray<ExplorerRuntimeBindingV1>>
  >;
  readonly diagnostics: ReadonlyArray<ExplorerAuthoringDiagnostic>;
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
  readonly tabs?: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly outputId: string;
    readonly order: number;
    readonly visible?: boolean;
  }>;
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
export interface ExplorerStatePhysicalColumnV1 {
  readonly name: string;
  readonly semanticPath?: string;
  readonly clickhouseType?: string;
  readonly logicalType?: string;
  readonly nullable?: boolean;
  readonly repeated?: boolean;
  readonly provenance?: string;
  readonly loomOwned?: boolean;
}
export interface ExplorerStateDatasetOutputV1 {
  readonly name: string;
  readonly state: string;
  readonly queryable: boolean;
  readonly fingerprint?: string;
  readonly selector?: DataframeSelector;
  readonly columns?: ReadonlyArray<ExplorerStatePhysicalColumnV1>;
}
export interface ExplorerStateMaterializationV1 {
  readonly outputId: string;
  readonly output: string;
  readonly materializationId: string;
  readonly fingerprint?: string;
  readonly selector?: DataframeSelector;
  readonly columns: ReadonlyArray<ExplorerStatePhysicalColumnV1>;
}

/** Runtime-only selected Explorer response. Editable state is never read here. */
export interface ExplorerStateV1 {
  readonly apiVersion: 'loom.calypr.org/explorer-state/v1';
  readonly kind: 'ExplorerState';
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly management:
    | 'repository'
    | 'interactive'
    | 'REPOSITORY'
    | 'INTERACTIVE';
  readonly draft: {
    readonly bundle?: ExplorerStateAuthoringBundleV1;
    readonly receiptId?: string;
    readonly version: number;
    readonly digest: string;
    readonly intentDigest?: string;
  };
  readonly active: {
    readonly bundle?: ExplorerStateAuthoringBundleV1;
    readonly revisionId?: string;
    readonly intentDigest?: string;
    readonly status?: string;
  };
  readonly generated: {
    readonly recipeDigest?: string;
    readonly sourceGeneration?: string;
    readonly resolvedSchemaDigest?: string;
    readonly emittedColumns?: ReadonlyArray<ExplorerStateEmittedColumnV1>;
    readonly materializations?: ReadonlyArray<ExplorerStateMaterializationV1>;
    readonly dataset?: {
      readonly outputs: ReadonlyArray<ExplorerStateDatasetOutputV1>;
    };
    readonly publication?: PublicationMetadata;
    readonly diagnostics?: ReadonlyArray<ExplorerAuthoringDiagnostic>;
  };
  readonly activeUrl: string;
  readonly updatedBy?: string;
  readonly updatedAt?: string;
  readonly runtime: ExplorerRuntimeV1;
}

const allowedKeys = new Set([
  'apiVersion',
  'kind',
  'project',
  'explorerId',
  'title',
  'management',
  'active',
  'generated',
  'activeUrl',
  'updatedBy',
  'updatedAt',
  'runtime',
  'draft',
]);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const isExplorerStateV1 = (value: unknown): value is ExplorerStateV1 => {
  if (
    !isRecord(value) ||
    !Object.keys(value).every((key) => allowedKeys.has(key))
  )
    return false;
  if (
    value.apiVersion !== 'loom.calypr.org/explorer-state/v1' ||
    value.kind !== 'ExplorerState' ||
    typeof value.project !== 'string' ||
    typeof value.explorerId !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.management !== 'string' ||
    !isRecord(value.runtime)
  )
    return false;
  const runtime = value.runtime;
  if (
    !Array.isArray(runtime.outputs) ||
    !isRecord(runtime.sharedFilters) ||
    !Array.isArray(runtime.diagnostics)
  )
    return false;
  return runtime.outputs.every(
    (output) =>
      isRecord(output) &&
      Array.isArray(output.columns) &&
      isRecord(output.table) &&
      Array.isArray(output.table.columns) &&
      Array.isArray(output.filters) &&
      Array.isArray(output.charts) &&
      isRecord(output.fixedFilters),
  );
};
export const assertExplorerStateV1 = (value: unknown): ExplorerStateV1 => {
  if (!isExplorerStateV1(value))
    throw new Error(
      'Loom returned an invalid ExplorerStateV1 response; legacy Explorer configuration fields are not supported.',
    );
  return value;
};
