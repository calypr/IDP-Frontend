import {
  Group,
  LoadingOverlay,
  Table,
  Text,
  Title,
  CopyButton,
  ActionIcon,
  Tooltip,
  Button,
  ScrollArea,
  Divider,
} from '@mantine/core';
import { JSONObject, useGeneralGQLQuery } from '@gen3/core';
import { MatchingTable } from '@gen3/frontend';
import {
  ErrorCard,
  type TableDetailsPanelProps,
  ExplorerTableDetailsPanelFactory,
} from '@gen3/frontend';
import {
  MdContentCopy as IconCopy,
  MdCheck as IconCheck,
} from 'react-icons/md';
import React from 'react';
import { AssociatedFilesText } from './ResearchSubjectModal/AssociatedFiles';
import { SpecimenAggregationCountsChart } from './ResearchSubjectModal/AssociatedSpecimen';
import { TimeSeriesAssaySummaryModal } from './ResearchSubjectModal/TimeSeriesModal';
import { isQueryResponse } from './ResearchSubjectModal/tools';

export const ResearchSubjectDetailPanel = ({
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

  // The filters in this query assume that the patient ID is unique across all other projects.
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              ${nodeType} (filter: $filter,  accessibility: all, first: 10000) {
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

  const querySpecimenIds: string[] = isQueryResponse(data)
  ? Array.isArray(data.data[nodeType ?? 'researchsubject'])
      ? data.data[nodeType ?? 'researchsubject'].map((item: any) => {
          return item.Id;
      })
    : []
  : [];

  const modelTableConfig = nodeFields
    ? Object.entries(nodeFields).reduce(
        (acc, [key, value]) => {
          acc[key] = {
            title: value, // Use the value of the key-value pair
            field: key, // Use the key as the field
          };
          return acc;
        },
        {} as Record<string, { title: string; field: string }>,
      )
    : {};

  return !isLoading ? (
    <React.Fragment>
      <LoadingOverlay visible={isLoading} />
      <ScrollArea.Autosize maw={'80vw'} mx="auto">
        <div className="flex pb-5">
          <TimeSeriesAssaySummaryModal ids={querySpecimenIds} />
          <div className="flex-grow text-center">
            <Title order={3}> Subject Summary </Title>
          </div>
          <div className="ml-auto flex-shrink-0">
            <AssociatedFilesText
              ids={querySpecimenIds}
            />
          </div>
        </div>
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
        <Divider size="md" color="#2c2c54" />
        <div className="grid grid-cols-2">
          <SpecimenAggregationCountsChart
            ids={querySpecimenIds}
            title={'File Counts by Data Category'}
            aggField={'data_category'}
          />
          <SpecimenAggregationCountsChart
            ids={querySpecimenIds}
            aggField={'assay'}
            title={'File Counts by Assay'}
          />
        </div>
        <Divider size="md" color="#2c2c54" />
        <div className="text-center p-5">
          <Title order={3}>Specimen Information Table</Title>
        </div>
        <div>
          <div className="grid">
            <MatchingTable
              isLoading={isLoading}
              columns={modelTableConfig}
              index={nodeType ?? 'file'}
              idField={idField}
              data={data}
            />
          </div>
        </div>

        <div className="pt-5">
          <Group justify="right">
            <CopyButton value={JSON.stringify(data)} timeout={2000}>
              {({ copied, copy }) => (
                <Tooltip
                  label={copied ? 'Copied' : 'Copy raw JSON data'}
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

            <Button color="primary.0" onClick={() => onClose && onClose(id)}>
              Close
            </Button>
          </Group>
        </div>
      </ScrollArea.Autosize>
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
