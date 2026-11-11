import { z } from 'zod';

const viewTableColumnSchema = z
  .object({
    column: z.string(),
    label: z.string().optional(),
    visible: z.boolean(),
    pinned: z.boolean().optional(),
  })
  .passthrough();

const viewFilterSchema = z
  .object({
    column: z.string(),
    label: z.string().optional(),
  })
  .passthrough();

const viewChartSchema = z
  .object({
    column: z.string(),
    type: z.string(),
    title: z.string().optional(),
  })
  .passthrough();

const viewActionSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    fileName: z.string().optional(),
    output: z.string().optional(),
    columns: z.array(z.string()).optional(),
    exportHeaders: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

export const projectViewConfigSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    recipeRef: z.object({ name: z.string() }).passthrough(),
    views: z.array(
      z
        .object({
          id: z.string(),
          title: z.string(),
          output: z.string(),
          rowLabel: z.string().optional(),
          table: z
            .object({
              columns: z
                .array(viewTableColumnSchema)
                .nullable()
                .transform((columns) => columns ?? []),
            })
            .passthrough(),
          filters: z.array(viewFilterSchema).optional(),
          charts: z.array(viewChartSchema).optional(),
          fixedFilters: z.record(z.string(), z.array(z.string())).optional(),
          actions: z.array(viewActionSchema).optional(),
        })
        .passthrough(),
    ),
    sharedFilters: z
      .record(
        z.string(),
        z.array(
          z.object({ output: z.string(), column: z.string() }).passthrough(),
        ),
      )
      .optional(),
    fileActions: z
      .object({
        extensions: z.record(z.string(), z.array(z.string())).optional(),
        actions: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const viewBuilderStateSchema = z
  .object({
    settings: z
      .object({
        project: z.string(),
        version: z.number().int().nonnegative(),
        defaultConfigId: z.string().optional().default(''),
        defaultFrameId: z.string().optional().default(''),
        catalogs: z
          .record(z.string(), z.string())
          .nullish()
          .transform((catalogs) => catalogs ?? {}),
      })
      .passthrough(),
    configs: z.preprocess(
      (configs) => (configs === null ? [] : configs),
      z.array(
        z
          .object({
            config: projectViewConfigSchema,
            revisionId: z.string(),
            diagnostics: z
              .array(
                z
                  .object({
                    severity: z.string(),
                    code: z.string(),
                    message: z.string(),
                    fieldPath: z.string().optional(),
                  })
                  .passthrough(),
              )
              .optional(),
          })
          .passthrough(),
      ),
    ),
    catalogs: z.preprocess(
      (catalogs) => (catalogs === null ? [] : catalogs),
      z.array(
        z
          .object({
            recipeName: z.string(),
            revisionId: z.string(),
            executionId: z.string(),
            generation: z.string(),
            frames: z.array(
              z
                .object({
                  id: z.string(),
                  title: z.string(),
                  columns: z.preprocess(
                    (columns) => (columns === null ? [] : columns),
                    z.array(
                      z
                        .object({
                          name: z.string(),
                          label: z.string(),
                          logicalType: z.string(),
                          cardinality: z.string(),
                          filterable: z.boolean().optional().default(false),
                          chartable: z.boolean().optional().default(false),
                        })
                        .passthrough(),
                    ),
                  ),
                })
                .passthrough(),
            ),
          })
          .passthrough(),
      ),
    ),
    canEdit: z.boolean(),
  })
  .passthrough();

export type ProjectViewConfig = z.infer<typeof projectViewConfigSchema>;
export type ProjectViewBuilderState = z.infer<typeof viewBuilderStateSchema>;
export type ProjectViewBuilderConfigRevision =
  ProjectViewBuilderState['configs'][number];
export type ProjectViewBuilderCatalog =
  ProjectViewBuilderState['catalogs'][number];
export type ProjectViewBuilderFrame =
  ProjectViewBuilderCatalog['frames'][number];

export interface SaveProjectViewConfigRequest {
  readonly expectedRevisionId: string;
  readonly catalogRevisionId: string;
  readonly config: ProjectViewConfig;
}

export interface SaveProjectViewDefaultsRequest {
  readonly expectedVersion: number;
  readonly defaultConfigId: string;
  readonly defaultFrameId: string;
}
