import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse, extractData } from './tools';
import { ErrorCard, PieChart } from '@gen3/frontend';
import { Stack, LoadingOverlay, Title } from '@mantine/core';

export const SpecimenAggregationCountsChart = ({
  aggField,
  title,
  identifiers,
}: {
  aggField: string;
  title: string;
  identifiers: string[];
}) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              _aggregation{
                file (filter: $filter, accessibility: all) {
                 	${aggField}{
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
    ? extractData(data, 'file', aggField)
    : [];
  // Not sure what the total arg is doing
  return (
    resData &&
    resData.length !== 0 && (
      <div className="flex flex-col">
        <Title order={4} className="text-center pt-5">
          {title}
        </Title>
        <div className="flex-grow">
          <Stack>
            <LoadingOverlay visible={isLoading} />
            <PieChart total={1} data={resData} />
          </Stack>
        </div>
      </div>
    )
  );
};
