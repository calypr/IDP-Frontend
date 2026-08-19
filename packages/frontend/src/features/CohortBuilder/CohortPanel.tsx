import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  buildLoomFacetPlan,
  LoomFacetCache,
  loomFacetCacheKey,
  LoomTableRenderResponse,
  selectIndexFilters,
  selectSharedFilters,
  useCoreSelector,
  useGetLoomCountQuery,
  useGetLoomDatasetBySelectorQuery,
  useGetLoomRichAggregationsQuery,
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
import {
  hasUsableFilterConfiguration,
  normalizeCohortPanelForDataset,
} from './runtimeConfiguration';

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
  const loomIdentity = useMemo(
    () =>
      loomDataset
        ? ({ selector: loomDataset, projectIds: loomProjectIds } as const)
        : null,
    [loomDataset, loomProjectIds],
  );
  const usesTableRender = table?.enabled === true;
  const {
    data: fallbackDataset,
    isError: isFallbackDatasetError,
    isLoading: isFallbackDatasetLoading,
  } = useGetLoomDatasetBySelectorQuery(loomIdentity ?? skipToken, {
    skip: usesTableRender || !loomIdentity,
  });
  const [tableRender, setTableRender] = useState<LoomTableRenderResponse | null>(
    null,
  );
  const [acceptedRenderSignature, setAcceptedRenderSignature] = useState('');
  const renderSignatureRef = useRef('');
  const [tableRenderState, setTableRenderState] = useState({
    isFetching: false,
    isError: false,
  });
  const facetCache = useRef(new LoomFacetCache());
  const onTableRender = useCallback(
    (response: LoomTableRenderResponse, requestSignature?: string) => {
      const currentSignature = renderSignatureRef.current;
      if (requestSignature && requestSignature !== currentSignature) return;
      setTableRender((current) => ({
        ...response,
        facets: response.facets ?? current?.facets,
      }));
      setAcceptedRenderSignature(requestSignature ?? currentSignature);
    },
    [],
  );
  const onTableRenderState = useCallback(
    (state: { isFetching: boolean; isError: boolean }) =>
      setTableRenderState(state),
    [],
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
  const activeDataset = tableRender?.materialization ?? fallbackDataset ?? null;
  const runtimePanel = useMemo(
    () =>
      normalizeCohortPanelForDataset(
        {
          guppyConfig,
          tabTitle,
          chartsSection,
          charts,
          filters,
          table,
          dropdowns,
          buttons,
          loginForDownload,
        },
        activeDataset?.columns,
      ),
    [
      activeDataset?.columns,
      buttons,
      charts,
      chartsSection,
      dropdowns,
      filters,
      guppyConfig,
      loginForDownload,
      tabTitle,
      table,
    ],
  );
  const runtimeGuppyConfig = runtimePanel.guppyConfig;
  const runtimeFilters = runtimePanel.filters;
  const hasConfiguredFilters = hasUsableFilterConfiguration(runtimeFilters);
  const hasActiveFilters = Object.keys(cohortFilters.root ?? {}).length > 0;
  const runtimeCharts = runtimePanel.charts;
  const runtimeChartsSection = runtimePanel.chartsSection;
  const runtimeTable = runtimePanel.table;
  const fields = useMemo(
    () => getAllFieldsFromFilterConfigs(runtimeFilters?.tabs ?? []),
    [runtimeFilters?.tabs],
  );
  const effectiveLoomFilters = useMemo(() => {
    if (!activeDataset) return loomFilters;
    const available = new Set(
      activeDataset.columns.map((column) => column.name),
    );
    return {
      ...loomFilters,
      filters: loomFilters.filters.filter((filter) =>
        available.has(filter.column),
      ),
    };
  }, [activeDataset, loomFilters]);

  const chartKeys = useDeepCompareMemo(
    () => [
      ...Object.keys(runtimeChartsSection?.charts ?? {}),
      ...Object.keys(runtimeCharts ?? {}),
    ],
    [runtimeChartsSection?.charts, runtimeCharts],
  );
  const [demandedFacetFields, setDemandedFacetFields] = useState<string[]>([]);
  const demandFacet = useCallback((field: string) => {
    setDemandedFacetFields((current) =>
      current.includes(field) ? current : [...current, field],
    );
  }, []);
  // Facets and charts use the same selector and active filters. Batch them
  // into one GraphQL document; Loom executes these as published ClickHouse
  // aggregates, not an on-the-fly dataframe build.
  const aggregationFields = useDeepCompareMemo(
    () => [...new Set([...chartKeys, ...demandedFacetFields, ...fields])],
    [demandedFacetFields, fields, chartKeys],
  );
  const facetConfig = useMemo(
    () =>
      (runtimeFilters?.tabs ?? []).reduce(
        (acc: Record<string, FacetDefinition>, tab) => ({
          ...acc,
          ...tab.fieldsConfig,
        }),
        {},
      ),
    [runtimeFilters?.tabs],
  );
  const facetPlan = useDeepCompareMemo(() => {
    const chartFieldSet = new Set(chartKeys);
    return buildLoomFacetPlan(
      aggregationFields.map((field) => {
        const config = facetConfig[field];
        const range = config?.range;
        const span =
          range && Number.isFinite(range.maximum - range.minimum)
            ? range.maximum - range.minimum
            : 0;
        const facetType = config?.type;
        const isRange =
          facetType === 'range' ||
          facetType === 'age' ||
          facetType === 'year' ||
          facetType === 'years' ||
          facetType === 'days' ||
          facetType === 'percent' ||
          facetType === 'datetime';
        const isDateRange = facetType === 'datetime';
        return {
          field,
          facetType,
          demand:
            chartFieldSet.has(field) || demandedFacetFields.includes(field)
              ? 'eager'
              : undefined,
          kind: isDateRange
            ? 'DATE_HISTOGRAM'
            : isRange
              ? 'HISTOGRAM'
              : 'TERMS',
          ...(isDateRange
            ? { dateInterval: 86400 }
            : isRange
              ? {
                  interval:
                    facetType === 'year' || facetType === 'years'
                      ? 1
                      : Math.max(1, span > 0 ? span / 20 : 1),
                }
            : {}),
          size: 50,
          excludeSelfFilter: !chartFieldSet.has(field),
        };
      }),
    );
  }, [aggregationFields, chartKeys, demandedFacetFields, facetConfig]);
  const {
    data: fallbackRichAggregations,
    isError: isFallbackAggregationsError,
  } = useGetLoomRichAggregationsQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          specs: facetPlan.specs,
          filters: effectiveLoomFilters.filters,
        }
      : skipToken,
    {
      skip:
        usesTableRender ||
        !loomIdentity ||
        !fallbackDataset ||
        facetPlan.specs.length === 0 ||
        !!effectiveLoomFilters.error,
    },
  );
  const renderSignature = useMemo(
    () =>
      JSON.stringify({
        identity: loomIdentity,
        filters: effectiveLoomFilters.filters,
        facets: facetPlan.specs,
      }),
    [effectiveLoomFilters.filters, facetPlan.specs, loomIdentity],
  );
  renderSignatureRef.current = renderSignature;
  useEffect(() => {
    setTableRender(null);
    setTableRenderState({ isFetching: false, isError: false });
  }, [renderSignature]);
  useEffect(() => {
    if (
      !loomIdentity ||
      !tableRender?.facets ||
      acceptedRenderSignature !== renderSignature
    )
      return;
    Object.values(tableRender.facets.aggregations).forEach((aggregation) => {
      const spec = facetPlan.specs.find(
        (candidate) => candidate.name === aggregation.name,
      );
      if (spec) {
        facetCache.current.set(
          loomFacetCacheKey({
            identity: loomIdentity,
            revision: activeDataset?.revision,
            spec,
            filters: effectiveLoomFilters.filters,
          }),
          aggregation,
        );
      }
    });
  }, [
    activeDataset?.revision,
    effectiveLoomFilters.filters,
    facetPlan.specs,
    loomIdentity,
    acceptedRenderSignature,
    renderSignature,
    tableRender,
  ]);
  const isAggsQueryError = usesTableRender
    ? tableRenderState.isError
    : isFallbackAggregationsError;
  const facetResponse = usesTableRender
    ? acceptedRenderSignature === renderSignature
      ? tableRender?.facets
      : undefined
    : fallbackRichAggregations;
  const data = useDeepCompareMemo(() => {
    return facetPlan.specs.reduce((acc, spec) => {
        const aggregation =
          facetResponse?.aggregations[spec.name] ??
          (loomIdentity
            ? facetCache.current.get(
                loomFacetCacheKey({
                  identity: loomIdentity,
                  revision: activeDataset?.revision,
                  spec,
                  filters: effectiveLoomFilters.filters,
                }),
              )
            : undefined);
        if (aggregation) acc[spec.column] = aggregation.data;
        return acc;
      },
      {} as AggregationsData,
    );
  }, [
    activeDataset?.revision,
    effectiveLoomFilters.filters,
    facetResponse,
    facetPlan.specs,
    loomIdentity,
    acceptedRenderSignature,
    renderSignature,
    tableRender,
  ]);
  const isSuccess = Boolean(data && Object.keys(data).length > 0);
  const facetMetadata = useDeepCompareMemo(() => {
    if (!facetResponse) return {};
    return Object.values(facetResponse.aggregations).reduce(
      (acc, aggregation) => {
        const spec = facetPlan.specs.find(
          (candidate) => candidate.name === aggregation.name,
        );
        if (spec) {
          acc[spec.column] = {
            missingCount: aggregation.missingCount,
            truncated: aggregation.truncated,
            isPartial: aggregation.truncated || aggregation.missingCount > 0,
          };
        }
        return acc;
      },
      {} as Record<
        string,
        { missingCount: number; truncated: boolean; isPartial: boolean }
      >,
    );
  }, [
    facetPlan.specs,
    facetResponse,
  ]);
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
        isSuccess: isSuccess && Boolean(data?.[field]),
        ...facetMetadata[field],
      };
    },
    [cohortFilters.root, data, facetMetadata, isSuccess],
  );

  const getRangeFacetData = useDeepCompareCallback(
    (field: string) => ({
      data: processRangeData(data?.[field]),
      filters: extractRangeValues(cohortFilters.root[field]),
      isSuccess: isSuccess && Boolean(data?.[field]),
      ...facetMetadata[field],
    }),
    [cohortFilters.root, data, facetMetadata, isSuccess],
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
          demandFacet,
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
          useFilterExpanded: partial(useFilterExpandedState, index),
          useToggleExpandFilter: partial(useToggleExpandFilter, index),
          demandFacet,
          useFieldNameToTitle,
          useTotalCounts: undefined,
        },
        multiselect: {
          useGetFacetData: getEnumFacetData,
          useUpdateFacetFilters: partial(useUpdateFilters, index),
          useGetFacetFilters: partial(useGetFacetFilters, index),
          useClearFilter: partial(useClearFilters, index),
          useFilterExpanded: partial(useFilterExpandedState, index),
          useToggleExpandFilter: partial(useToggleExpandFilter, index),
          demandFacet,
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
          demandFacet,
          useFieldNameToTitle,
          useTotalCounts: undefined,
        },
      };
    }, [demandFacet, getEnumFacetData, getRangeFacetData, index]);

  useDeepCompareEffect(() => {
    if (isSuccess || fields.length > 0) {
      const configFacetDefs = facetConfig;
      const configuredFacetDefs = fields.reduce(
        (acc: Record<string, FacetDefinition>, field) => {
          const configured = configFacetDefs[field] ?? {};
          acc[field] = {
            ...configured,
            field,
            dataField: configured.dataField ?? field.split('.').at(-1) ?? field,
            type: configured.type ?? 'enum',
            index,
            label: configured.label ?? field,
          } as FacetDefinition;
          return acc;
        },
        {},
      );
      const classifiedFacetDefs = classifyFacets(
        data ?? {},
        index,
        runtimeGuppyConfig?.fieldMapping ?? [],
        configFacetDefs ?? {},
        sharedFiltersMap,
      );
      const facetDefs = { ...configuredFacetDefs, ...classifiedFacetDefs };
      setFacetDefinitions(facetDefs);

      const chartDefinitions =
        runtimeChartsSection?.charts ?? runtimeCharts ?? {};
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
    runtimeGuppyConfig.fieldMapping,
    runtimeCharts,
    runtimeChartsSection,
    runtimeFilters?.tabs,
    sharedFiltersMap,
    fields,
    facetConfig,
  ]);

  const columnTitles = useMemo(
    () =>
      runtimeTable?.columns
        ? Object.entries(runtimeTable.columns).reduce(
            (acc, [field, column]) => ({
              ...acc,
              [field]: column.title,
            }),
            {},
          )
        : {},
    [runtimeTable?.columns],
  );

  const {
    data: fallbackCount,
    isFetching: isFallbackCountFetching,
    isError: isFallbackCountError,
  } = useGetLoomCountQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          filters: effectiveLoomFilters.filters,
          operation: 'COUNT',
        }
      : skipToken,
    {
      skip:
        usesTableRender ||
        !loomIdentity ||
        !fallbackDataset ||
        !!effectiveLoomFilters.error,
    },
  );
  const counts = usesTableRender
    ? tableRender?.totalCount ?? activeDataset?.rowCount
    : fallbackCount ?? activeDataset?.rowCount;
  const isCountsFetching = usesTableRender
    ? tableRenderState.isFetching
    : isFallbackCountFetching;
  const isCountsError = usesTableRender
    ? tableRenderState.isError
    : isFallbackCountError;

  if (!loomIdentity) {
    return (
      <ErrorCard
        message={`No published Loom dataset selector is available for Explorer output ${index}`}
      />
    );
  }
  if (effectiveLoomFilters.error) {
    return <ErrorCard message={effectiveLoomFilters.error} />;
  }
  if (!usesTableRender && isFallbackDatasetError) {
    return <ErrorCard message="Unable to discover the authorized Loom dataset" />;
  }
  if (!usesTableRender && isFallbackDatasetLoading) {
    return (
      <div className="flex items-center justify-center w-full h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!usesTableRender && !activeDataset) {
    return (
      <ErrorCard message="No authorized Loom dataset is available for this Explorer tab" />
    );
  }
  if (activeDataset && activeDataset.state !== 'READY') {
    return (
      <ErrorCard
        message={`Loom dataset is ${activeDataset.state.toLowerCase()}${activeDataset.error ? `: ${activeDataset.error}` : ''}`}
      />
    );
  }
  if (isCountsError || isAggsQueryError) {
    return <ErrorCard message="Unable to fetch data from server" />;
  }

  return (
    <div className="relative mt-3 flex w-full flex-col bg-base-lightest px-4">
      {/* Main flex container for filters and content */}
      <div className="flex w-full">
        {/* Left panel for filters */}
        {hasConfiguredFilters && runtimeFilters && (
          <div
            id="cohort-builder-filters"
            className="flex-shrink-0 md:w-1/4 lg:w-1/5"
          >
            <DropdownPanel
              index={index}
              filters={runtimeFilters}
              tabTitle={tabTitle}
              facetDefinitions={facetDefinitions}
              facetDataHooks={facetDataHooks}
              onAccessChange={setAccessLevel}
              accessLevel={accessLevel}
              showAccessLevel={showAccessLevel}
            />
          </div>
        )}

        {/* Right panel for query expression + content */}
        <div
          id="cohort-builder-content"
          className={`flex flex-col ${
            hasConfiguredFilters ? 'pl-4 md:w-3/4 lg:w-4/5' : 'w-full'
          }`}
        >
          {/* Put QueryExpression at the top of content panel */}
          {hasConfiguredFilters && hasActiveFilters && (
            <div className="mb-2">
              <QueryExpression index={index} columnTitles={columnTitles} />
            </div>
          )}

          <div className="flex justify-between my-2">
            <DownloadsPanel
              dropdowns={defaultDropdowns}
              buttons={defaultButtons}
              loginForDownload={loginForDownload}
              index={index}
              totalCount={counts ?? 0}
                fields={runtimeTable?.fields ?? []}
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

          {runtimeTable?.enabled && (
            <div className="mt-2 flex flex-col">
              <ExplorerTable
                index={index}
                loomDataset={loomDataset}
                loomProjectIds={loomProjectIds}
                loomActiveDataset={activeDataset}
                facetSpecs={facetPlan.specs}
                tableRenderSignature={renderSignature}
                onTableRender={onTableRender}
                onTableRenderState={onTableRenderState}
                tableConfig={runtimeTable}
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
