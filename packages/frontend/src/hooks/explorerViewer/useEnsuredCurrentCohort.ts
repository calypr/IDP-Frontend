import { useEffect } from 'react';
import {
  selectAllCohorts,
  selectCurrentCohort,
  setCurrentCohortId,
  useCoreDispatch,
  useCoreSelector,
} from '@gen3/core';

/** Repairs the selected-cohort pointer when the external Redux store changes. */
export const useEnsuredCurrentCohort = () => {
  const dispatch = useCoreDispatch();
  const allCohorts = useCoreSelector(selectAllCohorts);
  const currentCohort = useCoreSelector(selectCurrentCohort);

  useEffect(() => {
    if (!currentCohort && allCohorts[0]) {
      dispatch(setCurrentCohortId(allCohorts[0].id));
    }
  }, [allCohorts, currentCohort, dispatch]);

  return { allCohorts, currentCohort };
};
