import { Stack, Table, LoadingOverlay, Text, Checkbox } from '@mantine/core';

import { ErrorCard } from '@gen3/frontend';
import { useGeneralGQLQuery, JSONObject } from '@gen3/core';
import { isQueryResponse, extractData } from './tools';
import React, { useMemo, useState } from 'react';
import { MatchingTable } from '@gen3/frontend';

export const useFilesQuery = (identifiers: string[], table: boolean) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
           	  _aggregation{
                file(filter: $filter){
                  _totalCount
                }
              }
              file (filter: $filter, accessibility: all, first: 10000) {
                id
                title
                data_category
                experimental_strategy
                specimen_indexed_collection_date_days
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
    if (data && !table) {
      const extractedData = isQueryResponse(data)
        ? (extractData(data, 'file', '') as JSONObject[])
        : [];
      return extractedData;
    } else if (data && table) {
      return data as JSONObject;
    }
  }, [data, table]);

  return { resData: cachedData, isLoading, isError };
};

export const UniqueAssociatedValsForSpecimen = ({
  identifiers,
  asoc_val,
}: {
  identifiers: string[];
  asoc_val: string;
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers, false);
  if (isError) {
    return <Text> Error occurred while fetching file metadata </Text>;
  }
  if (!isLoading) {
    const ResourceList = [
      ...new Set((resData as JSONObject[])?.map((val) => val[asoc_val])),
    ].join(', ');
    return ResourceList;
  }
};

export const AssociatedFilesText = ({
  identifiers,
}: {
  identifiers: string[];
}) => {
  const { resData, isLoading, isError } = useFilesQuery(identifiers, false);
  // Return the length, loading, and error status
  if (isError) {
    return <Text> Error occurred while fetching data </Text>;
  }

  return (
    <div>
      <LoadingOverlay visible={isLoading} />
      <Text>{identifiers.length} Annotations</Text>
      <Text>{(resData as JSONObject[])?.length} Files</Text>
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
  const { resData, isLoading, isError } = useFilesQuery(identifiers, true);
  const {
    resData: resDataTwo,
    isLoading: isLoadingTwo,
    isError: isErrorTwo,
  } = useFilesQuery(identifiers, false);

  const [showTable, setshowTable] = useState(false);

  if (isError || isErrorTwo) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  const filteredResourcesTwo = (resDataTwo as JSONObject[])?.toSorted(
    (a: JSONObject, b: JSONObject) => {
      const left = a[asoc_val] as number;
      const right = b[asoc_val] as number;
      return left - right;
    },
  );

  const asocFileConfig = {
    title: {
      title: 'File Name',
      field: 'title',
    },
    experimental_strategy: {
      title: 'Assay',
      field: 'experimental_strategy',
    },
    specimen_indexed_collection_date_days: {
      title: 'Indexd Days',
      field: 'specimen_indexed_collection_date_days',
    },
    specimen_sample_family_id: {
      title: 'Sample Family Id',
      field: 'specimen_sample_family_id',
    },
  };

  return (
    <Stack>
      <LoadingOverlay visible={isLoading || isLoadingTwo} />
      <div className="pt-2">
        <Checkbox
          label="Toggle File / Assay"
          onChange={() => setshowTable(!showTable)}
        />
      </div>
      {showTable ? (
        <div className="text-primary">
          <div className="grid">
            <MatchingTable
              isLoading={isLoading}
              columns={asocFileConfig}
              index="file"
              idField="id"
              data={resData}
            />
          </div>
        </div>
      ) : (
        <AssayCheckboxChart data={filteredResourcesTwo} />
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
