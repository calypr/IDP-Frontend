import React, { useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useRouter } from 'next/router';
import { Stack } from '@mantine/core';
import {
  Accessibility,
  AggregationsData,
  buildLoomFacetPlan,
  CombineMode,
  convertFilterSetToLoomFilters,
  CoreState,
  extractEnumFilterValue,
  FacetDefinition,
  FacetType,
  isIntersection,
  LoomDatasetSelector,
  selectIndexFilters,
  useCoreSelector,
  useGetLoomRichAggregationsQuery,
} from '@gen3/core';
import FacetTabs from '../../components/facets/FacetTabs';
import { ErrorCard } from '../../components/MessageCards';
import {
  classifyFacets,
  extractRangeValues,
  FacetDataHooks,
  processBucketData,
  processRangeData,
  removeIntersectionFromEnum,
  useGetFacetFilters,
  useUpdateFilters,
} from '../../components/facets';
import { QueryOptions } from '../../components/facets/types';
import { useDeepCompareCallback, useDeepCompareMemo } from 'use-deep-compare';
import { partial } from 'lodash';
import {
  useClearFilters,
  useFieldNameToTitle,
} from '../../components/facets/hooks';
import {
  useCohortFilterCombineState,
  useFilterExpandedState,
  useSetCohortFilterCombineState,
  useToggleExpandFilter,
} from './hooks';

export interface CohortBuilderTabCategoryConfig {
  readonly label: string;
  readonly queryOptions: {
    readonly indexType: string;
  };
  readonly facets: ReadonlyArray<string>;
}

export type TabbedCohortBuilderFacetConfig = Record<
  string,
  CohortBuilderTabCategoryConfig
>;

const useCustomFacets = () => ({
  data: [],
  isSuccess: true,
});

const useAddCustomFilter = (x: string) => {};

export const calculateStickyHeaderHeight = (): number => {
  const globalHeader = document.querySelector('#global-header');
  const contextBar = document.querySelector('#context-bar');
  return (
    (globalHeader?.getBoundingClientRect()?.height || 0) +
    (contextBar?.getBoundingClientRect()?.height || 0)
  );
};

export interface TabbedCohortBuilderConfiguration {
  tabsConfiguration: TabbedCohortBuilderFacetConfig;
  index: string;
  loomDataset?: LoomDatasetSelector;
  loomProjectIds?: ReadonlyArray<string>;
}

const TabbedCohortBuilder = ({
  index,
  tabsConfiguration,
  loomDataset,
  loomProjectIds,
}: TabbedCohortBuilderConfiguration) => {
  const tabsConfig = tabsConfiguration;
  const cohortBuilderFilters = [
    ...Object.values(tabsConfiguration).reduce(
      (filters: string[], category) => {
        return [...filters, ...category.facets];
      },
      [] as string[],
    ),
  ];

  const router = useRouter();
  const routerTab =
    typeof router?.query?.tab === 'string' ? router.query.tab : null;
  const defaultTab = routerTab ?? Object.keys(tabsConfig)[0] ?? null;
  const [tabSelection, setTabSelection] = useState<{
    readonly routerTab: string | null;
    readonly value: string | null;
  }>({ routerTab, value: defaultTab });
  const activeTab =
    tabSelection.routerTab === routerTab ? tabSelection.value : defaultTab;
  const selectTab = (value: string | null) => {
    setTabSelection({ routerTab, value });
    if (value === routerTab) return;
    const query = { ...router.query };
    if (value) query.tab = value;
    else delete query.tab;
    void router.push({ query }, undefined, { scroll: false });
  };
  const [accessLevel, setAccessLevel] = useState<Accessibility>(
    Accessibility.ALL,
  );

  const cohortFilters = useCoreSelector((state: CoreState) =>
    selectIndexFilters(state, index),
  );
  const loomIdentity = loomDataset
    ? ({ selector: loomDataset, projectIds: loomProjectIds } as const)
    : null;
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
  const activeTabFacets = useMemo(
    () => (activeTab ? (tabsConfig[activeTab]?.facets ?? []) : []),
    [activeTab, tabsConfig],
  );
  const facetPlan = useMemo(
    () =>
      buildLoomFacetPlan(
        activeTabFacets.map((field) => ({
          field,
          facetType: 'enum',
          excludeSelfFilter: true,
        })),
      ),
    [activeTabFacets],
  );
  const {
    data: richAggregationResponse,
    isSuccess: isAggsSuccess,
    isFetching: isAggsQueryFetching,
    isError: isAggsQueryError,
  } = useGetLoomRichAggregationsQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          specs: facetPlan.specs,
          filters: loomFilters.filters,
        }
      : skipToken,
    {
      skip:
        !loomIdentity || !!loomFilters.error || facetPlan.specs.length === 0,
    },
  );
  const isSuccess = isAggsSuccess && Boolean(richAggregationResponse);
  const data = useMemo<AggregationsData | undefined>(() => {
    if (!richAggregationResponse) return undefined;
    return Object.values(richAggregationResponse.aggregations).reduce(
      (acc, aggregation) => {
        const spec = facetPlan.specs.find(
          (candidate) => candidate.name === aggregation.name,
        );
        if (spec) acc[spec.column] = aggregation.data;
        return acc;
      },
      {} as AggregationsData,
    );
  }, [facetPlan.specs, richAggregationResponse]);
  const facetMetadata = useMemo(() => {
    if (!richAggregationResponse) return {};
    return Object.values(richAggregationResponse.aggregations).reduce(
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
  }, [facetPlan.specs, richAggregationResponse]);

  const facetDefinitions = useMemo(
    () => (isSuccess && data ? classifyFacets(data, index) : {}),
    [data, index, isSuccess],
  );

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
        combineMode: combineMode,
        isSuccess: isSuccess,
        isFetching: isAggsQueryFetching,
        isError: isAggsQueryError,
        ...facetMetadata[field],
      };
    },
    [cohortFilters, data, facetMetadata, isSuccess],
  );

  const getRangeFacetData = useDeepCompareCallback(
    (field: string) => {
      return {
        data: processRangeData(data?.[field]),
        filters: extractRangeValues(cohortFilters.root[field]),
        isSuccess: isSuccess,
        isFetching: isAggsQueryFetching,
        isError: isAggsQueryError,
        ...facetMetadata[field],
      };
    },
    [data, cohortFilters.root, facetMetadata, isSuccess],
  );

  const EnumHookInstances = {
    useGetFacetData: getEnumFacetData,
    useUpdateFacetFilters: partial(useUpdateFilters, index),
    useGetFacetFilters: partial(useGetFacetFilters, index),
    useClearFilter: partial(useClearFilters, index),
    useFilterExpanded: partial(useFilterExpandedState, index),
    useToggleExpandFilter: partial(useToggleExpandFilter, index),
    useGetCombineMode: partial(useCohortFilterCombineState, index),
    useSetCombineMode: partial(useSetCohortFilterCombineState, index),
    useFieldNameToTitle: useFieldNameToTitle,
    useTotalCounts: undefined,
  };

  const RangeHookInstances = {
    useGetFacetData: getRangeFacetData,
    useUpdateFacetFilters: partial(useUpdateFilters, index),
    useGetFacetFilters: partial(useGetFacetFilters, index),
    useClearFilter: partial(useClearFilters, index),
    useFilterExpanded: partial(useFilterExpandedState, index),
    useToggleExpandFilter: partial(useToggleExpandFilter, index),
    useFieldNameToTitle: useFieldNameToTitle,
    useTotalCounts: undefined,
  };

  // Set up the hooks for the facet components to use based on the required index
  const facetDataHooks: Record<FacetType, FacetDataHooks> =
    useDeepCompareMemo(() => {
      return {
        // TODO: see if there a better way to do this
        enum: EnumHookInstances,
        exact: EnumHookInstances,
        multiselect: EnumHookInstances,
        range: RangeHookInstances,
        age: RangeHookInstances,
        year: RangeHookInstances,
        years: RangeHookInstances,
        days: RangeHookInstances,
        percent: RangeHookInstances,
        datetime: RangeHookInstances,
        toggle: RangeHookInstances,
        upload: EnumHookInstances,
      };
    }, [getEnumFacetData, getRangeFacetData, index]);

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
  return (
    <Stack gap="xs" align="stretch" classNames={{ root: 'w-full' }}>
      <FacetTabs
        activeTab={activeTab}
        setActiveTab={selectTab}
        facetDefinitions={facetDefinitions}
        tabsConfig={tabsConfig}
        usedFacets={cohortBuilderFilters}
        hooks={facetDataHooks}
        customFacetHooks={{
          useCustomFacets,
          useAvailableCustomFacets: (
            usedFacets: readonly string[],
            onlyFiltersWithValues: boolean,
            queryOptions?: QueryOptions,
          ) => ({ data: {}, isSuccess: true }),
          useAddCustomFilter: () => (filter: string) => {},
          useRemoveCustomFilter: () => (filter: string) => {},
        }}
        getFacetLabel={() => 'Cases'}
        cardScrollMargin={calculateStickyHeaderHeight()}
        useFieldNameToTitle={useFieldNameToTitle}
      />
    </Stack>
  );
};

export default TabbedCohortBuilder;
