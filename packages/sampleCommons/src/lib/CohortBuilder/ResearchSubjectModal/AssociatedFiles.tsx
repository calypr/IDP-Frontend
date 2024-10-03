import {
  Stack,
  Table,
  Anchor,
  LoadingOverlay,
  Title,
  Text,
  Button,
} from '@mantine/core';

import { ErrorCard } from '@gen3/frontend';
import { useGeneralGQLQuery, GEN3_FENCE_API, JSONObject } from '@gen3/core';
import { FiDownload } from 'react-icons/fi';
import { isQueryResponse, extractData } from './tools';
import { useMemo, useState } from 'react';
import { VicLineChart } from './LineChart';

export const useFilesQuery = (identifiers: string[]) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              file (filter: $filter, accessibility: all, first: 10000) {
                id
                title
                data_category
                experimental_strategy
                specimen_indexed_collection_date_days
                product_notes_sequencing_site
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

  const cachedData = useMemo(() => {
    if (data) {
      const extractedData = isQueryResponse(data)
        ? extractData(data, 'file', '')
        : [];
      return extractedData;
    }
    return [];
  }, [data]);

  return { resData: cachedData, isLoading, isError };
};

export const UniqueAssociatedValsForSpecimen = ({
  identifiers,
  asoc_val,
}: {
  identifiers: string[];
  asoc_val: string;
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers);
  if (isError) {
    return <Text> Error occurred while fetching data </Text>;
  }
  const ResourceList = [...new Set(resData.map((val) => val[asoc_val]))].join(
    ', ',
  );

  return ResourceList;
};

export const AssociatedFilesText = ({
  identifiers,
  asoc_val,
}: {
  identifiers: string[];
  asoc_val: string;
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers);
  // Return the length, loading, and error status
  if (isError) {
    return <Text> Error occurred while fetching data </Text>;
  }
  const vals = UniqueAssociatedValsForSpecimen({
    identifiers: identifiers,
    asoc_val: asoc_val,
  });

  return (
    <div>
      <LoadingOverlay visible={isLoading} />
      <Text className="whitespace-nowrap">
        {identifiers.length} Annotations, {resData.length} Files From {vals}
      </Text>
    </div>
  );
};

export const AssociatedAssaysTable = ({
  identifiers,
}: {
  identifiers: string[];
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers);
  const [showTable, setshowTable] = useState(false);

  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  const filteredResources = resData.toSorted((a: JSONObject, b: JSONObject) => {
    const left = a['specimen_indexed_collection_date_days'] as number;
    const right = b['specimen_indexed_collection_date_days'] as number;
    return left - right;
  });

  const lineChartData = filteredResources
    .filter(
      (obj) =>
        'specimen_indexed_collection_date_days' in obj &&
        'experimental_strategy' in obj,
    )
    .map(
      ({ specimen_indexed_collection_date_days, experimental_strategy }) => ({
        y: experimental_strategy,
        x: specimen_indexed_collection_date_days,
      }),
    );

  return (
    <Stack>
      <LoadingOverlay visible={isLoading} />
      <Button onClick={() => setshowTable(!showTable)}>
        Toggle Table / Chart
      </Button>
      {resData.length > 0 && showTable ? (
        <div className="text-primary">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File Name</Table.Th>
                <Table.Th>Assay</Table.Th>
                <Table.Th>IndexdDays</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredResources.map((element) => (
                <Table.Tr
                  key={`${element.experimental_strategy}-${element.title}`}
                >
                  <Table.Td>{element.title}</Table.Td>
                  <Table.Td>{element.experimental_strategy}</Table.Td>
                  <Table.Td>
                    {element.specimen_indexed_collection_date_days}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ) : (
        <VicLineChart lineChartData={lineChartData} />
      )}
    </Stack>
  );
};

export const AssociatedFilesTable = ({
  identifiers,
}: {
  identifiers: string;
}) => {
  const { resData, isLoading, isError } = useFilesQuery([identifiers]);

  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  return (
    <Stack>
      <LoadingOverlay visible={isLoading} />
      {resData.length > 0 && (
        <div className="text-primary">
          <Title className="text-lg p-5 text-center">
            Specimen Identifier {identifiers} files
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Title</Table.Th>
                <Table.Th>Download</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {resData.map((element) => (
                <Table.Tr key={element.title}>
                  <Table.Td>{element.title}</Table.Td>
                  <Table.Td>
                    <div className="flex">
                      <div className="px-2">
                        <FiDownload title="download" size={16} />
                      </div>
                      <Anchor
                        c="accent.1"
                        href={`${GEN3_FENCE_API}/user/data/download/${
                          element.id ? (element.id as string) : ''
                        }?redirect=true`}
                        target="_blank"
                      >
                        {element.id ? (element.id as string) : ''}
                      </Anchor>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      )}
    </Stack>
  );
};
