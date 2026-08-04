import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import {
  CohortBuilderConfiguration,
  CohortBuilderProps,
  CohortPanelConfiguration,
} from '../../features/CohortBuilder';
import {
  GEN3_COMMONS_NAME,
  buildLoomDatasetColumnsQuery,
  fetchLoomGraphQL,
  groupSharedFields,
  isLoomDataType,
  LoomDataType,
  SharedFieldMapping,
} from '@gen3/core';
import { isArray } from 'lodash';
import type { NavPageLayoutProps } from '../../features/Navigation';
import {
  AccessControlConfiguration,
  GuppyDataAccessMode,
} from '../../features/CohortBuilder/types';
import { microserviceDb } from '../../lib/content';

const DefaultHeaderMetadata = {
  title: 'Gen3 Explorer Page',
  content: 'Explorer Page',
  key: 'gen3-explorer-page',
};

const getErrorStatus = (error: unknown): number =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  typeof error.status === 'number'
    ? error.status
    : 500;

type LoomColumnsByExplorerType = Record<string, ReadonlySet<string>>;

const GetLoomColumnsByExplorerType = async (
  cohortBuilderConfiguration: CohortBuilderConfiguration,
  requestHeaders: Record<string, string>,
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
  const payload = await fetchLoomGraphQL<
    Record<string, { name: string; columns: Array<{ name: string }> } | null>
  >(buildLoomDatasetColumnsQuery(dataTypes), { headers: requestHeaders });
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
          { fileFields?: ReadonlyArray<string> } | undefined
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
  requestHeaders: Record<string, string>,
) => {
  const columnsByExplorerType = await GetLoomColumnsByExplorerType(
    cohortBuilderConfiguration,
    requestHeaders,
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

const DefaultAccessControlConfiguration: AccessControlConfiguration = {
  dataMode: GuppyDataAccessMode.REGULAR,
  tierLimit: -1,
  showAccessLevelControl: false,
};

export const ExplorerPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps | CohortBuilderProps | { errorStatus?: number }
> = async (context) => {
  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }
  if (context.req.headers.authorization) {
    requestHeaders['Authorization'] = context.req.headers.authorization;
  }
  try {
    const cohortBuilderConfiguration: CohortBuilderConfiguration =
      await ContentSource.getContentDatabase().get(
        `${GEN3_COMMONS_NAME}/explorer.json`,
        requestHeaders,
      );

    if (isArray(cohortBuilderConfiguration)) {
      return {
        props: {
          ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
          explorerConfig: cohortBuilderConfiguration,
          headerMetadata: cohortBuilderConfiguration?.headerMetadata
            ? cohortBuilderConfiguration.headerMetadata
            : DefaultHeaderMetadata,
        },
      };
    }

    const { configuration, sharedFiltersMap } =
      await PrepareExplorerConfiguration(
        cohortBuilderConfiguration,
        requestHeaders,
      );

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        sharedFiltersMap: sharedFiltersMap,
        tabsLayout: configuration?.tabsLayout ?? 'left',
        explorerConfig: configuration.explorerConfig,
        accessControl: {
          ...DefaultAccessControlConfiguration,
          ...(configuration.accessControl ?? {}),
        },
        fileActions: configuration.fileActions ?? null,
      },
    };
  } catch (err: unknown) {
    console.error('Failed to load Explorer configuration:', err);
    const status = getErrorStatus(err);
    context.res.statusCode = status;
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        explorerConfig: null,
        errorStatus: status,
      },
    };
  }
};

export const ExplorerPageGetServerSidePropsForConfigId: GetServerSideProps<
  NavPageLayoutProps | CohortBuilderProps | { errorStatus?: number }
> = async (context) => {
  const configId = context.query.configId as string;

  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }
  if (context.req.headers.authorization) {
    requestHeaders['Authorization'] = context.req.headers.authorization;
  }

  try {
    const cohortBuilderConfiguration: CohortBuilderConfiguration =
      await microserviceDb.get<CohortBuilderConfiguration>(
        `explorer/${configId}`,
        requestHeaders,
      );

    if (isArray(cohortBuilderConfiguration)) {
      return {
        props: {
          ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
          explorerConfig: cohortBuilderConfiguration,
          headerMetadata: cohortBuilderConfiguration?.headerMetadata
            ? cohortBuilderConfiguration.headerMetadata
            : DefaultHeaderMetadata,
        },
      };
    }

    const { configuration, sharedFiltersMap } =
      await PrepareExplorerConfiguration(
        cohortBuilderConfiguration,
        requestHeaders,
      );

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        sharedFiltersMap: sharedFiltersMap,
        tabsLayout: configuration?.tabsLayout ?? 'left',
        explorerConfig: configuration.explorerConfig,
        accessControl: {
          ...DefaultAccessControlConfiguration,
          ...(configuration.accessControl ?? {}),
        },
        fileActions: configuration.fileActions ?? null,
      },
    };
  } catch (err: unknown) {
    console.error(`Failed to load Explorer config ${configId}:`, err);
    const status = getErrorStatus(err);
    context.res.statusCode = status;
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        explorerConfig: null,
        errorStatus: status,
      },
    };
  }
};
