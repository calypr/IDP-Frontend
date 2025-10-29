import { useMemo } from 'react';
import {
  buildClientSchema,
  IntrospectionQuery,
  getIntrospectionQuery,
} from 'graphql';
import { useGeneralGQLQuery, useGetConfigListQuery } from '@gen3/core';

// Define ConfigResponse to match @gen3/core's type
interface ConfigResponse {
  success: boolean;
  data?: any; // Matches @gen3/core's optional data
  error?: string;
}

export interface SelectOption {
  value: string;
  label: string;
}

interface ConfigListHookResult {
  configList: SelectOption[];
  configListData: ConfigResponse | undefined;
  configListIsLoading: boolean;
  configListError: any; // Still using any for error to avoid type conflicts
  refetchConfigList: () => void;
}

export const useConfigList = (): ConfigListHookResult => {
  const {
    data: configListData,
    isLoading: configListIsLoading,
    error: configListError,
    refetch: refetchConfigList,
  } = useGetConfigListQuery();

  // Transform config list for Mantine Select component
  const configList = useMemo(() => {
    if (!configListData?.data) return [];
    return Array.isArray(configListData.data)
      ? configListData.data.map((config: string) => ({
          value: config,
          label: config,
        }))
      : [];
  }, [configListData]);

  return {
    configList,
    configListData,
    configListIsLoading,
    configListError,
    refetchConfigList,
  };
};

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
