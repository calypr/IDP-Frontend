import React, { useMemo, useState } from 'react';
import { partial } from 'lodash';
import {
  Accessibility,
  AggregationsData,
  CombineMode,
  convertFilterSetToLoomFilters,
  CoreState,
  extractEnumFilterValue,
  FacetDefinition,
  FacetType,
  isExplorerDataType,
  isIntersection,
  selectIndexFilters,
  selectSharedFilters,
  useCoreSelector,
  toLoomDataType,
  useGetLoomAggregationsQuery,
  useGetLoomCountQuery,
  useGetLoomDatasetQuery,
} from '@gen3/core';
import { type CohortPanelConfiguration, type FileActionsConfig } from './types';
import { type SummaryChart } from '../../components/charts/types';
import { ErrorCard } from '../../components/MessageCards';
import { useMediaQuery } from '@mantine/hooks';
import {
  EnumFacetDataHooks,
  FacetDataHooks,
} from '../../components/facets/types';

import { Gen3Button } from '../../components/Buttons';
import {
  classifyFacets,
  extractRangeValues,
  getAllFieldsFromFilterConfigs,
  processBucketData,
  processRangeData,
  removeIntersectionFromEnum,
  useGetFacetFilters,
  useUpdateFilters,
} from '../../components/facets/utils';
import {
  useClearFilters,
  useFieldNameToTitle,
} from '../../components/facets/hooks';
import { Charts, CollapsableCharts } from '../../components/charts';
import ExplorerTable from './ExplorerTable/ExplorerTable';
import CountsValue from '../../components/counts/CountsValue';
import DownloadsPanel from './DownloadsPanel';
import {
  useDeepCompareCallback,
  useDeepCompareEffect,
  useDeepCompareMemo,
} from 'use-deep-compare';
import { toDisplayName } from '../../utils';
import {
  useCohortFilterCombineState,
  useFilterExpandedState,
  useSetCohortFilterCombineState,
  useToggleExpandFilter,
} from './hooks';
import DropdownPanel from '../../components/facets/Panels/DropdownPanel';
import QueryExpression from './QueryExpression';

const EmptyData = {};

interface CohortPanelConfigurationWithAccessLevel
  extends CohortPanelConfiguration {
  showAccessLevel?: boolean;
  fileActions?: FileActionsConfig;
}

export const CohortPanel = ({
  guppyConfig,
  filters,
  charts = {},
  chartsSection = undefined,
  table,
  tabTitle,
  dropdowns,
  buttons,
  loginForDownload,
  showAccessLevel = false,
  fileActions,
}: CohortPanelConfigurationWithAccessLevel): JSX.Element => {
  const isSm = useMediaQuery('(min-width: 639px)');
  const isMd = useMediaQuery('(min-width: 1373px)');
  const isXl = useMediaQuery('(min-width: 1600px)');
  const [showCharts, setShowCharts] = useState(false);
  const [accessLevel, setAccessLevel] = useState<Accessibility>(
    Accessibility.ALL,
  );

  const sharedFiltersMap = useCoreSelector((state: CoreState) =>
    selectSharedFilters(state),
  );

  const defaultDropdowns = useMemo(() => dropdowns ?? {}, [dropdowns]);
  const defaultButtons = useMemo(() => buttons ?? [], [buttons]);

  const numCols = useMemo(() => {
    if (isSm) return 1;
    if (isMd) return 2;
    if (isXl) return 4;
    return 3;
  }, [isSm, isMd, isXl]);

  const index = guppyConfig.dataType;
  const loomDataType = isExplorerDataType(index)
    ? toLoomDataType(index)
    : null;
  const fields = useMemo(
    () => getAllFieldsFromFilterConfigs(filters?.tabs ?? []),
    [filters?.tabs],
  );

  const [facetDefinitions, setFacetDefinitions] = useState<
    Record<string, FacetDefinition>
  >({});
  const [summaryCharts, setSummaryCharts] = useState<
    Record<string, SummaryChart>
  >({});

  const cohortFilters = useCoreSelector((state: CoreState) =>
    selectIndexFilters(state, index),
  );
  const loomFilters = useMemo(() => {
    try {
      return {
        filters: convertFilterSetToLoomFilters(cohortFilters),
        error: null,
      };
    } catch (error) {
      return {
        filters: [],
        error: error instanceof Error ? error.message : 'Unsupported Loom filter',
      };
    }
  }, [cohortFilters]);
  const {
    data: dataset,
    isError: isDatasetError,
    isLoading: isDatasetLoading,
  } = useGetLoomDatasetQuery(loomDataType ?? 'DocumentReference', {
    skip: !loomDataType,
  });

  const {
    data,
    isSuccess,
    isFetching: isAggsQueryFetching,
    isError: isAggsQueryError,
  } = useGetLoomAggregationsQuery(
    {
    dataType: loomDataType ?? 'DocumentReference',
    fields,
    filters: loomFilters.filters,
    },
    { skip: !loomDataType || !!loomFilters.error },
  );

  const chartKeys = useDeepCompareMemo(
    () => [...Object.keys(chartsSection?.charts ?? {}), ...Object.keys(charts)],
    [chartsSection?.charts, charts],
  );

  const {
    data: chartData,
    isSuccess: isChartSuccess,
    isFetching: isChartFetching,
    isError: isChartError,
  } = useGetLoomAggregationsQuery(
    {
      dataType: loomDataType ?? 'DocumentReference',
      fields: chartKeys,
      filters: loomFilters.filters,
    },
    { skip: chartKeys.length === 0 || !loomDataType || !!loomFilters.error },
  );

  const cleanChartData = useDeepCompareMemo(() => {
    if (isChartSuccess && chartData) {
      const cleanedData: AggregationsData = {};
      Object.keys(summaryCharts).forEach((key) => {
        if (chartData[key]) {
          cleanedData[key] = chartData[key].filter((x) =>
            typeof x.key !== 'string' ? true : x.key !== '',
          );
          const facetDef = facetDefinitions?.[key];
          if (facetDef?.excludeValues) {
            cleanedData[key] = cleanedData[key].filter((x) =>
              typeof x.key !== 'string'
                ? true
                : facetDef?.excludeValues?.includes(String(x.key)) === false,
            );
          }
        }
      });
      return cleanedData;
    }
    return chartData;
  }, [chartData, isChartSuccess, summaryCharts]);

  const getEnumFacetData = useDeepCompareCallback(
    (field: string) => {
      let filters = undefined;
      let combineMode: CombineMode = 'or';
      if (field in cohortFilters.root) {
        if (isIntersection(cohortFilters.root[field])) {
          const intersectionFilters = removeIntersectionFromEnum(
            cohortFilters.root[field],
          );
          if (intersectionFilters) {
            filters = extractEnumFilterValue(intersectionFilters);
            combineMode = 'and';
          }
        } else {
          filters = extractEnumFilterValue(cohortFilters.root[field]);
        }
      }
      return {
        data: processBucketData(data?.[field]),
        enumFilters: filters,
        combineMode,
        isSuccess,
      };
    },
    [cohortFilters.root, data, isSuccess],
  );

  const getRangeFacetData = useDeepCompareCallback(
    (field: string) => ({
      data: processRangeData(data?.[field]),
      filters: extractRangeValues(cohortFilters.root[field]),
      isSuccess,
    }),
    [data, cohortFilters.root, isSuccess],
  );

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const facetDataHooks: Record<FacetType, FacetDataHooks | EnumFacetDataHooks> =
    useDeepCompareMemo(() => {
      return {
        enum: {
          useGetFacetData: getEnumFacetData,
          useUpdateFacetFilters: partial(useUpdateFilters, index),
          useGetFacetFilters: partial(useGetFacetFilters, index),
          useClearFilter: partial(useClearFilters, index),
          useFilterExpanded: partial(useFilterExpandedState, index),
          useToggleExpandFilter: partial(useToggleExpandFilter, index),
          useGetCombineMode: partial(useCohortFilterCombineState, index),
          useSetCombineMode: partial(useSetCohortFilterCombineState, index),
          useFieldNameToTitle,
          useTotalCounts: undefined,
        },
        exact: {
          useGetFacetData: getEnumFacetData,
          useUpdateFacetFilters: partial(useUpdateFilters, index),
          useGetFacetFilters: partial(useGetFacetFilters, index),
          useClearFilter: partial(useClearFilters, index),
          useFieldNameToTitle,
          useTotalCounts: undefined,
        },
        multiselect: {
          useGetFacetData: getEnumFacetData,
          useUpdateFacetFilters: partial(useUpdateFilters, index),
          useGetFacetFilters: partial(useGetFacetFilters, index),
          useClearFilter: partial(useClearFilters, index),
          useFieldNameToTitle,
          useTotalCounts: undefined,
        },
        range: {
          useGetFacetData: getRangeFacetData,
          useUpdateFacetFilters: partial(useUpdateFilters, index),
          useGetFacetFilters: partial(useGetFacetFilters, index),
          useClearFilter: partial(useClearFilters, index),
          useFilterExpanded: partial(useFilterExpandedState, index),
          useToggleExpandFilter: partial(useToggleExpandFilter, index),
          useFieldNameToTitle,
          useTotalCounts: undefined,
        },
      };
    }, [getEnumFacetData, getRangeFacetData, index]);

  useDeepCompareEffect(() => {
    if (isSuccess && data) {
      const configFacetDefs = (filters?.tabs ?? []).reduce(
        (acc: Record<string, FacetDefinition>, tab) => ({
          ...tab.fieldsConfig,
          ...acc,
        }),
        {},
      );
      const facetDefs = classifyFacets(
        data,
        index,
        guppyConfig?.fieldMapping ?? [],
        configFacetDefs ?? {},
        sharedFiltersMap,
      );
      setFacetDefinitions(facetDefs);

      const chartDefinitions = chartsSection?.charts ?? charts;
      const summaryCharts = Object.keys(chartDefinitions).reduce(
        (acc, field) => {
          let chartField = field;
          if (facetDefs?.[field] === undefined) {
            const res = Object.values(facetDefs).filter(
              (def) => def.dataField === field,
            );
            if (res.length > 0) {
              chartField = res[0].field;
            }
          }
          return { ...acc, [chartField]: chartDefinitions[field] };
        },
        {},
      );
      setSummaryCharts(summaryCharts);
    }
  }, [
    isSuccess,
    data,
    index,
    guppyConfig.fieldMapping,
    charts,
    chartsSection,
    filters?.tabs,
    sharedFiltersMap,
  ]);

  const columnTitles = useMemo(
    () =>
      table?.columns
        ? Object.entries(table.columns).reduce(
            (acc, [field, column]) => ({
              ...acc,
              [field]: column.title,
            }),
            {},
          )
        : {},
    [table?.columns],
  );
  
  const {
    data: counts,
    isFetching: isCountsFetching,
    isSuccess: isCountSuccess,
    isError: isCountsError,
  } = useGetLoomCountQuery({
    dataType: loomDataType ?? 'DocumentReference',
    filters: loomFilters.filters,
    operation: 'COUNT',
  }, { skip: !loomDataType || !!loomFilters.error });

  if (!loomDataType) {
    return <ErrorCard message={`Unsupported Explorer data type: ${index}`} />;
  }
  if (loomFilters.error) {
    return <ErrorCard message={loomFilters.error} />;
  }
  if (isDatasetError) {
    return <ErrorCard message="Unable to discover the authorized Loom dataset" />;
  }
  if (isDatasetLoading) {
    return (
      <div className="flex items-center justify-center w-full h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!dataset) {
    return <ErrorCard message="No authorized Loom dataset is available for this Explorer tab" />;
  }
  if (dataset.state !== 'READY') {
    return <ErrorCard message={`Loom dataset is ${dataset.state.toLowerCase()}${dataset.error ? `: ${dataset.error}` : ''}`} />;
  }
  if (isCountsError || isAggsQueryError) {
    return <ErrorCard message="Unable to fetch data from server" />;
  }

  // Show loading indicator if we don't have facet definitions yet but we're fetching
  if (Object.keys(facetDefinitions).length === 0 && (isAggsQueryFetching || isCountsFetching)) {
    return (
       <div className="flex items-center justify-center w-full h-64">
           <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
       </div>
    );
  }

  return (
    <div className="flex flex-col mt-3 relative px-4 bg-base-lightest w-full">
      {/* Main flex container for filters and content */}
      <div className="flex w-full">
        {/* Left panel for filters */}
        <div
          id="cohort-builder-filters"
          className="flex-shrink-0 md:w-1/4 lg:w-1/5"
        >
          {filters?.tabs && (
            <DropdownPanel
              index={index}
              filters={filters}
              tabTitle={tabTitle}
              facetDefinitions={facetDefinitions}
              facetDataHooks={facetDataHooks}
              onAccessChange={setAccessLevel}
              accessLevel={accessLevel}
              showAccessLevel={showAccessLevel}
            />
          )}
        </div>

        {/* Right panel for query expression + content */}
        <div
          id="cohort-builder-content"
          className="flex flex-col md:w-3/4 lg:w-4/5 pl-4"
        >
          {/* Put QueryExpression at the top of content panel */}
          <div className="mb-2">
            <QueryExpression index={index} columnTitles={columnTitles} />
          </div>

          <div className="flex justify-between my-2">
            <DownloadsPanel
              dropdowns={defaultDropdowns}
              buttons={defaultButtons}
              loginForDownload={loginForDownload}
              index={index}
              totalCount={counts ?? 0}
              fields={table?.fields ?? []}
              filter={cohortFilters}
            />
            <div className="flex justify-between flex-row items-center my-2">
              {Object.keys(summaryCharts).length !== 0 && (
                <Gen3Button
                  colors="primary"
                  onClick={() => setShowCharts(!showCharts)}
                  className="px-2 py-1 text-primary-contrast rounded mr-4 active:scale-95"
                >
                  {showCharts ? 'Hide Charts' : 'Show Charts'}
                </Gen3Button>
              )}
              <CountsValue
                label={guppyConfig.nodeCountTitle ?? ''}
                counts={counts}
                isFetching={isCountsFetching}
                isError={isCountsError}
              />
            </div>
          </div>

          {showCharts && (
            <Charts
              charts={summaryCharts}
              data={data ?? EmptyData}
              counts={counts}
              isSuccess={isChartSuccess}
              numCols={numCols}
            />
          )}

          {table?.enabled && (
            <div className="mt-2 flex flex-col">
              <ExplorerTable
                index={index}
                tableConfig={table}
                accessibility={accessLevel}
                fileActions={fileActions}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
