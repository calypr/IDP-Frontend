import { useCallback } from 'react';
import {
  CoreState,
  type EnumFilterValue,
  extractEnumFilterValue,
  fieldNameToTitle,
  removeCohortFilter,
  selectIndexedFilterByName,
  selectSharedFilters,
  selectShouldShareFilters,
  useCoreDispatch,
  useCoreSelector,
} from '@gen3/core';

import { FromToRange } from './types';
import { extractRangeValues } from './utils';

/**
 * Shared utility hook for removing filters with support for shared filters across indexes
 * This hook checks if shared filters are enabled and removes the filter from all
 * applicable indexes, not just the current one.
 *
 * @param index - the primary index to remove the filter from
 * @returns a callback function that accepts a field name and removes the filter
 */
export const useRemoveFilterWithSharing = (index: string) => {
  const dispatch = useCoreDispatch();

  const shouldShareFilters = useCoreSelector((state) =>
    selectShouldShareFilters(state),
  );
  const sharedFilters = useCoreSelector((state) => selectSharedFilters(state));

  return useCallback(
    (field: string) => {
      if (shouldShareFilters && field in sharedFilters) {
        sharedFilters[field].forEach((x) => {
          dispatch(removeCohortFilter({ index: x.index, field: x.field }));
        });
      } else dispatch(removeCohortFilter({ index, field }));
    },
    [dispatch, index, shouldShareFilters, sharedFilters],
  );
};

// Core ClearFilters hook
export const useClearFilters = (index: string) => {
  return useRemoveFilterWithSharing(index);
};

/**
 * Hook for QueryExpression context that returns a function accepting both index and field.
 * Used by QueryExpression component as a provider for useRemoveFilter context hook.
 * Supports shared filters across indexes.
 *
 * @returns a callback function that accepts index and field, removes filter from all applicable indexes
 */
export const useRemoveFilterWithSharingForContext = () => {
  const dispatch = useCoreDispatch();

  const shouldShareFilters = useCoreSelector((state) =>
    selectShouldShareFilters(state),
  );
  const sharedFilters = useCoreSelector((state) => selectSharedFilters(state));

  return useCallback(
    (index: string, field: string) => {
      if (shouldShareFilters && field in sharedFilters) {
        sharedFilters[field].forEach((x) => {
          dispatch(removeCohortFilter({ index: x.index, field: x.field }));
        });
      } else dispatch(removeCohortFilter({ index, field }));
    },
    [dispatch, shouldShareFilters, sharedFilters],
  );
};

/**
 * Selector for the facet values (if any) from the current cohort
 * @param index - index of filter
 * @param field - field name to find filter for
 * @return Value of Filters or undefined
 */
export const useExtractEnumFilterValues = (
  index: string,
  field: string,
): EnumFilterValue => {
  const filter = useCoreSelector((state: CoreState) =>
    selectIndexedFilterByName(state, index, field),
  );
  return filter ? extractEnumFilterValue(filter) : [];
};

export const useExtractRangeFilterValues = (
  index: string,
  field: string,
): FromToRange<string | number> | undefined => {
  const filter = useCoreSelector((state: CoreState) =>
    selectIndexedFilterByName(state, index, field),
  );
  return filter ? extractRangeValues(filter) : undefined;
};

export const useFieldNameToTitle = () => {
  const fieldToTitle = useCallback((field: string, sections?: number) => {
    return field === 'genes.gene_id'
      ? 'Mutated Gene'
      : fieldNameToTitle(field, sections);
  }, []);

  return fieldToTitle;
};
