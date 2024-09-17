import {
  Anchor,
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
import { useGeneralGQLQuery, GEN3_FENCE_API } from '@gen3/core';
import {
  ErrorCard,
  type TableDetailsPanelProps,
  ExplorerTableDetailsPanelFactory,
} from '@gen3/frontend';
import {
  MdContentCopy as IconCopy,
  MdCheck as IconCheck,
} from 'react-icons/md';
import { table } from 'console';
import { useState } from 'react';
import { FiDownload } from 'react-icons/fi';

// a definition of the query response
interface QueryResponse {
  data?: Record<string, Array<any>>;
}

interface FileData {
  [key: string]: any;
}

/**
 * Checks if the given object is a QueryResponse.
 *
 * @param {any} obj - The object to be checked.
 * @returns {boolean} Returns true if the object is a QueryResponse, false otherwise.
 */
const isQueryResponse = (obj: any): obj is QueryResponse => {
  // Considering that the data property can be optional
  return (
    typeof obj === 'object' &&
    (obj.data === undefined || typeof obj.data === 'object')
  );
};

const extractData = (data: QueryResponse, index: string): FileData[] => {
  if (data === undefined || data === null) return [];
  if (data.data === undefined || data.data === null) return [];

  return Array.isArray(data.data['file']) && data.data['file'].length > 0
    ? data.data['file']
    : [];
};

export const ResourceDetailsPanel = ({
  id,
  index,
  tableConfig,
  onClose,
}: TableDetailsPanelProps) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
        ${nodeType} (filter: $filter,  accessibility: all) {
        ${nodeFields}
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
  const queryData = isQueryResponse(data) ? extractData(data, index) : [];

  const totalFiles = queryData.length;
  const currentFileData = queryData[currentFileIndex] || {};

  // Render rows for the current file index
  const rows = Object.entries(currentFileData).map(([field, value]) => (
    <Table.Tr key={`${currentFileIndex}-${field}`}>
      <Table.Td>
        <Text fw={500}>{field}</Text>
      </Table.Td>
      <Table.Td>
        {field === 'id' ? (
          <div className="flex">
            <div className="px-2">
              <FiDownload title="download" size={16} />
            </div>
            <Anchor
              c="accent.1"
              href={`${GEN3_FENCE_API}/user/data/download/${
                value ? (value as string) : ''
              }?redirect=true`}
              target="_blank"
            >
              {value ? (value as string) : ''}
            </Anchor>
          </div>
        ) : (
          <Text>{value ? (value as string) : ''}</Text>
        )}
      </Table.Td>
    </Table.Tr>
  ));

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

  return (
      totalFiles > 0 ? (
        <Stack>
          <LoadingOverlay visible={isLoading} />
          <ScrollArea.Autosize maw={1200} mx="auto" >
            <Table withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Field</Table.Th>
                  <Table.Th>Value</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>{rows}</Table.Tbody>
            </Table>
          </ScrollArea.Autosize>
          <div className="py-3">
            <Group justify="right">
              <Button
                onClick={handlePrevFile}
                disabled={currentFileIndex === 0}
              >
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
                  <ActionIcon
                    color={copied ? 'accent.4' : 'gray'}
                    onClick={copy}
                  >
                    {copied ? (
                      <IconCheck size="1rem" />
                    ) : (
                      <IconCopy size="1rem" />
                    )}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>

            <Button onClick={() => onClose && onClose(id)}>Close</Button>
          </Group>
        </Stack>
      ) : (
        <div className="px-6">
          <Text> No {nodeType}s found for {idField} {id}</Text>
        </div>
      )
  );
};

export const registerCustomExplorerResourceDetailsPanels = () => {
  ExplorerTableDetailsPanelFactory().registerRendererCatalog({
    // NOTE: The catalog name must be tableDetails
    tableDetails: { resourceDetails: ResourceDetailsPanel }, // TODO: add simpler registration function that ensures the catalog name is tableDetails
  });
};
