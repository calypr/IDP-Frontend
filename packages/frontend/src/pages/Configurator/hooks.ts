import { useMemo } from 'react';
import {
  buildClientSchema,
  IntrospectionQuery,
  getIntrospectionQuery,
} from 'graphql';
import { useGeneralGQLQuery } from '@gen3/core';

export const useGetSchemaQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: getIntrospectionQuery(),
  });

  const cachedSchemaData = useMemo(() => {
    if (data) {
      try {
        return buildClientSchema(data.data as IntrospectionQuery);
      } catch (error) {
        console.error('Error building client schema:', error);
        return [];
      }
    }
    return [];
  }, [data]);

  return { sdata: cachedSchemaData, sisLoading: isLoading, sisError: isError };
};
