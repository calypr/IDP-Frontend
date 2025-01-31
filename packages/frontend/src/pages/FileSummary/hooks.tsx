import { useMemo } from 'react';
import { isQueryResponse } from '../../features/CohortBuilder/ExplorerTable/ExploreTableDetails/QueryRowDetailsPanel';
import { SummaryTableColumn } from '../../features/CohortBuilder';
import { useGeneralGQLQuery } from '@gen3/core';
import { extractData } from '../../utils/extractdata';
import { binDataWithCustomBoundaries } from './bindata';
import { type Filter } from './types';

export const useFileAggsQuery = (
  slicePoints: number[],
  selected_project: string,
) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
      file(filter: $filter, accessibility: all, first: 10000, sort: [{size: "desc"}]){
        source_path
        size
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              project_id: [selected_project],
            },
          },
        ],
      },
    },
  });

  const cachedfileData = useMemo(() => {
    if (data) {
      const project_data = isQueryResponse(data)
        ? extractData(data, 'file', '')
        : [];
      return binDataWithCustomBoundaries(project_data, slicePoints);
    }
    return [];
  }, [data]);

  return { fdata: cachedfileData, fisLoading: isLoading, fisError: isError };
};

export const useFileTypesHistogramQuery = (project: string) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
  		_aggregation{
        file(filter: $filter){
          contentType{
            histogram{
              key
              count
            }
          }
        }
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              project_id: [project],
            },
          },
        ],
      },
    },
  });

  const cachedfileData = useMemo(() => {
    if (data) {
      return isQueryResponse(data)
        ? extractData(data, 'file', 'contentType')
        : [];
    }
    return [];
  }, [data]);

  return { ftdata: cachedfileData, ftisLoading: isLoading, ftisError: isError };
};

export const useFilesFromBinQuery = (
  project: string,
  file_range: number[],
  config: Record<string, SummaryTableColumn>,
  category: string,
) => {
  const filters: Filter[] = [
    {
      type: 'project',
      EQ: { project_id: project },
    },
  ];
  if (category !== '') {
    filters.push({
      type: 'content',
      EQ: {
        contentType:
          String(category).charAt(0).toLowerCase() + String(category).slice(1),
      },
    });
  } else {
    filters.push({
      type: 'range',
      AND: [{ GTE: { size: file_range[0] } }, { LT: { size: file_range[1] } }],
    });
  }

  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
  		_aggregation{
        file(filter: $filter){
          _totalCount
        }
      }
      file(filter: $filter, accessibility: all, first: 10000, sort: [{size: "desc"}]){
        ${Object.keys(config).join('\n')}
      }
    }`,
    variables: { filter: { AND: filters } },
  });

  const cachedfileData = useMemo(() => {
    if (data) {
      return data;
    }
  }, [data]);
  return {
    fbindata: cachedfileData,
    fbinisLoading: isLoading,
    fbinisError: isError,
  };
};

export const useProjectsQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($nestedAggFields: JSON) {
      _aggregation {
        file(nestedAggFields: $nestedAggFields) {
          project_id {
            histogram {
              key
              termsFields {
                field
                terms {
                  key
                  count
                }
              }
            }
          }
        }
      }
    }`,
    variables: {
      nestedAggFields: {
        termsFields: ['size'],
      },
    },
  });

  const cachedData = useMemo(() => {
    if (data) {
      const project_data = isQueryResponse(data)
        ? extractData(data, 'file', 'project_id')
        : [];
      const result: any = project_data.map((project) => {
        const totalSum = project.termsFields.reduce(
          (fieldSum: number, field: any) => {
            return (
              fieldSum +
              field.terms.reduce((termSum: number, term: any) => {
                const key = parseFloat(term.key); // Convert key to number
                return termSum + key * term.count;
              }, 0)
            );
          },
          0,
        );

        return { key: project.key, sum: totalSum };
      });
      return result;
    }
    return [];
  }, [data]);

  return { data: cachedData, isLoading, isError };
};
