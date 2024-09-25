import {
  Stack,
  Table,
  Anchor,
  LoadingOverlay,
  Title,
  Text,
} from '@mantine/core';
import { ErrorCard } from '@gen3/frontend';
import { useGeneralGQLQuery, GEN3_FENCE_API } from '@gen3/core';
import { FiDownload } from 'react-icons/fi';
import { isQueryResponse, extractData } from './tools';
import { useMemo } from 'react';

export const useFilesQuery = (identifiers: string[]) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              file (filter: $filter, accessibility: all, first: 10000) {
                id
                title
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

  return (
    <div>
      <LoadingOverlay visible={isLoading} />
      <Text> {ResourceList}</Text>
    </div>
  );
};

export const AssociatedFilesText = ({
  identifiers,
}: {
  identifiers: string[];
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers);
  // Return the length, loading, and error status
  if (isError) {
    return <Text> Error occurred while fetching data </Text>;
  }

  return (
    <div>
      <LoadingOverlay visible={isLoading} />
      <Text>
        Total of {resData.length} Files / {identifiers.length} Annotations
      </Text>
    </div>
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
                <Table.Tr key={element.id}>
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
