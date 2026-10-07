import { z } from 'zod';
import type { DataframeSelector } from './types';

export const EXPLORER_AUTHORING_API_VERSION =
  'loom.calypr.org/explorer-authoring/v2' as const;

const opaqueIdSchema = z.string().trim().min(1);
const projectionModeSchema = z.enum(['VALUE', 'FIRST', 'ALL', 'DISTINCT']);
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

export const explorerTablePresentationSchema = z
  .object({
    visible: z.boolean().optional(),
    order: z.number().int().nonnegative().optional(),
    pinned: z.boolean().optional(),
    cellRenderer: z.literal('fileActions').optional(),
  })
  .strict();
export const explorerFilterPresentationSchema = z
  .object({
    label: z.string().optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .strict();
export const explorerChartPresentationSchema = z
  .object({
    type: opaqueIdSchema,
    title: z.string().optional(),
    order: z.number().int().nonnegative().optional(),
  })
  .strict();
export const explorerColumnSourceSchema = z
  .object({
    kind: z.enum([
      'field',
      'identifierBySystem',
      'extensionByUrl',
      'codingBySystem',
      'observationComponentByCode',
      'projectId',
    ]),
    fieldPath: z.string().optional(),
    match: z.string().optional(),
    projectionMode: projectionModeSchema.optional(),
  })
  .strict();
export type ExplorerColumnSource = z.infer<typeof explorerColumnSourceSchema>;
export type ExplorerBuilderRouteNode = {
  occurrenceId: string;
  resourceType: string;
  relationship?: string;
  children?: ExplorerBuilderRouteNode[];
};
export const explorerBuilderRouteNodeSchema: z.ZodType<ExplorerBuilderRouteNode> =
  z.lazy(() =>
    z
      .object({
        occurrenceId: opaqueIdSchema,
        resourceType: opaqueIdSchema,
        relationship: z.string().optional(),
        children: z.array(explorerBuilderRouteNodeSchema).optional(),
      })
      .strict(),
  );
export const explorerBuilderColumnSchema = z
  .object({
    column: opaqueIdSchema.regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
    label: z.string().min(1),
    logicalType: z.string().optional(),
    occurrenceId: opaqueIdSchema,
    source: explorerColumnSourceSchema,
    table: explorerTablePresentationSchema.optional(),
    filter: explorerFilterPresentationSchema.optional(),
    chart: explorerChartPresentationSchema.optional(),
  })
  .strict();
export type ExplorerBuilderColumn = z.infer<typeof explorerBuilderColumnSchema>;
export const explorerBuilderDocumentSchema = z
  .object({
    kind: z.literal('ExplorerBuilderDocument'),
    output: z
      .object({
        id: opaqueIdSchema.regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        title: z.string().min(1),
        rowLabel: z.string().optional(),
      })
      .strict(),
    rootResourceType: opaqueIdSchema,
    route: explorerBuilderRouteNodeSchema,
    columns: z.array(explorerBuilderColumnSchema),
    fixedFilters: z
      .array(
        z
          .object({
            column: opaqueIdSchema,
            values: z.array(z.string()).min(1),
          })
          .strict(),
      )
      .optional(),
    actions: z
      .array(
        z
          .object({
            type: opaqueIdSchema,
            title: z.string().min(1),
            fileName: z.string().optional(),
            columns: z
              .array(
                z
                  .object({
                    column: opaqueIdSchema,
                    exportHeader: z.string().optional(),
                  })
                  .strict(),
              )
              .optional(),
          })
          .strict(),
      )
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
    explorer: z
      .object({ title: z.string().min(1), description: z.string().optional() })
      .strict(),
    documents: z.array(explorerBuilderDocumentSchema),
    tabs: z.array(explorerBuilderTabSchema),
    sharedFilters: z
      .record(
        z.string(),
        z.array(
          z
            .object({ outputId: opaqueIdSchema, column: opaqueIdSchema })
            .strict(),
        ),
      )
      .optional(),
    fileActions: z
      .object({
        extensions: z.record(z.string(), z.array(z.string())),
        actions: z.record(z.string(), z.string()),
      })
      .strict()
      .optional(),
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
    fieldPath: opaqueIdSchema,
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
    lifecycleState: z.enum(['NEW', 'READY']),
    draftVersion: z.number().int().nonnegative(),
    draftDigest: z.string(),
    workspace: explorerBuilderWorkspaceSchema.nullable(),
    catalog: explorerBuilderCatalogSchema,
  })
  .strict()
  .superRefine((state, context) => {
    if ((state.lifecycleState === 'NEW') !== (state.workspace === null)) {
      context.addIssue({
        code: 'custom',
        path: ['workspace'],
        message: 'NEW requires null workspace and READY requires a workspace.',
      });
    }
  });
export type ExplorerBuilderState = z.infer<typeof explorerBuilderStateSchema>;

export const explorerBuilderCommandSchema = z
  .object({
    type: z.enum([
      'CREATE_TABLE',
      'DUPLICATE_TABLE',
      'DELETE_TABLE',
      'RENAME_TABLE',
      'REORDER_TABLES',
      'SET_TABLE_ROOT',
      'ADD_ROUTE',
      'REMOVE_ROUTE',
      'ADD_COLUMN',
      'UPDATE_COLUMN',
      'REMOVE_COLUMN',
    ]),
    outputId: opaqueIdSchema.optional(),
    sourceOutputId: opaqueIdSchema.optional(),
    title: z.string().optional(),
    rootNodeId: opaqueIdSchema.optional(),
    parentOccurrenceId: opaqueIdSchema.optional(),
    occurrenceId: opaqueIdSchema.optional(),
    edgeId: opaqueIdSchema.optional(),
    candidateId: opaqueIdSchema.optional(),
    projectionMode: projectionModeSchema.optional(),
    initialPresentation: z.enum(['TABLE', 'FILTER', 'CHART']).optional(),
    column: opaqueIdSchema.optional(),
    columnValue: explorerBuilderColumnSchema.optional(),
    outputIds: z.array(opaqueIdSchema).optional(),
  })
  .strict();
export type ExplorerBuilderCommand = z.infer<
  typeof explorerBuilderCommandSchema
>;
export const explorerBuilderCommandResultSchema = z
  .object({
    type: z.enum([
      'TABLE_CREATED',
      'TABLE_CHANGED',
      'ROUTE_ADDED',
      'COLUMN_ADDED',
    ]),
    outputId: opaqueIdSchema.optional(),
    tabId: opaqueIdSchema.optional(),
    occurrenceId: opaqueIdSchema.optional(),
    column: opaqueIdSchema.optional(),
  })
  .strict();
export const explorerBuilderCommandsResultSchema = z
  .object({
    commandId: opaqueIdSchema,
    workspace: explorerBuilderWorkspaceSchema,
    draftVersion: z.number().int().positive(),
    draftDigest: opaqueIdSchema,
    results: z.array(explorerBuilderCommandResultSchema),
    diagnostics: z.array(explorerAuthoringDiagnosticSchema),
  })
  .strict();
export type ExplorerBuilderCommandsResult = z.infer<
  typeof explorerBuilderCommandsResultSchema
>;

export const explorerBuilderContractColumnSchema = z
  .object({
    column: opaqueIdSchema,
    label: z.string(),
    logicalType: opaqueIdSchema,
    filterable: z.boolean(),
    chartable: z.boolean(),
  })
  .strict();
export type ExplorerBuilderContractColumn = z.infer<
  typeof explorerBuilderContractColumnSchema
>;
// Local Builder view-model identities are not part of Loom's wire contract.
export interface ExplorerBuilderSelection {
  readonly candidateId: string;
  readonly occurrenceId: string;
  readonly projectionMode: string;
}
export interface ExplorerPresentationIntent {
  readonly label?: string;
  readonly visible?: boolean;
  readonly order?: number;
  readonly table?: { readonly pinned?: boolean };
  readonly filter?: { readonly label?: string };
  readonly chart?: { readonly type: string; readonly title?: string };
}
export interface ExplorerBuilderEmission extends ExplorerBuilderContractColumn {
  readonly outputId: string;
  readonly candidateId: string;
  readonly occurrenceId: string;
  readonly projectionMode: string;
  readonly emissionId: string;
  readonly publicColumn: string;
}
export const explorerBuilderReceiptOutputSchema = z
  .object({
    outputId: opaqueIdSchema,
    title: z.string().optional(),
    rowGrain: z.string().optional(),
    columns: z.array(explorerBuilderContractColumnSchema),
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
  explorerBuilderContractColumnSchema;
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
  readonly column: string;
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
  readonly column: string;
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
      ExplorerRuntimeBindingV1 & { readonly visible: boolean } & {
        readonly pinned?: boolean;
        readonly cellRenderer?: 'fileActions';
      }
    >;
  };
  readonly filters: ReadonlyArray<ExplorerRuntimeBindingV1>;
  readonly charts: ReadonlyArray<ExplorerRuntimeBindingV1>;
  readonly fixedFilters: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly actions?: ReadonlyArray<{
    readonly type: string;
    readonly title: string;
    readonly fileName?: string;
    readonly output?: string;
    readonly columns?: ReadonlyArray<string>;
    readonly exportHeaders?: Readonly<Record<string, string>>;
  }>;
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
  readonly fileActions?: {
    readonly extensions?: Readonly<Record<string, ReadonlyArray<string>>>;
    readonly actions?: Readonly<Record<string, string>>;
  };
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
  /** Runtime is null when Loom has no valid published runtime to serve. */
  readonly runtime?: ExplorerRuntimeV1 | null;
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
const legacyExplorerStateKeys = new Set(['draftConfig', 'activeConfig']);
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
    typeof value.management !== 'string'
  )
    return false;
  if (value.runtime === undefined || value.runtime === null) return true;
  if (!isRecord(value.runtime)) return false;
  const runtime = value.runtime;
  return (
    Array.isArray(runtime.outputs) &&
    isRecord(runtime.sharedFilters) &&
    Array.isArray(runtime.diagnostics) &&
    runtime.outputs.every(
      (output) =>
        isRecord(output) &&
        Array.isArray(output.columns) &&
        isRecord(output.table) &&
        Array.isArray(output.table.columns) &&
        Array.isArray(output.filters) &&
        Array.isArray(output.charts) &&
        isRecord(output.fixedFilters),
    )
  );
};

const normalizeExplorerStateV1 = (value: unknown): unknown => {
  if (!isRecord(value) || !isRecord(value.runtime)) return value;
  if (value.runtime.diagnostics !== null) return value;

  // Go encodes a nil diagnostics slice as null. Treat that wire-level empty
  // value as the empty collection promised by ExplorerRuntimeV1.
  return {
    ...value,
    runtime: {
      ...value.runtime,
      diagnostics: [],
    },
  };
};

export const assertExplorerStateV1 = (value: unknown): ExplorerStateV1 => {
  const normalized = normalizeExplorerStateV1(value);
  if (isExplorerStateV1(normalized)) return normalized;
  const hasLegacyConfiguration =
    isRecord(value) &&
    Object.keys(value).some((key) => legacyExplorerStateKeys.has(key));
  if (hasLegacyConfiguration)
    throw new Error(
      'Loom returned an invalid ExplorerStateV1 response; legacy Explorer configuration fields are not supported.',
    );
  throw new Error('Loom returned an invalid ExplorerStateV1 response.');
};
