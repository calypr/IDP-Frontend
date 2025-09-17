import ErrorCard from '../../components/ErrorCard';
import type { TableDetailsReportPanelProps } from '../../features/CohortBuilder/ExplorerTable/ExploreTableDetails/types';
import { RegimenChart } from './MedicationAdministrationModal/RegimenChart';
import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse, extractData } from './ResearchSubjectModal/tools';
import { LoadingOverlay } from '@mantine/core';

export const MedicationAdministrationDetailPanel = ({
  id, // The table value corresponding to the column name 'idField'
  tableConfig,
}: TableDetailsReportPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;
  const processedNodeFields = Object.entries(nodeFields ?? {})
    .map(([alias, field]) => `${alias}: ${field}`)
    .join('\n');

  const {
    data: maData,
    isLoading: maIsLoading,
    isError: maIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              medicationadministration(filter: $filter,  accessibility: all, first: 1) {
              patient_identifier
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              id: `${id}`,
            },
          },
        ],
      },
    },
  });

  const ma =
    !maIsLoading && isQueryResponse(maData)
      ? extractData(maData, 'medicationadministration', '')[0]
      : {};

  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              ${nodeType} (filter: $filter,  accessibility: all, first: 10000,
              sort: [{index_date_start_days: "desc"}]) {
              ${processedNodeFields}
        }
      }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              [filterField ?? 0]: [`${id}`],
            },
          },
        ],
      },
    },
  });

  if (!idField || idField === null) {
    return (
      <ErrorCard message={'idField not configure in Tables Details Config'} />
    );
  }
  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }
  const queryData = isQueryResponse(data)
    ? extractData(data, nodeType ?? '', '') || []
    : [];

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6 p-4 h-[600px]">
      <LoadingOverlay visible={isLoading} />
      <RegimenChart data={queryData} identifier={ma?.patient_identifier} />
    </div>
  );
};
