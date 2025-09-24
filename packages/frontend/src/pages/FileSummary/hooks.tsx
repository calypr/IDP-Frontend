import { useMemo } from 'react';
import isQueryResponse from '../../features/CohortBuilder/ExplorerTable/ExploreTableDetails/QueryRowDetailsPanel';
import { SummaryTableColumn } from '../../features/CohortBuilder/ExplorerTable/types';
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
      document_reference(filter: $filter, accessibility: all, first: 10000, sort: [{document_reference_size: "desc"}]){
        document_reference_source_path
        document_reference_size
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
      const project_data = extractData(data, 'document_reference', '');
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
        document_reference(filter: $filter){
          document_reference_contentType{
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
      return extractData(
        data,
        'document_reference',
        'document_reference_contentType',
      );
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
      EQ: { project_id: project },
    },
  ];

  if (category !== '') {
    filters.push({
      EQ: {
        document_reference_contentType:
          String(category).charAt(0).toLowerCase() + String(category).slice(1),
      },
    });
  } else {
    filters.push({
      AND: [
        { GTE: { document_reference_size: file_range[0] } },
        { LT: { document_reference_size: file_range[1] } },
      ],
    });
  }

  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
  		_aggregation{
        document_reference(filter: $filter){
          _totalCount
        }
      }
      document_reference(filter: $filter, accessibility: all, first: 10000, sort: [{document_reference_size: "desc"}]){
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
        document_reference(nestedAggFields: $nestedAggFields) {
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
        termsFields: ['document_reference_size'],
      },
    },
  });

  const cachedData = useMemo(() => {
    if (data) {
      const project_data = extractData(
        data,
        'document_reference',
        'project_id',
      );
      const result: any = project_data.map((project) => {
        const totalSum = project.termsFields.reduce(
          (fieldSum: number, field: any) => {
            return (
              fieldSum +
              field.terms.reduce((termSum: number, term: any) => {
                const key = term.key ? parseFloat(term.key) : 0; // Convert key to number
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
