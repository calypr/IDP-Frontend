import { useGeneralGQLQuery } from '@gen3/core';
import { useMemo } from 'react';

export const useFileTotalCountQuery = () => {
  const { data, isLoading, isError, refetch } = useGeneralGQLQuery({
    query: `query{
              _aggregation {
                document_reference{
                  _totalCount
                }
              }
            }`,
  });

  const cachedCounts = useMemo(() => {
    if (data) {
      const typedData = data as {
        data?: {
          _aggregation?: { document_reference?: { _totalCount?: number } };
        };
      };
      return (
        typedData.data?._aggregation?.document_reference?._totalCount ?? -1
      );
    }
    return -1;
  }, [data]);

  return { data: cachedCounts, isLoading, isError, refetch };
};
