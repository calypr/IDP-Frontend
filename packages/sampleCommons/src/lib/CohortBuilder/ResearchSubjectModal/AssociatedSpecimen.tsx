import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse, extractData, useGroupIdsFromMemberIds } from './tools';
import { ErrorCard, PieChart } from '@gen3/frontend';
import { Stack, LoadingOverlay, Title } from '@mantine/core';

export const SpecimenAggregationCountsChart = ({
  aggField,
  title,
  ids,
}: {
  aggField: string;
  title: string;
  ids: string[];
}) => {

  // get all group ids containing a list of specimen ids
  const groupIds = useGroupIdsFromMemberIds(ids);
  
  // get all files associated with the patient's specimen ids + group ids
  // for syntax, see Guppy docs below
  // https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#combine-into-advanced-filters
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
