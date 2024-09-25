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
import { useState } from 'react';
import {
  AssociatedFilesTable,
  AssociatedFilesText,
  UniqueAssociatedValsForSpecimen,
} from './ResearchSubjectModal/AssociatedFiles';
import { SpecimenAggregationCountsChart } from './ResearchSubjectModal/AssociatedSpecimen';
import { isQueryResponse, extractData } from './ResearchSubjectModal/tools';
/**
 * Checks if the given object is a QueryResponse.
 *
 * @param {any} obj - The object to be checked.
 * @returns {boolean} Returns true if the object is a QueryResponse, false otherwise.
 */

export const ResearchSubjectDetailPanel = ({
  id, // The table value corresponding to the column name 'idField'
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
    <Stack>
      <LoadingOverlay visible={isLoading} />
      <ScrollArea.Autosize maw={1200} mx="auto">
        <UniqueAssociatedValsForSpecimen
          identifiers={querySpecimenIdentifiers}
          asoc_val={'product_notes_sequencing_site'}
        />
        <AssociatedFilesText identifiers={querySpecimenIdentifiers} />
        <SpecimenAggregationCountsChart
          identifiers={querySpecimenIdentifiers}
        />
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Sample</Table.Th>
              <Table.Th>Value </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>{rows}</Table.Tbody>
        </Table>
        <AssociatedFilesTable
          identifiers={querySpecimenIdentifiers[currentFileIndex]}
        />
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
    </Stack>
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
