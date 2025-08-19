import { useGeneralGQLQuery } from '@gen3/core';
import { useMemo } from 'react';

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
      return typedData.data?._aggregation?.file?._totalCount ?? -1;
    }
    return -1;
  }, [data]);

  return { data: cachedCounts, isLoading: isLoading, isError: isError };
};
