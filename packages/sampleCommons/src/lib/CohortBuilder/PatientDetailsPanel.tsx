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
  console.log('QUERY INDEX: ', index, 'QUERY DATA: ', data);
  if (data === undefined || data === null) return [];
  if (data.data === undefined || data.data === null) return [];

  return Array.isArray(data.data['file']) && data.data['file'].length > 0
    ? data.data['file']
    : [];
};

export const PatientDetailsPanel = ({
  id,
  index,
  tableConfig,
  onClose,
}: TableDetailsPanelProps) => {
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const filterField = tableConfig.detailsConfig?.filterField;
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
        ${nodeType} (filter: $filter,  accessibility: all) {
        id
        title
        subject
        source_url
        md5
        size
        contentType
        creation
        url
        category
        }
      }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              [filterField ?? 0]: [id],
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
    <tr key={`${currentFileIndex}-${field}`}>
      <td>
        <Text weight="bold">{field}</Text>
      </td>
      <td>
        {field === 'id' ? (
          <div className="flex">
            <div className="px-2">
              <FiDownload title="download" size={16} />
            </div>
            <Anchor
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
      </td>
    </tr>
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
    <Stack>
      <LoadingOverlay visible={isLoading} />
      {totalFiles > 0 ? (
        <div>
          <Text color="primary.4">
            {tableConfig.detailsConfig.nodeType} id {id} data:
          </Text>

          <Table withBorder withColumnBorders>
            <thead>
              <tr>
                <th>Field</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </Table>
          <div className="py-3">
            <Group position="right">
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
          <Group position="right">
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
        </div>
      ) : (
        <div className="px-6">
          <Text> No Files Found for id: {id}</Text>
        </div>
      )}
    </Stack>
  );
};

export const registerCustomExplorerPatientDetailsPanels = () => {
  ExplorerTableDetailsPanelFactory().registerRendererCatalog({
    // NOTE: The catalog name must be tableDetails
    tableDetails: { patientDetails: PatientDetailsPanel }, // TODO: add simpler registration function that ensures the catalog name is tableDetails
  });
};
