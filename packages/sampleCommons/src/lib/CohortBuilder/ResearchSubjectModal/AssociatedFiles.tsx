import { Stack, Table, LoadingOverlay, Text, Checkbox, SegmentedControl } from '@mantine/core';

import { ErrorCard, SummaryTableColumn } from '@gen3/frontend';
import { useGeneralGQLQuery, JSONObject } from '@gen3/core';
import { isQueryResponse, extractData, useGroupToSpecimenMapping } from './tools';
import { QueryContent, QueryHookResponse, QueryResponse, ResourceDict } from '../types';
import React, { useMemo, useState } from 'react';
import { MatchingTable } from '@gen3/frontend';




/**
 * Gets all files associated with the specified specimens
 *
 * @param {string[]} specimenIds: specimen IDs
 * @param {boolean} isRawQueryResponse
 *     - true: returns raw Guppy query. Use for accurate file counts
 *     - false: return list of assays (where assay = combo of file w/ unique specimen) 
 * @returns {QueryHookResponse}
 */
export const useFilesQuery = (specimenIds: string[], isRawQueryResponse: boolean) : QueryHookResponse => {
  
  // map group id to the patient's specimens
  const {data: groupSpecimensMap, isLoading: groupIsLoading, isError: groupIsError} = useGroupToSpecimenMapping(specimenIds);

  // get files matching specimen or group ID
  // for syntax, see Guppy docs
  // https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#combine-into-advanced-filters
  const groupIds = Object.keys(groupSpecimensMap);
  
  const { data: fileData, isLoading: filesAreLoading, isError: FilesAreError } = useGeneralGQLQuery({
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
                assay
                specimen_indexed_collection_date_days
                specimen_sample_family_id
                specimen_id
                group_id
                level
              }
            }`,
    variables: {
      filter: {
        // check if DocRef subject is either specimen or group ID
        AND: [
          {
            OR: [
              {
                IN: {
                  specimen_id: specimenIds
                }
              },
              {
                IN: {
                  group_id: groupIds
                }
              }
            ]
          }
        ]
      },
    },
  });

  // cache results
  const cachedData = useMemo(() => {
    // for non-table use case, return nested list of docrefs from raw guppy query result
    if (fileData && groupSpecimensMap) {
      const fileDicts = isQueryResponse(fileData)
        ? (extractData(fileData, 'file', '') as JSONObject[])
        : [];

      // create array of arrays
      const NestedFileDictsArray : Array<QueryContent> = fileDicts.map((fileDict) : QueryContent => {
        if (fileDict.group_id) {
          const specimens = (groupSpecimensMap as Record<string, QueryContent>)[String(fileDict.group_id)];
          
          // expand out so that each specimen points to each row
          const imputedSpecimens : QueryContent = specimens?.map((specimen: ResourceDict) => ({
            ...fileDict,
            specimen_id: specimen.member_id,
            specimen_indexed_collection_date_days: specimen.indexed_collection_date_days,
            specimen_sample_family_id: specimen.sample_family_id,
          }));
          
          return imputedSpecimens;
        }
        else {
          return [fileDict];
        }
      }, []);
      
      // return guppy response
      if (isRawQueryResponse){
        // flatten a single file's multiple specimen values into a single row
        const flatFileDicts = NestedFileDictsArray.map((specimens: QueryContent) => {
          // return if only specimen
          if (!specimens) return {};
          if (specimens.length === 1) return specimens[0];
          
          // otherwise concatenate specimen values
          const joined_family_ids = specimens.map((specimen => specimen.specimen_sample_family_id)).join(', ');
          const joined_indexed_dates = specimens.map((specimen => specimen.specimen_indexed_collection_date_days)).join(', ');
          return {
            ...specimens[0],
            specimen_sample_family_id: joined_family_ids,
            specimen_indexed_collection_date_days: joined_indexed_dates
          };
        });

        // create new object since guppy responses are read-only
        return isQueryResponse(fileData) ? {
          ...fileData,
          data : {
            ...fileData.data,
            file: flatFileDicts
          }
        } as QueryResponse :
        {};
      }
      // return assay response
      else {
        // flatten the array of arrays into a single array of dicts
        return NestedFileDictsArray.flat(1) as QueryContent;
      }
    }
  }, [fileData, isRawQueryResponse, groupSpecimensMap]) as QueryResponse | QueryContent;

  // consolidate booleans
  const isLoading = groupIsLoading && filesAreLoading;
  const isError = groupIsError && FilesAreError;

  return { data: cachedData, isLoading, isError };
};

export const UniqueAssociatedValsForSpecimen = ({
  ids,
  asocVal,
}: {
  ids: string[];
  asocVal: string;
}) => {
  const { data: resData, isLoading, isError } = useFilesQuery(ids, false);
  if (isError) {
    return <Text> Error occurred while fetching file metadata </Text>;
  }
  if (!isLoading) {
    const ResourceList = [
      ...new Set((resData as JSONObject[])?.map((val) => val[asocVal])),
    ].join(', ');
    return ResourceList;
  }
};

/**
 * Text to show number of patient-specific specimens and files
 */
export const AssociatedFilesText = ({
  specimenIds
}: {
  specimenIds: string[];
}) => {
  const { data: resData, isLoading, isError } = useFilesQuery(specimenIds, true); 
  
  if (isError) {
    return <Text> Error occurred while fetching data </Text>;
  }

  const numFiles = isQueryResponse(resData)
    ? extractData(resData, 'file', '').length
    : '';

  return (
    <div>
      <LoadingOverlay visible={isLoading} />
      <Text>{specimenIds.length} Specimens</Text>
      <Text>
        {numFiles} Files
      </Text>
    </div>
  );
};

export const AssociatedAssaysTable = ({
  ids,
  asoc_val,
}: {
  ids: string[];
  asoc_val: string;
}) => {
  const { data: resData, isLoading, isError } = useFilesQuery(ids, true);
  const {
    data: resDataTwo,
    isLoading: isLoadingTwo,
    isError: isErrorTwo,
  } = useFilesQuery(ids, false);

  const [viewMode, setViewMode] = useState('assay');

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

  const asocFileConfig : Record<string, SummaryTableColumn> = {
    title: {
      title: 'File Name',
      field: 'title',
    },
    assay: {
      title: 'Assay',
      field: 'assay',
    },
    specimen_indexed_collection_date_days: {
      title: 'Indexed Days',
      field: 'specimen_indexed_collection_date_days',
    },
    specimen_sample_family_id: {
      title: 'Sample Family IDs',
      field: 'specimen_sample_family_id',
    },
    level: {
      title: 'Level',
      field: 'level',
    }
  };

  return (
    <Stack>
      <LoadingOverlay visible={isLoading || isLoadingTwo} />
      <div className="pt-2">
        <SegmentedControl
          value={viewMode}
          onChange={(value) => setViewMode(value)}
          data={[
            { label: 'Assay View', value: 'assay' },
            { label: 'File View', value: 'file' },
          ]}
          color="primary.0"
        />
      </div>
      {viewMode === 'file' ? (
        <div className="grid">
          <MatchingTable
            isLoading={isLoading}
            columns={asocFileConfig}
            index="file"
            idField="id"
            data={resData}
          />
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
  data: QueryContent;
}) => {
  const resData = data.map((obj) => ({
    family_id: obj.specimen_sample_family_id,
    assay: obj.assay,
  }));

  const uniqueAssays = [...new Set(resData.map((val) => val['assay']))].map(
    (obj) => {
      return <Table.Th key={obj}> {obj}</Table.Th>;
    },
  );

  const simplifyList = () => {
    const grouped: ResourceDict = {};
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
              <Checkbox
                key={index}
                checked={true}
                defaultChecked
                color="#32CD32"
                size="lg"
              />
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
            <Table.Th>Sample Family ID</Table.Th>
            {uniqueAssays}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>{simplifyList()}</Table.Tbody>
      </Table>
    </React.Fragment>
  );
};
