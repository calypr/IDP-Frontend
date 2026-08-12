import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import {
  CohortBuilderConfiguration,
  CohortPanelConfiguration,
} from '../../features/CohortBuilder';
import {
  GEN3_COMMONS_NAME,
  buildLoomDatasetColumnsQuery,
  groupSharedFields,
  isLoomGraphQLRequestError,
  isLoomDataType,
  LoomDataType,
  LoomDatasetSelector,
  SharedFieldMapping,
} from '@gen3/core';
import type {
  RequestBoundLoomClient,
  PageLoadProblem,
  ServerPageContext,
} from '../../lib/pageLoader';
import { ExplorerConfigurationSchema } from './configurationSchema';
import type { ExplorerPageData } from './types';

type LoomColumnsByExplorerType = Record<string, ReadonlySet<string>>;

type ExplorerRevisionDiagnostic = {
  readonly code?: string;
  readonly configPath?: string;
  readonly message?: string;
};

type ResolvedExplorerRevision = {
  readonly status?: string;
  readonly configRevisionId?: string;
  readonly config?: unknown;
  readonly recipeName?: string;
  readonly translationVersion?: string;
  readonly outputs?: Readonly<
    Record<
      string,
      {
        readonly materializationId?: string;
        readonly columns?: ReadonlyArray<{ readonly name: string }>;
      }
    >
  >;
  readonly errors?: readonly ExplorerRevisionDiagnostic[];
  readonly warnings?: readonly ExplorerRevisionDiagnostic[];
  readonly acknowledgedOmissions?: readonly ExplorerRevisionDiagnostic[];
};

export const pinResolvedConfiguration = (
  configuration: CohortBuilderConfiguration,
  revision: ResolvedExplorerRevision,
): {
  readonly configuration: CohortBuilderConfiguration;
  readonly columns: LoomColumnsByExplorerType;
} => {
  const recipe = revision.recipeName;
  const translationVersion = revision.translationVersion;
  if (!recipe || !translationVersion) {
    throw new Error(
      'Resolved Explorer release is missing its pinned recipe identity',
    );
  }
  const columns: LoomColumnsByExplorerType = {};
  const explorerConfig = configuration.explorerConfig.map((panel) => {
    const outputCandidate = (panel.guppyConfig as { output?: unknown }).output;
    const output =
      typeof outputCandidate === 'string'
        ? outputCandidate
        : panel.guppyConfig.dataType;
    const resolvedOutput = revision.outputs?.[output];
    if (!resolvedOutput?.materializationId) {
      throw new Error(`Resolved Explorer output ${output} is unavailable`);
    }
    const selector: LoomDatasetSelector = {
      recipe,
      translationVersion,
      output,
      materializationId: resolvedOutput.materializationId,
    };
    columns[panel.guppyConfig.dataType] = new Set(
      (resolvedOutput.columns ?? []).map((column) => column.name),
    );
    return {
      ...panel,
      guppyConfig: { ...panel.guppyConfig, loomDataset: selector },
    };
  });
  return { configuration: { ...configuration, explorerConfig }, columns };
};

const resolvedRevisionProblem = (
  diagnostic: ExplorerRevisionDiagnostic,
  severity: 'warning' | 'error',
): PageLoadProblem => ({
  severity,
  source: 'gecko',
  status: severity === 'error' ? 409 : 200,
  code: diagnostic.code,
  configPath: diagnostic.configPath,
  retryable: false,
  message:
    diagnostic.message ??
    'The active Explorer revision contains a configuration diagnostic.',
});

export const resolveExplorerRevisionConfiguration = (
  revision: ResolvedExplorerRevision,
  addProblem: (problem: PageLoadProblem) => void,
): unknown | null => {
  const errors = revision.errors ?? [];
  if (
    !['VALID', 'VALID_WITH_OMISSIONS'].includes(revision.status ?? '') ||
    errors.length > 0 ||
    revision.config === undefined
  ) {
    if (errors.length > 0) {
      errors.forEach((diagnostic) =>
        addProblem(resolvedRevisionProblem(diagnostic, 'error')),
      );
    } else {
      addProblem({
        severity: 'error',
        source: 'gecko',
        status: revision.status === 'UNAVAILABLE' ? 503 : 409,
        code: revision.status,
        retryable: revision.status === 'UNAVAILABLE',
        message:
          revision.status === 'UNAVAILABLE'
            ? 'No compatible Explorer revision is currently available.'
            : 'The active Explorer revision is not valid for its Loom datasets.',
      });
    }
    return null;
  }

  [
    ...(revision.warnings ?? []),
    ...(revision.acknowledgedOmissions ?? []),
  ].forEach((diagnostic) =>
    addProblem(resolvedRevisionProblem(diagnostic, 'warning')),
  );
  return revision.config;
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
        retryable: true,
        message:
          'Explorer data has not been published yet. An administrator must publish the Loom dataset before this Explorer can be used.',
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
    default:
      return {
        severity: 'error',
        source: 'loom',
        status: typeof error.httpStatus === 'number' ? error.httpStatus : 502,
        code: error.code,
        requestId: error.requestId,
        retryable: error.retryable,
        message:
          'Explorer data could not be loaded. Please try again or contact an administrator if the problem continues.',
      };
  }
};

const GetLoomColumnsByExplorerType = async (
  cohortBuilderConfiguration: CohortBuilderConfiguration,
  loom: RequestBoundLoomClient,
): Promise<LoomColumnsByExplorerType> => {
  const tabs = cohortBuilderConfiguration?.explorerConfig ?? [];
  const configuredDataTypes = Array.from(
    new Set(tabs.map((tab) => tab.guppyConfig.dataType)),
  );
  const dataTypes = configuredDataTypes.filter(
    isLoomDataType,
  ) as LoomDataType[];
  if (dataTypes.length !== configuredDataTypes.length) {
    throw new Error('Explorer configuration must use Loom data types');
  }
  const payload = await loom.graphql<
    Record<string, { name: string; columns: Array<{ name: string }> } | null>
  >(buildLoomDatasetColumnsQuery(dataTypes));
  console.info(
    '[Explorer] Loom datasets',
    Object.fromEntries(
      dataTypes.map((dataType, index) => {
        const dataset = payload[`d${index}`];
        return [
          dataType,
          dataset
            ? {
                name: dataset.name,
                columns: dataset.columns.map((column) => column.name),
              }
            : null,
        ];
      }),
    ),
  );

  return Object.fromEntries(
    tabs.map((tab) => {
      const dataType = tab.guppyConfig.dataType;
      const datasetIndex = configuredDataTypes.indexOf(dataType);
      const dataset = payload[`d${datasetIndex}`];
      if (!dataset) {
        throw new Error(`Loom dataset ${dataType} is not available`);
      }
      return [dataType, new Set(dataset.columns.map((column) => column.name))];
    }),
  );
};

type ConfiguredField = {
  readonly dataset: string;
  readonly source: string;
  readonly field: string;
};

const GetPanelFields = (
  panel: CohortPanelConfiguration,
  panelIndex: number,
): ReadonlyArray<ConfiguredField> => {
  const dataset = panel.guppyConfig.dataType;
  const fields: ConfiguredField[] = [];
  const add = (source: string, field: string | undefined) => {
    if (field) fields.push({ dataset, source, field });
  };
  const addAll = (source: string, values: ReadonlyArray<string> | undefined) =>
    values?.forEach((field) => add(source, field));

  panel.filters?.tabs.forEach((tab, index) =>
    addAll(`filters.tabs[${index}].fields`, tab.fields),
  );
  addAll(
    'guppyConfig.accessibleFieldCheckList',
    panel.guppyConfig.accessibleFieldCheckList,
  );
  add(
    'guppyConfig.accessibleValidationField',
    panel.guppyConfig.accessibleValidationField,
  );
  Object.keys(panel.charts ?? {}).forEach((field) => add('charts', field));
  Object.keys(panel.chartsSection?.charts ?? {}).forEach((field) =>
    add('chartsSection.charts', field),
  );
  addAll('table.fields', panel.table?.fields);
  Object.entries(panel.table?.columns ?? {}).forEach(([field, column]) => {
    add('table.columns', field);
    add('table.columns.accessorPath', column.accessorPath);
  });
  panel.table?.subTables?.forEach((table, index) =>
    addAll(`table.subTables[${index}].fields`, table.fields),
  );
  add('table.detailsConfig.idField', panel.table?.detailsConfig?.idField);
  Object.keys(panel.preFilters ?? {}).forEach((field) =>
    add('preFilters', field),
  );
  panel.buttons?.forEach((button, index) =>
    addAll(
      `buttons[${index}].actionArgs.fileFields`,
      (
        button.actionArgs as unknown as
          | { fileFields?: ReadonlyArray<string> }
          | undefined
      )?.fileFields,
    ),
  );

  return fields.map((field) => ({
    ...field,
    source: `explorerConfig[${panelIndex}].${field.source}`,
  }));
};

/** Throws when a config references a column absent from its Loom dataset. */
export const ValidateExplorerConfiguration = (
  configuration: CohortBuilderConfiguration,
  columnsByExplorerType: LoomColumnsByExplorerType,
): void => {
  const fields = configuration.explorerConfig.flatMap(GetPanelFields);
  Object.entries(configuration.sharedFilters?.defined ?? {}).forEach(
    ([name, mappings]) =>
      mappings.forEach((mapping, index) =>
        fields.push({
          dataset: mapping.index,
          source: `sharedFilters.defined.${name}[${index}]`,
          field: mapping.field,
        }),
      ),
  );
  const missing = fields.filter(
    ({ dataset, field }) => !columnsByExplorerType[dataset]?.has(field),
  );
  if (missing.length === 0) return;

  throw new Error(
    `Explorer configuration does not match Loom datasets:\n${missing
      .map(({ dataset, source, field }) => `- ${dataset} ${source}: ${field}`)
      .join('\n')}`,
  );
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

const PrepareExplorerConfiguration = async (
  cohortBuilderConfiguration: CohortBuilderConfiguration,
  loom: RequestBoundLoomClient,
) => {
  const columnsByExplorerType = await GetLoomColumnsByExplorerType(
    cohortBuilderConfiguration,
    loom,
  );
  ValidateExplorerConfiguration(
    cohortBuilderConfiguration,
    columnsByExplorerType,
  );
  return {
    configuration: cohortBuilderConfiguration,
    sharedFiltersMap: await GetSharedFieldMapping(
      cohortBuilderConfiguration,
      columnsByExplorerType,
    ),
  };
};

const normalizeExplorerConfiguration = (
  rawConfiguration: unknown,
): CohortBuilderConfiguration => {
  const parsedConfiguration =
    ExplorerConfigurationSchema.parse(rawConfiguration);
  return Array.isArray(parsedConfiguration)
    ? {
        explorerConfig:
          parsedConfiguration as unknown as CohortPanelConfiguration[],
      }
    : (parsedConfiguration as unknown as CohortBuilderConfiguration);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Immutable releases use the builder contract (`schemaVersion` + `tabs`).
 * Legacy content callers continue through ExplorerConfigurationSchema above;
 * this adapter is intentionally only used for resolved share releases.
 */
export const normalizeResolvedExplorerConfiguration = (
  rawConfiguration: unknown,
): CohortBuilderConfiguration => {
  if (!isRecord(rawConfiguration) || rawConfiguration.schemaVersion !== 1) {
    return normalizeExplorerConfiguration(rawConfiguration);
  }
  const rawTabs = Array.isArray(rawConfiguration.tabs)
    ? rawConfiguration.tabs.filter(isRecord)
    : [];
  const explorerConfig = rawTabs.map((tab, index) => {
    const output =
      typeof tab.output === 'string' ? tab.output : `Output${index + 1}`;
    const rawTable = isRecord(tab.table) ? tab.table : {};
    const rawColumns = rawTable.columns;
    const columnEntries: Array<[string, Record<string, unknown>]> = [];
    if (Array.isArray(rawColumns)) {
      rawColumns.filter(isRecord).forEach((column) => {
        const field =
          typeof column.field === 'string' ? column.field : undefined;
        if (!field) return;
        columnEntries.push([
          field,
          {
            ...column,
            field,
            title:
              typeof column.label === 'string'
                ? column.label
                : typeof column.title === 'string'
                  ? column.title
                  : field,
          },
        ]);
      });
    } else if (isRecord(rawColumns)) {
      Object.entries(rawColumns).forEach(([field, column]) => {
        if (isRecord(column)) columnEntries.push([field, column]);
      });
    }
    const fields = Array.isArray(rawTable.fields)
      ? rawTable.fields.filter(
          (field): field is string => typeof field === 'string',
        )
      : columnEntries.map(([field]) => field);
    const table = {
      ...rawTable,
      enabled: rawTable.enabled !== false,
      fields,
      columns: Object.fromEntries(columnEntries),
    };
    const rawGuppyConfig = isRecord(tab.guppyConfig) ? tab.guppyConfig : {};
    return {
      ...tab,
      tabTitle:
        typeof tab.title === 'string'
          ? tab.title
          : typeof tab.tabTitle === 'string'
            ? tab.tabTitle
            : output,
      guppyConfig: {
        ...rawGuppyConfig,
        dataType: output,
        output,
      },
      table,
    } as unknown as CohortPanelConfiguration;
  });
  return { explorerConfig };
};

const loadExplorerConfiguration = async (
  context: ServerPageContext,
  source: 'content' | 'config' | 'release',
): Promise<ExplorerPageData> => {
  const configId =
    typeof context.next.query.configId === 'string'
      ? context.next.query.configId
      : undefined;
  const releaseId =
    typeof context.next.query.releaseId === 'string'
      ? context.next.query.releaseId
      : undefined;
  if (source === 'release' && !releaseId) {
    context.problems.add({
      severity: 'error',
      source: 'gecko',
      status: 404,
      code: 'RELEASE_ID_REQUIRED',
      retryable: false,
      message: 'An immutable Explorer release ID is required.',
    });
    return { configuration: null, sharedFiltersMap: null };
  }
  const resolvedRelease =
    source === 'release' && releaseId
      ? await context.gecko.get<ResolvedExplorerRevision>(
          `explorer/releases/${releaseId}/resolved`,
        )
      : undefined;
  let rawConfiguration: unknown;
  if (resolvedRelease) {
    rawConfiguration = resolveExplorerRevisionConfiguration(
      resolvedRelease,
      (problem) => context.problems.add(problem),
    );
  } else if (source === 'config' && configId) {
    rawConfiguration = await context.config.optional({
      id: `explorer.${configId}`,
      source: 'gecko',
      resolvePath: () => `explorer/${configId}`,
      schema: ExplorerConfigurationSchema,
    });
  } else {
    rawConfiguration = await context.config.load({
      id: 'explorer',
      source: 'content',
      resolvePath: () => `${GEN3_COMMONS_NAME}/explorer.json`,
      schema: ExplorerConfigurationSchema,
    });
  }
  if (rawConfiguration === null) {
    return { configuration: null, sharedFiltersMap: null };
  }
  let configuration = resolvedRelease
    ? normalizeResolvedExplorerConfiguration(rawConfiguration)
    : normalizeExplorerConfiguration(rawConfiguration);
  let sharedFiltersMap: SharedFieldMapping | null;
  try {
    if (resolvedRelease) {
      const pinned = pinResolvedConfiguration(configuration, resolvedRelease);
      configuration = pinned.configuration;
      ValidateExplorerConfiguration(configuration, pinned.columns);
      sharedFiltersMap = await GetSharedFieldMapping(
        configuration,
        pinned.columns,
      );
    } else {
      ({ sharedFiltersMap } = await PrepareExplorerConfiguration(
        configuration,
        context.loom,
      ));
    }
  } catch (error) {
    const problem = getExplorerLoomProblem(error);
    if (!problem) throw error;
    context.problems.add(problem);
    return { configuration: null, sharedFiltersMap: null };
  }
  return { configuration, sharedFiltersMap };
};

export const ExplorerPageGetServerSideProps =
  definePageLoader<ExplorerPageData>({
    name: 'Explorer',
    loadNavigation: loadNavigationFromContext,
    load: (context) => loadExplorerConfiguration(context, 'content'),
    fallback: () => ({ configuration: null, sharedFiltersMap: null }),
  });

export const ExplorerPageGetServerSidePropsForRelease =
  definePageLoader<ExplorerPageData>({
    name: 'Shared Explorer release',
    loadNavigation: loadNavigationFromContext,
    load: (context) => loadExplorerConfiguration(context, 'release'),
    fallback: () => ({ configuration: null, sharedFiltersMap: null }),
  });

export const ExplorerPageGetServerSidePropsForConfigId =
  definePageLoader<ExplorerPageData>({
    name: 'Explorer config',
    loadNavigation: loadNavigationFromContext,
    load: (context) => loadExplorerConfiguration(context, 'config'),
    fallback: () => ({ configuration: null, sharedFiltersMap: null }),
  });
