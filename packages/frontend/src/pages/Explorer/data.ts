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
  ExplorerPhysicalColumnV2,
  FacetDefinition,
  LoomColumn,
  LoomDataset,
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
} from '../../features/CohortBuilder/runtimeConfiguration';

type LoomColumnsByExplorerType = Record<string, ReadonlySet<string>>;

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

/**
 * The browser lifecycle client and some Loom deployments expose REST resources
 * in a `{ data: ... }` envelope. The Viewer loads this resource during SSR
 * through the request-bound client, so normalize it at this boundary too.
 */
export const unwrapRepositoryExplorerResponse = (
  payload: unknown,
): RepositoryExplorerConfig => {
  const value = isRecord(payload) && isRecord(payload.data) ? payload.data : payload;
  return value as RepositoryExplorerConfig;
};

const getFacetType = (column: LoomColumn): FacetDefinition['type'] => {
  const type = `${column.logicalType} ${column.clickhouseType}`.toLowerCase();
  if (type.includes('bool')) return 'toggle';
  if (type.includes('date') || type.includes('time')) return 'datetime';
  if (
    type.includes('int') ||
    type.includes('float') ||
    type.includes('decimal') ||
    type.includes('double') ||
    type.includes('number')
  )
    return 'range';
  return 'enum';
};

const getRepositoryDatasets = (
  deployed: RepositoryExplorerConfig,
): ReadonlyArray<LoomDataset> => {
  const datasetOutputs = deployed.dataset?.outputs ?? [];
  if (datasetOutputs.length > 0)
    return datasetOutputs.map((output) =>
      loomDatasetFromOutput(deployed, output),
    );
  if (deployed.datasets?.length)
    return deployed.datasets.map((dataset) => ({
      ...dataset,
      dataType: normalizeExplorerOutputName(dataset.dataType) as LoomDataset['dataType'],
      selector:
        (isDataframeSelector(dataset.selector) ? dataset.selector : undefined) ??
        materializationSelectorForOutput(deployed, dataset.name),
    }));

  // Older Loom responses exposed the same physical columns through
  // materializations. Keep the column fallback, but derive the request
  // selector from the server recipe metadata instead of the materialization
  // identifier.
  return (deployed.materializations ?? []).map((materialization) => ({
    id: `${deployed.project}:${materialization.output}`,
    name: materialization.output,
    dataType: normalizeExplorerOutputName(materialization.output) as LoomDataset['dataType'],
    selector: materializationSelectorForOutput(deployed, materialization.output),
    revision: deployed.sourceGeneration ?? materialization.output,
    state: 'READY',
    columns: materialization.columns,
    rowCount: 0,
    createdAt: '',
  })) as ReadonlyArray<LoomDataset>;
};

const loomColumnFromPhysicalColumn = (
  column: ExplorerPhysicalColumnV2,
): LoomColumn => ({
  name: column.name,
  clickhouseType: column.clickhouseType ?? 'String',
  logicalType: column.logicalType ?? 'string',
  nullable: column.nullable ?? true,
  repeated: column.repeated ?? false,
  // The repository default must not invent capabilities for a column when
  // Loom only supplies its physical name/type. Unsupported aggregate or sort
  // requests otherwise make the entire default tab fail to render.
  filterable: column.filterable ?? false,
  sortable: column.sortable ?? false,
  aggregatable: column.aggregatable ?? false,
});

const loomDatasetFromOutput = (
  deployed: RepositoryExplorerConfig,
  output: ExplorerDatasetOutputV2,
): LoomDataset => {
  const outputName = outputNameFromMetadata(output);
  const selector = materializationSelectorForOutput(deployed, outputName, output);
  return {
    id: `${deployed.project}:${outputName}`,
    name: outputName,
    dataType: normalizeExplorerOutputName(outputName) as LoomDataset['dataType'],
    selector,
    revision:
      deployed.dataset?.generation ?? deployed.sourceGeneration ?? outputName,
    state: normalizedOutputState(output),
    columns: (output.columns ?? []).map(loomColumnFromPhysicalColumn),
    rowCount: 0,
    createdAt: deployed.updatedAt,
  };
};

type MaterializationReference = {
  readonly output: string;
  readonly outputId?: string;
  readonly materializationId: string;
  readonly selector?: LoomDatasetSelector;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  readonly columns?: ReadonlyArray<{ readonly name: string }>;
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
  })),
  ...(deployed.frozenMaterializationMappings ?? []).map((mapping) => ({
    outputId: mapping.outputId,
    output: mapping.output,
    materializationId: mapping.materializationId,
    selector: mapping.selector,
    recipeName: mapping.recipeName,
    translationVersion: mapping.translationVersion,
    columns: mapping.columns,
  })),
  ...(deployed.materializations ?? []).map((materialization) => ({
    outputId: materialization.outputId,
    output: materialization.output,
    materializationId: materialization.materializationId,
    columns: materialization.columns,
  })),
];

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

const outputNameFromMetadata = (output: ExplorerDatasetOutputV2): string => {
  const value = output as unknown as Record<string, unknown>;
  return typeof value.output === 'string'
    ? value.output.trim()
    : typeof value.name === 'string'
      ? value.name.trim()
      : typeof value.dataType === 'string'
        ? value.dataType.trim()
        : '';
};

const normalizedOutputState = (
  output: ExplorerDatasetOutputV2,
): LoomDataset['state'] => {
  if (output.queryable === false) return 'UNQUERYABLE';
  const rawState =
    typeof output.state === 'string' ? output.state.trim().toUpperCase() : '';
  if (
    !rawState ||
    ['READY', 'PUBLISHED', 'MATERIALIZED', 'AVAILABLE', 'QUERYABLE', 'ACTIVE'].includes(
      rawState,
    )
  )
    return 'READY';
  return rawState;
};

const isReadyDataset = (dataset: LoomDataset): boolean =>
  dataset.state.toUpperCase() === 'READY';

/**
 * Builds the repository/default presentation from Loom's live dataset
 * metadata. The default Explorer deliberately has no server-owned views,
 * filters, or physical column list to become stale.
 */
const defaultConfigurationFromDatasets = (
  datasets: ReadonlyArray<LoomDataset>,
  project: string,
): {
  readonly configuration: CohortBuilderConfiguration;
  readonly columns: LoomColumnsByExplorerType;
} => {
  const readyDatasets = datasets.filter(
    (dataset) => isReadyDataset(dataset) && dataset.dataType.trim().length > 0,
  );
  if (readyDatasets.length === 0) {
    const summary =
      datasets.length > 0
        ? datasets
            .map(
              (dataset) =>
                `${dataset.name || '<unnamed>'} [${dataset.dataType || '<unknown>'}; ${dataset.state || '<unknown>'}; ${dataset.columns.length} columns]`,
            )
            .join(', ')
        : 'no dataset records';
    throw new Error(
      `Loom did not publish any READY Explorer datasets. Received: ${summary}`,
    );
  }

  const columns: LoomColumnsByExplorerType = {};
  const explorerConfig = readyDatasets.map((dataset) => {
    if (!dataset.selector)
      throw missingSelectorError(dataset.dataType);
    const datasetColumns = dataset.columns;
    const fields = datasetColumns.map((column) => column.name);
    columns[dataset.dataType] = new Set(fields);
    const filterColumns = datasetColumns.filter((column) => column.filterable);
    const fieldsConfig = Object.fromEntries(
      filterColumns.map((column) => [
        column.name,
        {
          field: column.name,
          index: dataset.dataType,
          label: column.name,
          type: getFacetType(column),
        } satisfies FacetDefinition,
      ]),
    );

    return {
      tabTitle: dataset.dataType,
      guppyConfig: {
        dataType: dataset.dataType,
        output: dataset.dataType,
        loomDataset: dataset.selector,
        loomProjectIds: [project],
      },
      table: {
        enabled: true,
        fields,
        columns: Object.fromEntries(
          datasetColumns.map((column) => [
            column.name,
            { field: column.name, title: column.name },
          ]),
        ),
      },
      ...(filterColumns.length > 0
        ? {
            filters: {
              tabs: [
                {
                  title: 'Filters',
                  fields: filterColumns.map((column) => column.name),
                  fieldsConfig,
                },
              ],
            },
          }
        : {}),
    } as CohortPanelConfiguration;
  });

  return {
    configuration: { explorerConfig },
    columns,
  };
};

/** Converts the authenticated, frozen V2 deployment record into the existing renderer contract. */
export const loomRepositoryConfigConfiguration = (
  deployed: RepositoryExplorerConfig,
): {
  readonly configuration: CohortBuilderConfiguration;
  readonly columns: LoomColumnsByExplorerType;
} => {
  // A published repository default has no draft, but its active V2 packet is
  // still the authoritative presentation contract. Falling back to datasets
  // only when no active packet exists preserves filters, charts, fixed/shared
  // filters, and table visibility for the default Explorer.
  if (!deployed.activeConfig)
    return defaultConfigurationFromDatasets(getRepositoryDatasets(deployed), deployed.project);

  const columns: LoomColumnsByExplorerType = {};
  const activeConfig = deployed.activeConfig;
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
    const availableColumns =
      (materialization?.columns?.length ? materialization.columns : undefined) ??
      (outputMetadata?.columns?.length ? outputMetadata.columns : undefined) ??
      (deployed.emittedColumns?.length ? deployed.emittedColumns : undefined) ??
      configuredColumns;
    columns[view.output] = new Set(
      availableColumns.map((column) => column.name),
    );
    const fields = view.table.columns.filter((column) => column.visible);
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
          fields.map((column) => [
            column.column,
            { field: column.column, title: column.label || column.column },
          ]),
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
    return normalizeCohortPanelForDataset(panel, availableColumns);
  });
  const sharedFilters = activeConfig.sharedFilters
    ? {
        defined: Object.fromEntries(
          Object.entries(activeConfig.sharedFilters).map(([name, mappings]) => [
            name,
            normalizeSharedFilterMappings(mappings, columns).map((mapping) => ({
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
        ? { explorerConfig }
        : { explorerConfig, sharedFilters },
    columns,
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
                return !columns || columns.has(mapping.field);
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
