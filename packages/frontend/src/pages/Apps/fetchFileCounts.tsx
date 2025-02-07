import { useGeneralGQLQuery } from '@gen3/core';
import { useMemo } from 'react';
import { isQueryResponse } from '../../features/CohortBuilder/ExplorerTable/ExploreTableDetails/QueryRowDetailsPanel';

export const useFileTotalCountQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query{
              _aggregation {
                file{
                  _totalCount
                }
              }
            }`,
  });

  const cachedCounts = useMemo(() => {
    if (data) {
      const typedData = data as {
        data?: { _aggregation?: { file?: { _totalCount?: number } } };
      };
      return isQueryResponse(data)
        ? (typedData.data?._aggregation?.file?._totalCount ?? -1)
        : -1;
    }
    return -1;
  }, [data]);

  return { data: cachedCounts, isLoading: isLoading, isError: isError };
};
