import {
  Group,
  LoadingOverlay,
  Stack,
  Table,
  Text,
  CopyButton,
  ActionIcon,
  Tooltip,
  Button,
  ScrollArea,
  Space,
  Grid,
} from '@mantine/core';
import { useGeneralGQLQuery } from '@gen3/core';
import {
  ErrorCard,
  type TableDetailsPanelProps,
  ExplorerTableDetailsPanelFactory,
} from '@gen3/frontend';
import {
  MdContentCopy as IconCopy,
  MdCheck as IconCheck,
} from 'react-icons/md';
import React, { useState } from 'react';
import { AssociatedFilesText } from './ResearchSubjectModal/AssociatedFiles';
import { SpecimenAggregationCountsChart } from './ResearchSubjectModal/AssociatedSpecimen';
import { TimeSeriesAssaySummaryModal } from './ResearchSubjectModal/TimeSeriesModal';
import { isQueryResponse, extractData } from './ResearchSubjectModal/tools';
/**
 * Checks if the given object is a QueryResponse.
 *
 * @param {any} obj - The object to be checked.
 * @returns {boolean} Returns true if the object is a QueryResponse, false otherwise.
 */

export const ResearchSubjectDetailPanel = ({
  id, // The table value corresponding to the column name 'idField'
  row,
  tableConfig,
  onClose,
}: TableDetailsPanelProps) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;

  const ProcessedNodeFields = Object.entries(nodeFields ?? {})
    .map(([alias, field]) => `${alias}: ${field}`)
    .join('\n');

  // The filters in this query assume that the patient ID is unique across all other projects.
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              ${nodeType} (filter: $filter,  accessibility: all, first: 10000) {
              ${ProcessedNodeFields}
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
    ? extractData(data, nodeType ?? '', '')
    : [];

  const querySpecimenIdentifiers = queryData.map(
    (queryData) => queryData.Identifier,
  );

  /*const querySpecimenIdentifierIndexdDays = queryData.reduce((acc, item) => {
    acc[item.Identifier] = item.Indexd_Collection_Date_Days;
    return acc;
    }, {});*/

  const totalFiles = queryData.length;
  const currentFileData = queryData[currentFileIndex] || {};

  // Render rows for the current file index
  const rows = Object.entries(currentFileData).map(([RawField, value]) => {
    const field = RawField.replace(/_/g, ' ');
    return (
      <Table.Tr key={`${currentFileIndex}-${field}`}>
        <Table.Td>
          <Text fw={500}>{field}</Text>
        </Table.Td>
        <Table.Td>
          <Text>{value ? (value as string) : ''}</Text>
        </Table.Td>
      </Table.Tr>
    );
  });

  // Handle previous file index
  const handlePrevFile = () => {
    if (currentFileIndex > 0) {
      setCurrentFileIndex(currentFileIndex - 1);
    }
  };

  // Handle next file index
  const handleNextFile = () => {
    if (currentFileIndex < totalFiles - 1) {
      setCurrentFileIndex(currentFileIndex + 1);
    }
  };
  return totalFiles > 0 ? (
    <React.Fragment>
      <LoadingOverlay visible={isLoading} />
      <ScrollArea.Autosize maw={1200} mx="auto">
        <div className="pb-5">
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Clinical Trial </Table.Th>
                <Table.Th>Condition Diagnosis</Table.Th>
                <Table.Th> Patient Id </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr key={`${row?._valuesCache.id}`}>
                <Table.Td>
                  <Text fw={500}>{row?._valuesCache.project_id}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{row?._valuesCache.condition_Diagnosis}</Text>
                </Table.Td>
                <Table.Td>
                  <Text>{row?._valuesCache.patient_id}</Text>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </div>
        <div className="flex">
          <div className="flex-grow">
            <TimeSeriesAssaySummaryModal
              identifiers={querySpecimenIdentifiers}
            />
          </div>
          <div className="ml-auto">
            <AssociatedFilesText
              identifiers={querySpecimenIdentifiers}
              asoc_val="product_notes_sequencing_site"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col flex-grow">
              <Text className="text-center pt-10">
                File Counts by Data Category
              </Text>
              <div className="flex-grow">
                <SpecimenAggregationCountsChart
                  identifiers={querySpecimenIdentifiers}
                  aggField={'data_category'}
                />
              </div>
            </div>
            <div className="flex flex-col flex-grow">
              <Text className="text-center">
                File Counts by Experimental Strategy
              </Text>
              <div className="flex-grow">
                <SpecimenAggregationCountsChart
                  identifiers={querySpecimenIdentifiers}
                  aggField={'experimental_strategy'}
                />
              </div>
            </div>
          </div>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Sample</Table.Th>
                <Table.Th>Value </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        </div>
      </ScrollArea.Autosize>
      <div className="py-3">
        <Group justify="right">
          <Button onClick={handlePrevFile} disabled={currentFileIndex === 0}>
            Previous
          </Button>
          <Text>{`${currentFileIndex + 1} / ${totalFiles}`}</Text>
          <Button
            onClick={handleNextFile}
            disabled={currentFileIndex === totalFiles - 1}
          >
            Next
          </Button>
        </Group>
      </div>
      <Group justify="right">
        <CopyButton
          value={JSON.stringify(queryData[currentFileIndex])}
          timeout={2000}
        >
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? 'Copied' : 'Copy'}
              withArrow
              position="right"
            >
              <ActionIcon color={copied ? 'accent.4' : 'gray'} onClick={copy}>
                {copied ? <IconCheck size="1rem" /> : <IconCopy size="1rem" />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>

        <Button onClick={() => onClose && onClose(id)}>Close</Button>
      </Group>
    </React.Fragment>
  ) : (
    <div className="px-6">
      <Text>
        {' '}
        No {nodeType}s found for {idField} {id}
      </Text>
    </div>
  );
};

export const registerCustomExplorerResearchSubjectDetailsPanels = () => {
  ExplorerTableDetailsPanelFactory().registerRendererCatalog({
    // NOTE: The catalog name must be tableDetails
    tableDetails: { researchSubject: ResearchSubjectDetailPanel }, // TODO: add simpler registration function that ensures the catalog name is tableDetails
  });
};
