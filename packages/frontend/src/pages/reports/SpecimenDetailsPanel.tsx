import {
  LoadingOverlay,
  Text,
  Title,
  Divider,
  SegmentedControl,
} from '@mantine/core';
import { fieldNameToTitle, useGeneralGQLQuery } from '@gen3/core';
import { MatchingTable } from '../../features/MatchingTable';
import ErrorCard from '../../components/ErrorCard';
import type { TableDetailsReportPanelProps } from '../../features/CohortBuilder';
import { useState } from 'react';
import SimpleTable from '../../../../frontend/src/features/SimpleTable/SimpleTable';
import {
  extractData,
  isQueryResponse,
  useGroupToSpecimenMapping,
} from './ResearchSubjectModal/tools';
import SpecimenTree from './SpecimenModal/SpecimenTree';

export const SpecimenDetailsPanel = ({
  id, // The table value corresponding to the column name 'idField'
  tableConfig,
}: TableDetailsReportPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;

  const processedNodeFields = Object.keys(nodeFields ?? {}).join('\n');

  // create config to display associated files using nodeFiles from config
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

  // view for specimen tree
  const [graphView, setGraphView] = useState(false);

  // Get row since can't used cached MRT values anymore
  const {
    data: specimenData,
    isLoading: specimenIsLoading,
    isError: specimenIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              specimen(filter: $filter,  accessibility: all, first: 1) {
              identifier
              indexed_collection_date_days
              sample_family_id
              sample_type
              collection
              tissue_type
              percent_tumor
              project_id
              patient_identifier
              patient_id
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              id: `${id}`,
            },
          },
        ],
      },
    },
  });

  const specimen =
    !specimenIsLoading && isQueryResponse(specimenData)
      ? extractData(specimenData, 'specimen', '')[0]
      : {};

  // get enrollment diagnosis from research subject
  const {
    data: diagnosisData,
    isLoading: diagnosisIsLoading,
    isError: diagnosisIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              researchsubject(filter: $filter,  accessibility: all, first: 10000) {
                condition_Diagnosis
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              patient_id: `${specimen?.patient_id}`,
            },
          },
        ],
      },
    },
  });

  const diagnosis =
    !diagnosisIsLoading && isQueryResponse(diagnosisData)
      ? (extractData(diagnosisData, 'researchsubject', '')[0]
          .condition_Diagnosis as string)
      : '';

  // set up table data
  const subjectTableData = {
    'Clinical Trial': specimen?.project_id as string,
    'Participant ID': specimen?.patient_identifier as string,
    'Enrollment Diagnosis': diagnosis,
  };

  const specimenTableData = {
    'BEMS ID': specimen?.identifier as string,
    'Collection Date': specimen?.indexed_collection_date_days as string,
    'Sample Family ID': specimen?.sample_family_id as string,
    'Metastatis Site': specimen?.collection as string,
    'Sample Type': specimen?.sample_type as string,
    'Tissue Type': specimen?.tissue_type as string,
    'Percent Tumor': specimen?.percent_tumor as string,
  };

  // map group id to the patient's specimens
  const specimenIdArr = [`${id}`];
  const {
    data: groupSpecimensMap,
    isLoading: groupIsLoading,
    isError: groupIsError,
  } = useGroupToSpecimenMapping(specimenIdArr);

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
                },
              },
              {
                IN: {
                  group_id: groupIds,
                },
              },
            ],
          },
        ],
      },
    },
  });

  // get file counts
  const {
    data: fileCountData,
    isLoading: fileIsLoading,
    isError: fileIsError,
  } = useGeneralGQLQuery({
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
            OR: [
              {
                IN: {
                  [filterField ?? 0]: specimenIdArr,
                },
              },
              {
                IN: {
                  group_id: groupIds,
                },
              },
            ],
          },
        ],
      },
    },
  });

  // get number of files
  const numFiles =
    !fileIsLoading && isQueryResponse(fileCountData)
      ? fileCountData.data._aggregation.file._totalCount
      : '';

  if (!idField || idField === null) {
    return (
      <ErrorCard message={'idField not configure in Tables Details Config'} />
    );
  }

  if (fileIsError) {
    return (
      <ErrorCard
        message={'Error occurred while fetching files for this specimen'}
      />
    );
  }

  return !isError ? (
    <div className="mx-auto max-w-5xl flex flex-col gap-6 p-4">
      <LoadingOverlay visible={fileIsLoading} />
      {/* Subject Summary */}
      <Title className="pb-3 text-center" order={3}>
        Subject Summary
      </Title>
      <div className="flex pb-5">
        <SimpleTable data={subjectTableData} />
      </div>
      {/* Specimen Summary, title centered with file count */}
      <Divider className="pb-5" size="md" color="black" />
      <div className="relative w-full flex pb-3">
        <Title className="flex-grow text-center" order={3}>
          Specimen Summary
        </Title>
        <div className="absolute right-0 top-1/2 -translate-y-1/2">
          <Text>{numFiles as string} Files</Text>
        </div>
      </div>
      <div className="pb-5">
        <SimpleTable data={specimenTableData} />
      </div>
      <Divider className="pb-5" size="md" color="black" />
      {/* Related Specimens Tree by Sample Family ID */}
      <div className="pb-5">
        <Title className="pb-3 text-center" order={3}>
          Related Specimens by Sample Family ID: {specimen?.sample_family_id}
        </Title>
        {/*Mantine SegmentedControl to toggle graph view */}
        <div className="border border-gray-300 b border-b-xs rounded-t-md px-2 py-3">
          <div className="flex justify-left my-3">
            <SegmentedControl
              value={graphView ? 'graph' : 'dropdown'}
              onChange={(value) => setGraphView(value === 'graph')}
              data={[
                { label: 'Dropdown', value: 'dropdown' },
                { label: 'Graph', value: 'graph' },
              ]}
            />
          </div>
        </div>
        <div className="border border-t-0 border-gray-300 rounded-b-md px-2 py-3">
          <SpecimenTree
            projectId={specimen?.project_id as string}
            sampleFamilyId={specimen?.sample_family_id as string}
            sampleTypeField="sample_type"
            specimenId={id as string}
            graphView={graphView}
          />
        </div>
      </div>
      <Divider className="pb-5" size="md" color="black" />
      {/* Associated Files Table */}
      <div>
        <Title className="pb-3 text-center" order={3}>
          Files for Specimen {specimen?.identifier}
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
    </div>
  ) : (
    <div className="px-6">
      <Text>Could not load specimen details</Text>
    </div>
  );
};
