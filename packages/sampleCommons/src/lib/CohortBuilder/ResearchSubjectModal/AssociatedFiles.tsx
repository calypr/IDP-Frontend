import {
  Stack,
  Table,
  Anchor,
  LoadingOverlay,
  Title,
  Text,
  Button,
  Checkbox,
} from '@mantine/core';

import { ErrorCard } from '@gen3/frontend';
import { useGeneralGQLQuery, GEN3_FENCE_API, JSONObject } from '@gen3/core';
import { FiDownload } from 'react-icons/fi';
import { isQueryResponse, extractData } from './tools';
import React, { useMemo, useState } from 'react';

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
                specimen_sample_family_id
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
    return <Text> Error occurred while fetching file metadata </Text>;
  }
  if (!isLoading) {
    const ResourceList = [...new Set(resData.map((val) => val[asoc_val]))].join(
      ', ',
    );
    return ResourceList;
  }
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
      <Text>
        {identifiers.length} Annotations, {resData.length} Files From
      </Text>
      <Text>{vals}</Text>
    </div>
  );
};

export const AssociatedAssaysTable = ({
  identifiers,
  asoc_val,
}: {
  identifiers: string[];
  asoc_val: string;
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers);
  const [showTable, setshowTable] = useState(false);

  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  const filteredResources = resData.toSorted((a: JSONObject, b: JSONObject) => {
    const left = a[asoc_val] as number;
    const right = b[asoc_val] as number;
    return left - right;
  });

  return (
    <Stack>
      <LoadingOverlay visible={isLoading} />
      <Button onClick={() => setshowTable(!showTable)}>
        Toggle File / Assay
      </Button>
      {resData.length > 0 && showTable ? (
        <div className="text-primary">
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>File Name</Table.Th>
                <Table.Th>Assay</Table.Th>
                <Table.Th>Indexd Days</Table.Th>
                <Table.Th> Sample Family Id </Table.Th>
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
                  <Table.Td>{element.specimen_sample_family_id}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>
      ) : (
        <AssayCheckboxChart data={filteredResources} />
      )}
    </Stack>
  );
};

export const AssayCheckboxChart = ({
  data,
}: {
  data: Array<Record<string, any>>;
}) => {
  const resData = data.map((obj) => ({
    family_id: obj.specimen_sample_family_id,
    assay: obj.experimental_strategy,
  }));

  const uniqueAssays = [...new Set(resData.map((val) => val['assay']))].map(
    (obj) => {
      return <Table.Th key={obj}> {obj}</Table.Th>;
    },
  );

  const simplifyList = () => {
    const grouped: Record<string, any> = {};
    resData.forEach(({ family_id, assay }) => {
      if (!grouped[family_id]) {
        grouped[family_id] = [];
      }
      if (!grouped[family_id].includes(assay)) {
        grouped[family_id].push(assay);
      }
    });

    return Object.entries(grouped).map(([family_id, assays]) => (
      <Table.Tr key={family_id}>
        <Table.Td>{family_id}</Table.Td>
        {uniqueAssays.map((header, index) => {
          return assays.some((assay: string) => assay === header.key) ? (
            <Table.Td>
              <Checkbox key={index} checked={true} color="#32CD32" size="lg" />
            </Table.Td>
          ) : (
            <Table.Td></Table.Td>
          );
        })}
      </Table.Tr>
    ));
  };

  return (
    <React.Fragment>
      <Table>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Sample Family Id</Table.Th>
            {uniqueAssays}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{simplifyList()}</Table.Tbody>
      </Table>
    </React.Fragment>
  );
};
