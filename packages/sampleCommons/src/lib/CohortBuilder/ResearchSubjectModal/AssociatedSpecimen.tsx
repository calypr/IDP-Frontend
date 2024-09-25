import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse, extractData } from './tools';
import { ErrorCard, PieChart } from '@gen3/frontend';
import { Stack, LoadingOverlay } from '@mantine/core';

export const SpecimenAggregationCountsChart = ({
  identifiers,
}: {
  identifiers: string[];
}) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              _aggregation{
                file (filter: $filter, accessibility: all) {
                 	product_notes_project_id{
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
              specimen_identifier: identifiers,
            },
          },
        ],
      },
    },
  });

  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }
  const resData = isQueryResponse(data)
    ? extractData(data, 'file', 'product_notes_project_id')
    : [];
  // Not sure what the total arg is doing
  return (
    <Stack>
      <LoadingOverlay visible={isLoading} />
      {resData && <PieChart total={1} data={resData} />}
    </Stack>
  );
};
