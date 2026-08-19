import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import {
  CohortBuilderConfiguration,
  CohortPanelConfiguration,
} from '../../features/CohortBuilder';
import {
  groupSharedFields,
  isLoomGraphQLRequestError,
  dataframeSelectorForRecipeOutput,
  LoomDatasetSelector,
  SharedFieldMapping,
} from '@gen3/core';
import type {
  ExplorerDatasetOutputV2,
  FacetDefinition,
  RecipeBundleV2,
  RepositoryExplorerConfig,
} from '@gen3/core';
import type {
  PageLoadProblem,
  PageLoadResult,
  ServerPageContext,
} from '../../lib/pageLoader';
import type { ExplorerPageData } from './types';
import {
  normalizeCohortPanelForDataset,
  normalizeSharedFilterMappings,
  runtimeColumnsFromUnknown,
  type RuntimeColumn,
} from '../../features/CohortBuilder/runtimeConfiguration';

type LoomColumnsByExplorerType = Record<string, ReadonlySet<string>>;
type LoomRuntimeColumnsByExplorerType = Record<
  string,
  ReadonlyArray<RuntimeColumn>
>;

const legacyExplorerOutputNames: Readonly<Record<string, string>> = {
  file: 'DocumentReference',
  document_reference: 'DocumentReference',
  research_subject: 'ResearchSubject',
  specimen: 'Specimen',
  medication_administration: 'MedicationAdministration',
  group_member: 'GroupMember',
};

const normalizeExplorerOutputName = (value: string): string =>
  legacyExplorerOutputNames[value.trim().toLowerCase()] ?? value.trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeFileActionColumnName = (value: string): string =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

const fileActionColumnFor = (
  view: { readonly output: string },
  fields: ReadonlyArray<{
    readonly column: string;
    readonly label?: string;
  }>,
  rootResourceType: string | undefined,
  fileActions: unknown,
): string | undefined => {
  const fileActionsRecord = isRecord(fileActions) ? fileActions : undefined;
  const hasConfiguredActions =
    isRecord(fileActionsRecord?.actions) &&
    Object.keys(fileActionsRecord.actions).length > 0;
  const configuredColumn =
    typeof fileActionsRecord?.column === 'string'
      ? fileActionsRecord.column
      : undefined;
  const byName = new Map(
    fields.map((field) => [
      normalizeFileActionColumnName(field.column),
      field.column,
    ]),
  );
  if (configuredColumn) {
    const configured = byName.get(
      normalizeFileActionColumnName(configuredColumn),
    );
    if (configured) return configured;
  }

  const labelledFileActionColumn = fields.find((field) =>
    normalizeFileActionColumnName(field.label ?? '').includes('file_action'),
  );
  if (labelledFileActionColumn) return labelledFileActionColumn.column;

  const isFileView =
    new Set(['file', 'document_reference']).has(
      normalizeFileActionColumnName(view.output),
    ) ||
    ['file', 'document_reference'].includes(
      normalizeFileActionColumnName(rootResourceType ?? ''),
  );
  if (!isFileView) return undefined;

  if (!hasConfiguredActions) return undefined;

  // V2 deliberately has no legacy cell-renderer fields. File actions are
  // therefore attached to the conventional file identity column when no
  // explicit column was supplied. This keeps a published UUID column from
  // falling back to a plain value cell.
  const conventionalNames = [
    'id',
    'file_id',
    'document_reference_id',
    'document_reference_identifier',
    'sha256',
    'file_name',
    'document_reference_source_path',
  ];
  return conventionalNames
    .map((name) => byName.get(name))
    .find((column): column is string => Boolean(column));
};

const isDataframeSelector = (value: unknown): value is LoomDatasetSelector =>
  isRecord(value) &&
  typeof value.recipe === 'string' &&
  value.recipe.trim().length > 0 &&
  typeof value.translationVersion === 'string' &&
  value.translationVersion.trim().length > 0 &&
  typeof value.output === 'string' &&
  value.output.trim().length > 0;

const missingSelectorError = (output: string): Error & {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
} =>
  Object.assign(
    new Error(
      `Loom Explorer output ${output || '<unnamed>'} has no complete server dataframe selector.`,
    ),
    {
      status: 422,
      code: 'EXPLORER_SELECTOR_REQUIRED',
      retryable: false,
    },
  );

const missingActiveConfigError = (): Error & {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
} =>
  Object.assign(
    new Error(
      'The active Explorer publication did not include activeConfig. Refusing to synthesize an Explorer from live dataset metadata.',
    ),
    {
      status: 422,
      code: 'EXPLORER_ACTIVE_CONFIG_REQUIRED',
      retryable: false,
    },
  );

/**
 * The browser lifecycle client and some Loom deployments expose REST resources
 * in either a `{ data: ... }` envelope or a publication envelope whose actual
 * Explorer state is under `state`. The Viewer loads this resource during SSR
 * through the request-bound client, so normalize both shapes at this boundary.
 */
export const unwrapRepositoryExplorerResponse = (
  payload: unknown,
): RepositoryExplorerConfig => {
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  if (!isRecord(data) || !isRecord(data.state)) return data as RepositoryExplorerConfig;
  const value = data.state;
  return {
    ...value,
    activeUrl: data.activeUrl ?? value.activeUrl,
    publicationId: data.publicationId ?? value.publicationId,
    shareUrl: data.shareUrl ?? value.shareUrl,
    materializationMappings:
      data.materializationMappings ?? value.materializationMappings,
    materializations: data.materializations ?? value.materializations,
  } as RepositoryExplorerConfig;
};

type MaterializationReference = {
  readonly output: string;
  readonly outputId?: string;
  readonly materializationId: string;
  readonly selector?: LoomDatasetSelector;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  readonly columns?: ReadonlyArray<unknown>;
  readonly columnMappings?: Readonly<Record<string, string>>;
};

const materializationMappingsFor = (
  deployed: RepositoryExplorerConfig,
): ReadonlyArray<MaterializationReference> => [
  ...(deployed.materializationMappings ?? []).map((mapping) => ({
    outputId: mapping.outputId,
    output: mapping.output,
    materializationId: mapping.materializationId,
    selector: mapping.selector,
    recipeName: mapping.recipeName,
    translationVersion: mapping.translationVersion,
    columns: mapping.columns,
    columnMappings: mapping.columnMappings,
  })),
  ...(deployed.frozenMaterializationMappings ?? []).map((mapping) => ({
    outputId: mapping.outputId,
    output: mapping.output,
    materializationId: mapping.materializationId,
    selector: mapping.selector,
    recipeName: mapping.recipeName,
    translationVersion: mapping.translationVersion,
    columns: mapping.columns,
    columnMappings: mapping.columnMappings,
  })),
  ...(deployed.materializations ?? []).map((materialization) => ({
    outputId: materialization.outputId,
    output: materialization.output,
    materializationId: materialization.materializationId,
    columns: materialization.columns,
  })),
];

const mergeRuntimeColumns = (
  ...groups: ReadonlyArray<ReadonlyArray<RuntimeColumn>>
): RuntimeColumn[] => {
  const byName = new Map<string, RuntimeColumn>();
  for (const group of groups) {
    for (const column of group) {
      const existing = byName.get(column.name);
      if (!existing) {
        byName.set(column.name, column);
        continue;
      }
      byName.set(column.name, {
        ...existing,
        filterable: existing.filterable ?? column.filterable,
        chartable: existing.chartable ?? column.chartable,
        semanticPath: existing.semanticPath ?? column.semanticPath,
        selectionId: existing.selectionId ?? column.selectionId,
        aliases: [
          ...new Set([...(existing.aliases ?? []), ...(column.aliases ?? [])]),
        ],
      });
    }
  }
  return [...byName.values()];
};

const runtimeColumnsWithMappingAliases = (
  values: ReadonlyArray<unknown>,
  columnMappings?: Readonly<Record<string, string>>,
): RuntimeColumn[] => {
  const columns = runtimeColumnsFromUnknown(values);
  if (!columnMappings) return columns;
  return columns.map((column) => ({
    ...column,
    aliases: [
      ...(column.aliases ?? []),
      ...Object.entries(columnMappings)
        .filter(([, physical]) => physical === column.name)
        .map(([logical]) => logical),
    ],
  }));
};

const outputRootResourceType = (
  deployed: RepositoryExplorerConfig,
  output: string,
): string | undefined => {
  const recipe = deployed.activeConfig?.recipe;
  return recipe?.outputs?.find((candidate) => candidate.name === output)
    ?.rootResourceType;
};

const runtimeColumnsForOutput = (
  deployed: RepositoryExplorerConfig,
  output: string,
  materialization: MaterializationReference | undefined,
  outputMetadata: ExplorerDatasetOutputV2 | undefined,
  configuredColumns: ReadonlyArray<unknown>,
): RuntimeColumn[] => {
  const record = deployed as unknown as Record<string, unknown>;
  const emittedColumns = Array.isArray(record.emittedColumns)
    ? record.emittedColumns.filter((column) => {
        if (!isRecord(column)) return false;
        const outputID =
          typeof column.OutputID === 'string'
            ? column.OutputID
            : typeof column.outputId === 'string'
              ? column.outputId
              : undefined;
        return !outputID || outputID === output;
      })
    : [];
  const physicalColumns = Array.isArray(record.physicalColumns)
    ? record.physicalColumns
    : [];
  const preferred =
    materialization?.columns && materialization.columns.length > 0
      ? runtimeColumnsWithMappingAliases(
          materialization.columns,
          materialization.columnMappings,
        )
      : outputMetadata?.columns && outputMetadata.columns.length > 0
        ? runtimeColumnsFromUnknown(outputMetadata.columns)
        : emittedColumns.length > 0
          ? runtimeColumnsFromUnknown(emittedColumns)
          : physicalColumns.length > 0
            ? runtimeColumnsFromUnknown(physicalColumns)
            : runtimeColumnsFromUnknown(configuredColumns);
  const preferredNames = new Set(preferred.map((column) => column.name));
  const supplemental = runtimeColumnsFromUnknown([
    ...emittedColumns,
    ...physicalColumns,
  ]).filter((column) => preferredNames.has(column.name));
  return mergeRuntimeColumns(preferred, supplemental);
};

const materializationSelectorForOutput = (
  deployed: RepositoryExplorerConfig,
  outputName: string,
  output?: ExplorerDatasetOutputV2,
): LoomDatasetSelector | undefined => {
  const outputMetadata =
    output ??
    deployed.dataset?.outputs.find((candidate) => {
      const candidateRecord = candidate as unknown as Record<string, unknown>;
      const canonicalOutput =
        typeof candidateRecord.output === 'string'
          ? candidateRecord.output.trim()
          : '';
      const candidateName =
        typeof candidateRecord.name === 'string'
          ? candidateRecord.name.trim()
          : '';
      return (
        candidateName === outputName ||
        canonicalOutput === outputName ||
        normalizeExplorerOutputName(candidateName) ===
          normalizeExplorerOutputName(outputName)
      );
    });
  const rawOutput =
    outputMetadata as unknown as Record<string, unknown> | undefined;
  const mapping = materializationMappingsFor(deployed).find(
    (candidate) =>
      candidate.output === outputName ||
      candidate.outputId === outputName ||
      normalizeExplorerOutputName(candidate.output) ===
        normalizeExplorerOutputName(outputName),
  );
  const explicitSelector =
    (isDataframeSelector(rawOutput?.selector) && rawOutput?.selector) ||
    (isDataframeSelector(mapping?.selector) && mapping?.selector);
  if (explicitSelector) return explicitSelector;

  const canonicalOutput =
    typeof rawOutput?.output === 'string' && rawOutput.output.trim().length > 0
      ? rawOutput.output.trim()
      : mapping?.output || outputName;

  const baseline = deployed.baselineConfig;
  const baselineRecipe =
    isRecord(baseline) && isRecord(baseline.recipe)
      ? baseline.recipe
      : isRecord(baseline) && Array.isArray(baseline.outputs)
        ? baseline
        : undefined;
  const recipe =
    deployed.activeConfig?.recipe ?? (baselineRecipe as RecipeBundleV2 | undefined);
  const recipeName =
    (typeof rawOutput?.recipeName === 'string' && rawOutput.recipeName) ||
    mapping?.recipeName ||
    deployed.recipeName;
  const translationVersion =
    (typeof rawOutput?.translationVersion === 'string' &&
      rawOutput.translationVersion) ||
    mapping?.translationVersion ||
    deployed.translationVersion;
  if (!recipe && (!recipeName || !translationVersion)) return undefined;
  try {
    return dataframeSelectorForRecipeOutput(
      recipe ?? { recipeName, translationVersion },
      canonicalOutput,
      { recipeName, translationVersion },
    );
  } catch {
    return undefined;
  }
};

/** Converts the authenticated, frozen V2 deployment record into the existing renderer contract. */
export const loomRepositoryConfigConfiguration = (
  deployed: RepositoryExplorerConfig,
): {
  readonly configuration: CohortBuilderConfiguration;
  readonly columns: LoomColumnsByExplorerType;
  readonly runtimeColumns: LoomRuntimeColumnsByExplorerType;
  readonly rootResourceTypes: Readonly<Record<string, string | undefined>>;
} => {
  const columns: LoomColumnsByExplorerType = {};
  const runtimeColumns: LoomRuntimeColumnsByExplorerType = {};
  const rootResourceTypes: Record<string, string | undefined> = {};
  const activeConfig = deployed.activeConfig;
  if (!activeConfig) throw missingActiveConfigError();
  const fileActions = activeConfig.fileActions
    ? {
        actions: Object.fromEntries(
          Object.entries(activeConfig.fileActions.actions ?? {}).filter(
            ([, route]) => typeof route === 'string',
          ),
        ),
        extensions: Object.fromEntries(
          Object.entries(activeConfig.fileActions.extensions ?? {}).map(
            ([extension, actions]) => [
              extension,
              actions.filter(
                (action): action is string => typeof action === 'string',
              ),
            ],
          ),
        ),
      }
    : undefined;
  // The published V2 packet owns the Explorer's project identity. Older
  // deployment envelopes did not repeat it at the top level.
  const project = activeConfig.project || deployed.project;
  const explorerConfig = activeConfig.views.map((view) => {
    const materialization = materializationMappingsFor(deployed).find(
      (candidate) =>
        candidate.outputId === view.output || candidate.output === view.output,
    );
    const selector = materializationSelectorForOutput(deployed, view.output);
    if (!selector)
      throw missingSelectorError(view.output);
    const configuredColumns = view.table.columns.map((column) => ({
      name: column.column,
    }));
    const outputMetadata = deployed.dataset?.outputs.find((candidate) => {
      const candidateRecord = candidate as unknown as Record<string, unknown>;
      const outputName =
        typeof candidateRecord.output === 'string'
          ? candidateRecord.output
          : typeof candidateRecord.name === 'string'
            ? candidateRecord.name
            : '';
      return (
        outputName === view.output ||
        normalizeExplorerOutputName(outputName ?? '') ===
          normalizeExplorerOutputName(view.output)
      );
    });
    const configuredRuntimeColumns = runtimeColumnsFromUnknown(
      configuredColumns,
    );
    const rootResourceType = outputRootResourceType(deployed, view.output);
    const availableColumns = runtimeColumnsForOutput(
      deployed,
      view.output,
      materialization,
      outputMetadata,
      configuredColumns,
    );
    columns[view.output] = new Set(availableColumns.map((column) => column.name));
    runtimeColumns[view.output] = mergeRuntimeColumns(
      availableColumns,
      configuredRuntimeColumns.filter((column) =>
        availableColumns.some((available) => available.name === column.name),
      ),
    );
    rootResourceTypes[view.output] = rootResourceType;
    const fields = view.table.columns.filter((column) => column.visible);
    const fileActionColumn = fileActionColumnFor(
      view,
      fields,
      rootResourceType,
      activeConfig.fileActions,
    );
    // ExplorerConfig V2 keeps presentation settings on the view. The legacy
    // CohortBuilder renderer still expects those settings under its panel
    // contract, so translate them explicitly at this boundary. Previously we
    // only copied table columns here, which made a published V2 filter appear
    // to vanish in the runtime Explorer even though it remained in the
    // activeConfig packet.
    const filterFields = view.filters ?? [];
    const filterDefinitions = Object.fromEntries(
      filterFields.map((filter) => [
        filter.column,
        {
          field: filter.column,
          index: view.output,
          label: filter.label ?? filter.column,
          type: 'enum',
        } satisfies FacetDefinition,
      ]),
    );
    const charts = Object.fromEntries(
      (view.charts ?? []).map((chart) => [
        chart.column,
        {
          chartType: chart.type,
          ...(chart.title !== undefined ? { title: chart.title } : {}),
        },
      ]),
    );
    const preFilters = Object.fromEntries(
      Object.entries(view.fixedFilters ?? {}).filter(
        ([, values]) => values.length > 0,
      ),
    );
    const panel = {
      tabTitle: view.title,
      guppyConfig: {
        dataType: view.output,
        output: view.output,
        loomDataset: selector,
        loomProjectIds: [project],
      },
      table: {
        enabled: true,
        fields: fields.map((column) => column.column),
        columns: Object.fromEntries(
          fields.map((column) => {
            // The V2 contract intentionally keeps table columns small, but
            // older/forward-compatible packets may still carry renderer
            // metadata. Preserve the metadata at this legacy renderer
            // boundary instead of silently reducing every column to a value
            // cell.
            const rawColumn = column as unknown as Record<string, unknown>;
            const params = isRecord(rawColumn.params)
              ? { ...rawColumn.params }
              : undefined;
            const inferredFileActions =
              fileActionColumn === column.column &&
              rawColumn.type === undefined &&
              rawColumn.cellRenderFunction === undefined;
            return [
              column.column,
              {
                field: column.column,
                title: column.label || column.column,
                ...(inferredFileActions
                  ? { type: 'string', cellRenderFunction: 'fileActions' }
                  : {}),
                ...(typeof rawColumn.type === 'string'
                  ? { type: rawColumn.type }
                  : {}),
                ...(typeof rawColumn.cellRenderFunction === 'string'
                  ? { cellRenderFunction: rawColumn.cellRenderFunction }
                  : {}),
                ...(typeof rawColumn.accessorPath === 'string'
                  ? { accessorPath: rawColumn.accessorPath }
                  : {}),
                ...(typeof rawColumn.width === 'number'
                  ? { width: rawColumn.width }
                  : {}),
                ...(typeof rawColumn.sortable === 'boolean'
                  ? { sortable: rawColumn.sortable }
                  : {}),
                ...(params ? { params } : {}),
              },
            ];
          }),
        ),
      },
      ...(filterFields.length > 0
        ? {
            filters: {
              tabs: [
                {
                  title: 'Filters',
                  fields: filterFields.map((filter) => filter.column),
                  fieldsConfig: filterDefinitions,
                },
              ],
            },
          }
        : {}),
      ...(Object.keys(charts).length > 0 ? { charts } : {}),
      ...(Object.keys(preFilters).length > 0 ? { preFilters } : {}),
    } as unknown as CohortPanelConfiguration;
    return normalizeCohortPanelForDataset(
      panel,
      runtimeColumns[view.output],
      rootResourceType,
    );
  });
  const sharedFilters = activeConfig.sharedFilters
    ? {
        defined: Object.fromEntries(
          Object.entries(activeConfig.sharedFilters).map(([name, mappings]) => [
              name,
              normalizeSharedFilterMappings(
                mappings,
                runtimeColumns,
                rootResourceTypes,
              ).map((mapping) => ({
                index: mapping.output,
                field: mapping.column,
              })),
          ]),
        ),
      }
    : null;
  return {
    configuration:
      sharedFilters === null
        ? { explorerConfig, ...(fileActions ? { fileActions } : {}) }
        : {
            explorerConfig,
            sharedFilters,
            ...(fileActions ? { fileActions } : {}),
          },
    columns,
    runtimeColumns,
    rootResourceTypes,
  };
};

export const getExplorerLoomProblem = (
  error: unknown,
): PageLoadProblem | null => {
  if (!isLoomGraphQLRequestError(error)) return null;

  switch (error.code) {
    case 'DATASET_NOT_FOUND':
      return {
        severity: 'error',
        source: 'loom',
        status: 404,
        code: error.code,
        requestId: error.requestId,
        retryable: error.retryable,
        message:
          'Loom could not find the published dataframe for the Explorer selector. The active Explorer recipe/output identity is stale or has not been materialized.',
      };
    case 'FORBIDDEN':
      return {
        severity: 'error',
        source: 'loom',
        status: 403,
        code: error.code,
        requestId: error.requestId,
        retryable: false,
        message:
          'You do not have permission to access the data configured for this Explorer.',
      };
    case 'BACKEND_UNAVAILABLE':
      return {
        severity: 'error',
        source: 'loom',
        status: 503,
        code: error.code,
        requestId: error.requestId,
        retryable: true,
        message:
          'Explorer data is temporarily unavailable. Please try again shortly.',
      };
    default: {
      const retryable =
        typeof error.httpStatus === 'number' &&
        error.httpStatus >= 400 &&
        error.httpStatus < 500
          ? false
          : error.retryable;
      return {
        severity: 'error',
        source: 'loom',
        status: typeof error.httpStatus === 'number' ? error.httpStatus : 502,
        code: error.code,
        requestId: error.requestId,
        retryable,
        message:
          error.message ||
          'Explorer data could not be loaded. Please try again or contact an administrator if the problem continues.',
      };
    }
  }
};

const GetSharedFieldMapping = async (
  cohortBuilderConfiguration: CohortBuilderConfiguration,
  columnsByExplorerType?: LoomColumnsByExplorerType,
  runtimeColumnsByExplorerType?: LoomRuntimeColumnsByExplorerType,
  rootResourceTypes?: Readonly<Record<string, string | undefined>>,
) => {
  let sharedFiltersMap: SharedFieldMapping | null = null;

  if (cohortBuilderConfiguration?.sharedFilters) {
    if (
      cohortBuilderConfiguration?.sharedFilters?.autoCreate &&
      columnsByExplorerType
    ) {
      sharedFiltersMap = groupSharedFields(
        Object.fromEntries(
          Object.entries(columnsByExplorerType).map(([dataType, columns]) => [
            dataType,
            Array.from(columns),
          ]),
        ),
      );
    }
    if (cohortBuilderConfiguration?.sharedFilters?.defined) {
      sharedFiltersMap = cohortBuilderConfiguration?.sharedFilters?.defined;
      if (columnsByExplorerType) {
        sharedFiltersMap = Object.fromEntries(
          Object.entries(sharedFiltersMap)
            .map(([name, mappings]) => [
              name,
              mappings.filter((mapping) => {
                const columns = columnsByExplorerType[mapping.index];
                if (!columns) return true;
                const runtimeColumns = runtimeColumnsByExplorerType?.[mapping.index];
                if (runtimeColumns) {
                  return Boolean(
                    normalizeSharedFilterMappings(
                      [{ output: mapping.index, column: mapping.field }],
                      { [mapping.index]: runtimeColumns },
                      rootResourceTypes,
                    ).length,
                  );
                }
                return columns.has(mapping.field);
              }),
            ])
            .filter(([, mappings]) => mappings.length > 0),
        );
      }
    }
    if (sharedFiltersMap) {
      const indexToAlias = Object.values(
        cohortBuilderConfiguration?.explorerConfig,
      ).reduce(
        (acc: Record<string, string>, panel: CohortPanelConfiguration) => {
          acc[panel.guppyConfig.dataType] = panel.tabTitle;
          return acc;
        },
        {},
      );

      const updatedSharedFiltersMap: SharedFieldMapping = {};
      for (const [field, values] of Object.entries(sharedFiltersMap)) {
        updatedSharedFiltersMap[field] = values.map((x) => ({
          ...x,
          indexAlias: indexToAlias[x.index],
        }));
      }
      sharedFiltersMap = updatedSharedFiltersMap;
    }
  }

  return sharedFiltersMap;
};

const loadExplorerConfiguration = async (
  context: ServerPageContext,
): Promise<ExplorerPageData | PageLoadResult<ExplorerPageData>> => {
  const configId =
    typeof context.next.query.configId === 'string'
      ? context.next.query.configId
      : undefined;
  if (!configId) {
    context.problems.add({
      severity: 'error',
      source: 'loom',
      status: 404,
      code: 'EXPLORER_NOT_FOUND',
      retryable: false,
      message:
        'The requested published Explorer is unavailable or you do not have project read access.',
    });
    return { configuration: null, sharedFiltersMap: null };
  }
  let deployed: RepositoryExplorerConfig;
  const explorerID =
    typeof context.next.query.explorerId === 'string'
      ? context.next.query.explorerId
      : 'default';
  const configPath = `/api/v1/projects/${encodeURIComponent(configId)}/explorers/${encodeURIComponent(explorerID)}`;
  try {
    deployed = unwrapRepositoryExplorerResponse(
      await context.loom.get<unknown>(configPath),
    );
  } catch (error) {
    const status =
      typeof (error as { readonly status?: unknown }).status === 'number'
        ? (error as { readonly status: number }).status
        : 502;
    const authenticationFailure = status === 403;
    if (status === 401) {
      const redirectPath =
        context.next.resolvedUrl ?? context.next.req?.url ?? '/';
      return {
        kind: 'redirect',
        redirect: {
          destination: `/Login?redirect=${encodeURIComponent(redirectPath)}`,
          permanent: false,
        },
      };
    }
    context.problems.add({
      severity: 'error',
      source: 'loom',
      status,
      code: authenticationFailure
        ? 'LOOM_AUTHENTICATION_REQUIRED'
        : status === 404
          ? 'EXPLORER_CONFIG_NOT_FOUND'
          : 'EXPLORER_CONFIG_REQUEST_FAILED',
      requestId: (error as { readonly requestId?: string }).requestId,
      retryable: status >= 500,
      message: authenticationFailure
        ? 'Authentication is required to read the active Explorer publication.'
        : status === 404
          ? 'The published Explorer configuration is unavailable.'
          : 'The active Explorer configuration request failed.',
    });
    return { configuration: null, sharedFiltersMap: null };
  }
  let configuration: CohortBuilderConfiguration;
  let sharedFiltersMap: SharedFieldMapping | null;
  try {
    const pinned = loomRepositoryConfigConfiguration(deployed);
    configuration = pinned.configuration;
    sharedFiltersMap = await GetSharedFieldMapping(
      configuration,
      pinned.columns,
      pinned.runtimeColumns,
      pinned.rootResourceTypes,
    );
  } catch (error) {
    const problem = getExplorerLoomProblem(error);
    if (problem) {
      context.problems.add(problem);
    } else {
      const status =
        typeof (error as { readonly status?: unknown }).status === 'number'
        ? (error as { readonly status: number }).status
        : 502;
      const typedError = error as {
        readonly code?: string;
        readonly retryable?: boolean;
      };
      const detail = error instanceof Error ? error.message : undefined;
      const defaultMetadataFailure = explorerID === 'default';
      const problemStatus =
        status !== 502 || !defaultMetadataFailure ? status : 503;
      console.error('[Explorer] Published configuration loading failed', {
        project: configId,
        explorerId: explorerID,
        detail,
      });
      context.problems.add({
        severity: 'error',
        source: 'loom',
        status: problemStatus,
        code: typedError.code ?? (defaultMetadataFailure
          ? 'EXPLORER_DATASET_METADATA_INVALID'
          : 'EXPLORER_DATA_VALIDATION_FAILED'),
        requestId: (error as { readonly requestId?: string }).requestId,
        retryable: typedError.retryable ?? problemStatus >= 500,
        message: detail
          ? defaultMetadataFailure
            ? `The repository Explorer dataset metadata could not be loaded from Loom.\n${detail}`
            : `The published Explorer configuration could not be validated against Loom.\n${detail}`
          : defaultMetadataFailure
            ? 'The repository Explorer dataset metadata could not be loaded from Loom. Please retry or contact an administrator.'
            : 'The published Explorer configuration could not be validated against Loom. Please retry or contact an administrator.',
      });
    }
    return { configuration: null, sharedFiltersMap: null };
  }
  return { configuration, sharedFiltersMap };
};

export const ExplorerPageGetServerSideProps =
  definePageLoader<ExplorerPageData>({
    name: 'Explorer',
    loadNavigation: loadNavigationFromContext,
    load: loadExplorerConfiguration,
  });
