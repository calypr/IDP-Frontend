import {
  LoadingOverlay,
  Text,
  Title,
  ScrollArea,
  Divider,
  Box,
} from '@mantine/core';
import { fieldNameToTitle, useGeneralGQLQuery } from '@gen3/core';
import { MatchingTable } from '@gen3/frontend';
import {
  ErrorCard,
  type TableDetailsPanelProps,
  ExplorerTableDetailsPanelFactory,
} from '@gen3/frontend';
import React from 'react';
  
import SimpleTable from '../../../../frontend/src/features/SimpleTable/SimpleTable';
import { useFilesQuery } from './ResearchSubjectModal/AssociatedFiles';
import { extractData, isQueryResponse, useGroupToSpecimenMapping } from './ResearchSubjectModal/tools';
import SpecimenTree from './SpecimenModal/SpecimenTree';

export const SpecimenDetailsPanel = ({
  id, // The table value corresponding to the column name 'idField'
  row,
  tableConfig,
}: TableDetailsPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;

  const processedNodeFields = Object.keys(nodeFields ?? {}).join('\n');

  const modelTableConfig = nodeFields
      ? Object.entries(nodeFields).reduce(
          (acc, [key, value]) => {
            acc[key] = {
              title: fieldNameToTitle(value), // Use the value of the key-value pair
              field: key, // Use the key as the field
            };
            return acc;
          },
          {} as Record<string, { title: string; field: string }>,
        )
      : {};

  const subjectTableData = {
    'Clinical Trial': row?._valuesCache.project_id as string,
    'Participant ID': row?._valuesCache.patient_identifier as string,
    'Condition Diagnosis': row?._valuesCache.patient_condition_Diagnosis as string
  };

  const specimenTableData = {
    'BEMS ID': row?._valuesCache.identifier as string,
    'Collection Date': row?._valuesCache.indexed_collection_date_days as string,
    'Sample Family ID': row?._valuesCache.sample_family_id as string,
    'Metastatis Site': row?._valuesCache.collection as string,
    'Sample Type': row?._valuesCache.sample_type as string,
    'Tissue Type': row?._valuesCache.tissue_type as string,
    'Percent Tumor': row?._valuesCache.percent_tumor as string,
  };
  
  // map group id to the patient's specimens
  const specimenIdArr = [`${id}`];
  const {data: groupSpecimensMap, isLoading: groupIsLoading, isError: groupIsError} = useGroupToSpecimenMapping(specimenIdArr);

  // get files matching specimen or group ID
  // for syntax, see Guppy docs
  // https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#combine-into-advanced-filters
  const groupIds = Object.keys(groupSpecimensMap);
  
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
            OR: [
              {
                IN: {
                  [filterField ?? 0]: specimenIdArr,
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
  
  // get file counts
  const { data: fileCountData, isLoading: fileIsLoading, isError: fileIsError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              _aggregation{
                file(filter: $filter){
                  _totalCount
                }
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
                specimen_id: `${id}`,
            }
          }
        ]
      },
    },
  });
  console.log("specimen", id);

  console.log("fileCountData", fileCountData);

  const numFiles = isQueryResponse(fileCountData)
      ? extractData(fileCountData, 'file', '').length
      : '';

  if (!idField || idField === null) {
    return (
      <ErrorCard message={'idField not configure in Tables Details Config'} />
    );
  }


  if (fileIsError) {
    return <ErrorCard message={'Error occurred while fetching files for this specimen'} />;
  }

  return !isError ? (
    <React.Fragment>
      <LoadingOverlay visible={fileIsLoading} />
      <ScrollArea.Autosize maw={'80vw'} mx="auto">
        {/* <div className="text-center"> */}
        <div className="flex">
          <Title className="flex-grow pb-3 text-center" order={3}>
            Subject Summary
          </Title>
          <div className="ml-auto flex-shrink-0 text-right">
            <Text>
              {numFiles} Files
            </Text>
          </div>
        </div>
        <div className="flex pb-5">
          <SimpleTable data={subjectTableData} />
        </div>
        <Divider className="pb-5" size="md" color="black" />
        <div className="pb-5">
          <Title className="pb-3 text-center" order={3}>
            Specimen Summary
          </Title>
          <SimpleTable data={specimenTableData} />
        </div>
        <Divider className="pb-5" size="md" color="black" />
        <div className="pb-5">
          <Title className="pb-3 text-center" order={3}>
            Related Specimens by Sample Family ID: {row?._valuesCache.sample_family_id}
          </Title>
          <SpecimenTree
            sampleFamilyId={row?._valuesCache.sample_family_id as string}
            specimenId={id as string}
          />
        </div>
        <Divider className="pb-5" size="md" color="black" />
        <div>
          <Title className="pb-3 text-center" order={3}>
            File Information Table
          </Title>
          <div className="grid">
            <MatchingTable
              isLoading={fileIsLoading}
              columns={modelTableConfig}
              index={nodeType ?? 'file'}
              idField={idField}
              data={data}
            />
          </div>
        </div>
        {/* </div> */}
      </ScrollArea.Autosize>
    </React.Fragment>
  ) : (
      <div className="px-6">
        <Text>
          Could not load specimen details
        </Text>
      </div>
  );
};

export const registerCustomExplorerSpecimenDetailsPanels = () => {
  ExplorerTableDetailsPanelFactory().registerRendererCatalog({
    // NOTE: The catalog name must be tableDetails
    tableDetails: { specimenDetails: SpecimenDetailsPanel }, // TODO: add simpler registration function that ensures the catalog name is tableDetails
  });
};