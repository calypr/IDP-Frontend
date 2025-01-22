import {
  ErrorCard,
  type TableDetailsPanelProps,
  ExplorerTableDetailsPanelFactory,
} from '@gen3/frontend';
import { RegimenChart } from './MedicationAdministrationModal/RegimenChart';
import { useGeneralGQLQuery } from '@gen3/core';
import React from 'react';
import { isQueryResponse, extractData } from './ResearchSubjectModal/tools';
import { LoadingOverlay, ScrollArea } from '@mantine/core';

export const MedicationAdministrationDetailPanel = ({
  id, // The table value corresponding to the column name 'idField'
  row,
  tableConfig,
  onClose,
}: TableDetailsPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;
  const processedNodeFields = Object.entries(nodeFields ?? {})
    .map(([alias, field]) => `${alias}: ${field}`)
    .join('\n');
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
    <div className="flex-grow">
      <LoadingOverlay visible={isLoading} />
      <RegimenChart
        data={queryData}
        identifier={row?._valuesCache.patient_identifier}
      />
    </div>
  );
};
export const registerCustomExplorerMedicationAdministrationDetailsPanels =
  () => {
    ExplorerTableDetailsPanelFactory().registerRendererCatalog({
      // NOTE: The catalog name must be tableDetails
      tableDetails: {
        medicationAdministration: MedicationAdministrationDetailPanel,
      }, // TODO: add simpler registration function that ensures the catalog name is tableDetails
    });
  };
