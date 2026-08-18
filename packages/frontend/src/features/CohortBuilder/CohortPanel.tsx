import React, { useMemo, useState } from 'react';
import { partial } from 'lodash';
import { skipToken } from '@reduxjs/toolkit/query';
import {
  Accessibility,
  AggregationsData,
  CombineMode,
  convertFilterSetToLoomFilters,
  CoreState,
  extractEnumFilterValue,
  FacetDefinition,
  FacetType,
  isIntersection,
  selectIndexFilters,
  selectSharedFilters,
  useCoreSelector,
  useGetLoomAggregationsQuery,
  useGetLoomCountQuery,
  useGetLoomDatasetBySelectorQuery,
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

interface CohortPanelConfigurationWithAccessLevel extends CohortPanelConfiguration {
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
  const loomDataset = guppyConfig.loomDataset;
  const loomProjectIds = guppyConfig.loomProjectIds;
  const loomIdentity = loomDataset
    ? ({ selector: loomDataset, projectIds: loomProjectIds } as const)
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
        error:
          error instanceof Error ? error.message : 'Unsupported Loom filter',
      };
    }
  }, [cohortFilters]);
  const {
    data: selectedDataset,
    isError: isSelectedDatasetError,
    isLoading: isSelectedDatasetLoading,
  } = useGetLoomDatasetBySelectorQuery(
    loomIdentity ?? skipToken,
  );
  const activeDataset = selectedDataset;

  const chartKeys = useDeepCompareMemo(
    () => [...Object.keys(chartsSection?.charts ?? {}), ...Object.keys(charts)],
    [chartsSection?.charts, charts],
  );
  // Facets and charts use the same selector and active filters. Batch them
  // into one GraphQL document; Loom executes these as published ClickHouse
  // aggregates, not an on-the-fly dataframe build.
  const aggregationFields = useDeepCompareMemo(
    () => [...new Set([...fields, ...chartKeys])],
    [fields, chartKeys],
  );
  const {
    data,
    isSuccess,
    isFetching: isAggsQueryFetching,
    isError: isAggsQueryError,
  } = useGetLoomAggregationsQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          fields: aggregationFields,
          filters: loomFilters.filters,
        }
      : skipToken,
    {
      skip:
        aggregationFields.length === 0 || !loomIdentity || !!loomFilters.error,
    },
  );
  const chartData = data;
  const isChartSuccess = isSuccess;

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
  } = useGetLoomCountQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          filters: loomFilters.filters,
          operation: 'COUNT',
        }
      : skipToken,
    { skip: !loomIdentity || !!loomFilters.error },
  );

  if (!loomIdentity) {
    return (
      <ErrorCard
        message={`No published Loom dataset selector is available for Explorer output ${index}`}
      />
    );
  }
  if (loomFilters.error) {
    return <ErrorCard message={loomFilters.error} />;
  }
  if (isSelectedDatasetError) {
    return (
      <ErrorCard message="Unable to discover the authorized Loom dataset" />
    );
  }
  if (isSelectedDatasetLoading) {
    return (
      <div className="flex items-center justify-center w-full h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!activeDataset) {
    return (
      <ErrorCard message="No authorized Loom dataset is available for this Explorer tab" />
    );
  }
  if (activeDataset.state !== 'READY') {
    return (
      <ErrorCard
        message={`Loom dataset is ${activeDataset.state.toLowerCase()}${activeDataset.error ? `: ${activeDataset.error}` : ''}`}
      />
    );
  }
  if (isCountsError || isAggsQueryError) {
    return <ErrorCard message="Unable to fetch data from server" />;
  }

  // Show loading indicator if we don't have facet definitions yet but we're fetching
  if (
    Object.keys(facetDefinitions).length === 0 &&
    (isAggsQueryFetching || isCountsFetching)
  ) {
    return (
      <div className="flex items-center justify-center w-full h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="relative mt-3 flex w-full flex-col bg-base-lightest px-4">
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
          className="flex flex-col pl-4 md:w-3/4 lg:w-4/5"
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
              loomDataset={loomDataset}
              loomProjectIds={loomProjectIds}
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
                loomDataset={loomDataset}
                loomProjectIds={loomProjectIds}
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
