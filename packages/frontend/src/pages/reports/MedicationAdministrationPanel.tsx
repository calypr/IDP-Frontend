import React from 'react';
import ErrorCard from '../../components/ErrorCard';
import type { TableDetailsReportPanelProps } from '../../features/CohortBuilder/ExplorerTable/ExploreTableDetails/types';
import { RegimenChart } from './MedicationAdministrationModal/RegimenChart';
import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse, extractData } from './ResearchSubjectModal/tools';
import { LoadingOverlay } from '@mantine/core';

export const MedicationAdministrationDetailPanel = ({
  id,
  tableConfig,
}: TableDetailsReportPanelProps) => {
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
              medication_administration(filter: $filter,  accessibility: all, first: 1) {
              medication_administration_patient_identifier
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              medication_administration_patient_id: `${id}`,
            },
          },
        ],
      },
    },
  });

  const {
    data,
    isLoading: nodeIsLoading,
    isError: nodeIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      ${nodeType} (filter: $filter, accessibility: all, first: 10000,
      sort: [{medication_administration_index_date_start_days: "desc"}]) {
        ${processedNodeFields}
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              [filterField ?? '']: [`${id}`],
            },
          },
        ],
      },
    },
  });

  if (nodeIsLoading || maIsLoading) {
    return (
      <div className="mx-auto max-w-5xl flex flex-col gap-6 p-4 h-[600px]">
        <LoadingOverlay visible={true} />
      </div>
    );
  }

  if (nodeIsError || maIsError) {
    return <ErrorCard message="Failed to load data" />;
  }

  const maId = isQueryResponse(maData)
    ? extractData(maData, 'medication_administration', '')?.[0]
    : {};

  const ma = isQueryResponse(data)
    ? extractData(data, 'medication_administration', '')
    : undefined;

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6 p-4 h-[600px]">
      <RegimenChart
        data={ma}
        identifier={maId?.medication_administration_patient_identifier}
      />
    </div>
  );
};
