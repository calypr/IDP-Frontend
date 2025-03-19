import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse, extractData, useGroupToSpecimenMapping } from './tools';
import { ErrorCard, PieChart } from '@gen3/frontend';
import { Stack, LoadingOverlay, Title } from '@mantine/core';
import { useMemo } from 'react';

export const SpecimenAggregationCountsChart = ({
  aggField, // top-level file count aggregation
  countField, // file count sub-aggregation
  title,
  ids,
}: {
  aggField: string;
  countField: string;
  title: string;
  ids: string[];
}) => {

  // get all group ids containing a list of specimen ids
  const {data: groupData, isLoading: groupIsLoading, isError: groupIsError} = useGroupToSpecimenMapping(ids);
  const groupIds = Object.keys(groupData);
  
  // get a count of files such that
  // 1) counts are grouped by `aggField`
  // 2) and sub-aggregated by `countField`
  // 3) aggregate files associated with the patient's specimen ids + group ids
  // eg get file counts by sample family id (countField) grouped by assay (aggField)
  // see Guppy docs
  // https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#5-sub-aggregations
  // https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#combine-into-advanced-filters
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($nestedAggFields: JSON $filter: JSON) {
              _aggregation {
                file (nestedAggFields: $nestedAggFields, filter: $filter, accessibility: all) {
                  ${aggField}{
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
      filter: {
        AND: [
        {
          OR: [
            {
              IN: {
                specimen_id: ids
              }
            },
            {
              IN: {
                group_id: groupIds
              }
            }
          ]
        }
        ],
      },
      nestedAggFields: {
        termsFields: [
          countField
        ]
      },
    },
  });
  
  // convert Guppy response into format needed for PieChart component
  const pieChartData = useMemo(() => {
    if (!data) return [];

    const resData = isQueryResponse(data)
    ? extractData(data, 'file', aggField)
    : [];

    return resData.map(d => ({
      'key': d.key,
      'count': d.termsFields[0].terms.length,
    }));
  }, [data, aggField]);

  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }
  
  return (
    pieChartData &&
    pieChartData.length !== 0 && (
      <div className="flex flex-col">
        <Title order={4} className="text-center pt-5">
          {title}
        </Title>
        <div className="flex-grow">
          <Stack>
            <LoadingOverlay visible={isLoading} />
            <PieChart total={1} data={pieChartData} />
          </Stack>
        </div>
      </div>
    )
  );
};
