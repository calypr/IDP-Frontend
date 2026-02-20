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
import React, { useState } from 'react';
import SimpleTable from '../../../../frontend/src/features/SimpleTable/SimpleTable';
import {
  extractData,
  isQueryResponse,
  useGroupToSpecimenMapping,
} from './ResearchSubjectModal/tools';
import SpecimenTree from './SpecimenModal/SpecimenTree';

export const SpecimenDetailsPanel = ({
  id,
  tableConfig,
}: TableDetailsReportPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField ?? '';
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields ?? '';
  const filterField = tableConfig.detailsConfig?.filterField ?? '';

  const processedNodeFields = Object.keys(nodeFields ?? {}).join('\n');

  const [graphView, setGraphView] = useState(false);

  const {
    data: specimenData,
    isLoading: specimenIsLoading,
    isError: specimenIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      specimen(filter: $filter, accessibility: all, first: 1) {
        specimen_identifier
        specimen_indexed_collection_date_days
        specimen_sample_family_id
        specimen_sample_type
        specimen_collection
        specimen_tissue_type
        specimen_percent_tumor
        project_id
        specimen_patient_identifier
        specimen_patient_id
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              specimen_id: `${id}`,
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

  const {
    data: diagnosisData,
    isLoading: diagnosisIsLoading,
    isError: diagnosisIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      research_subject(filter: $filter, accessibility: all, first: 10000) {
        research_subject_condition_Diagnosis
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              research_subject_patient_id: `${specimen?.specimen_patient_id ?? ''}`,
            },
          },
        ],
      },
    },
  });

  const diagnosis = isQueryResponse(diagnosisData)
    ? extractData(diagnosisData, 'research_subject', '')?.[0]
        ?.research_subject_condition_Diagnosis
    : '';

  const specimenIdArr = [`${id}`];
  const {
    data: groupSpecimensMap,
    isLoading: groupIsLoading,
    isError: groupIsError,
  } = useGroupToSpecimenMapping(specimenIdArr);

  const groupIds = Object.keys(groupSpecimensMap ?? {});

  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      ${nodeType} (filter: $filter, accessibility: all, first: 10000) {
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
                  document_reference_group_id: groupIds,
                },
              },
            ],
          },
        ],
      },
    },
  });

  const {
    data: fileCountData,
    isLoading: fileIsLoading,
    isError: fileIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      _aggregation{
        document_reference(filter: $filter){
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
                  document_reference_group_id: groupIds,
                },
              },
            ],
          },
        ],
      },
    },
  });

  if (
    specimenIsLoading ||
    diagnosisIsLoading ||
    groupIsLoading ||
    isLoading ||
    fileIsLoading
  ) {
    return <LoadingOverlay visible />;
  }

  if (
    specimenIsError ||
    diagnosisIsError ||
    groupIsError ||
    isError ||
    fileIsError
  ) {
    return (
      <ErrorCard
        message={'Error occurred while fetching specimen details or files.'}
      />
    );
  }

  const modelTableConfig = nodeFields
    ? Object.entries(nodeFields).reduce(
        (acc, [key, value]) => {
          acc[key] = {
            title: fieldNameToTitle(value),
            field: key,
          };
          return acc;
        },
        {} as Record<string, { title: string; field: string }>,
      )
    : {};

  const numFiles =
    !fileIsLoading && isQueryResponse(fileCountData)
      ? fileCountData.data._aggregation.document_reference._totalCount
      : '';

  const subjectTableData = {
    'Clinical Trial': (specimen?.project_id as string) ?? '',
    'Participant ID': (specimen?.specimen_patient_identifier as string) ?? '',
    'Enrollment Diagnosis': diagnosis,
  };

  const specimenTableData = {
    'BEMS ID': (specimen?.specimen_identifier as string) ?? '',
    'Collection Date':
      (specimen?.specimen_indexed_collection_date_days as string) ?? '',
    'Sample Family ID': (specimen?.specimen_sample_family_id as string) ?? '',
    'Metastatis Site': (specimen?.specimen_collection as string) ?? '',
    'Sample Type': (specimen?.specimen_sample_type as string) ?? '',
    'Tissue Type': (specimen?.specimen_tissue_type as string) ?? '',
    'Percent Tumor': (specimen?.specimen_percent_tumor as string) ?? '',
  };

  return (
    <div className="mx-auto max-w-5xl flex flex-col gap-6 p-4">
      <Title className="pb-3 text-center" order={3}>
        Specimen Dynamic Reports Page
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
          Related Specimens by Sample Family ID:{' '}
          {specimen?.specimen_sample_family_id}
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
            sampleFamilyId={specimen?.specimen_sample_family_id as string}
            sampleTypeField="specimen_sample_type"
            specimenId={id as string}
            graphView={graphView}
          />
        </div>
      </div>
      <Divider className="pb-5" size="md" color="black" />
      {/* Associated Files Table */}
      <div>
        <Title className="pb-3 text-center" order={3}>
          Files for Specimen {specimen?.specimen_identifier}
        </Title>
        <div className="grid">
          <MatchingTable
            isLoading={isLoading}
            columns={modelTableConfig}
            index={nodeType ?? 'document_reference'}
            idField={idField}
            data={data}
          />
        </div>
      </div>
    </div>
  );
};
