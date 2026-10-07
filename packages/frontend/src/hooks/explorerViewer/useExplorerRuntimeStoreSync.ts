import { useEffect, useRef, useState } from 'react';
import {
  createNewCohort,
  setSharedFilters,
  useCoreDispatch,
  type IndexedFilterSet,
  type SharedFieldMapping,
} from '@gen3/core';
import type { CohortPanelConfiguration } from '../../features/CohortBuilder/types';

/** Applies a published Explorer runtime to the shared cohort Redux store. */
export const useExplorerRuntimeStoreSync = (
  configuration: ReadonlyArray<CohortPanelConfiguration>,
  sharedFiltersMap: SharedFieldMapping | null,
): boolean => {
  const dispatch = useCoreDispatch();
  const identity = JSON.stringify({ configuration, sharedFiltersMap });
  const [appliedIdentity, setAppliedIdentity] = useState('');
  const configurationRef = useRef(configuration);
  const sharedFiltersMapRef = useRef(sharedFiltersMap);
  configurationRef.current = configuration;
  sharedFiltersMapRef.current = sharedFiltersMap;

  useEffect(() => {
    const filters: IndexedFilterSet = {};
    configurationRef.current.forEach((panel) => {
      if (!panel.preFilters) return;
      filters[panel.guppyConfig.dataType] = {
        mode: 'and',
        root: Object.fromEntries(
          Object.entries(panel.preFilters).map(([field, values]) => [
            field,
            {
              operator: 'in',
              field,
              operands: Array.isArray(values) ? values : [values],
            },
          ]),
        ),
      };
    });
    dispatch(setSharedFilters(sharedFiltersMapRef.current ?? {}));
    dispatch(createNewCohort({ filters }));
    setAppliedIdentity(identity);
  }, [dispatch, identity]);

  return appliedIdentity === identity;
};
