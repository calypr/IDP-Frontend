import {
  LoadingOverlay,
  Text,
  Title,
  CopyButton,
  ActionIcon,
  Tooltip,
  Divider,
  Container,
} from '@mantine/core';
import { fieldNameToTitle, useGeneralGQLQuery } from '@gen3/core';
import { MatchingTable } from '../../features/MatchingTable';
import ErrorCard from '../../components/ErrorCard';
import { type TableDetailsReportPanelProps } from '../../features/CohortBuilder';
import {
  MdContentCopy as IconCopy,
  MdCheck as IconCheck,
} from 'react-icons/md';
import { AssociatedFilesText } from './ResearchSubjectModal/AssociatedFiles';
import { SpecimenAggregationCountsChart } from './ResearchSubjectModal/AssociatedSpecimen';
import { AssaySummaryModal } from './ResearchSubjectModal/AssaySummaryModal';
import {
  extractData,
  isQueryResponse,
  useFilteredGroupMembers,
} from './ResearchSubjectModal/tools';
import { QueryContent, ResourceDict } from './types';
import { SimpleTable } from '../../features/SimpleTable';
import { useMemo } from 'react';

export const ResearchSubjectDetailsPanel = ({
  id,
  tableConfig,
}: TableDetailsReportPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;

  const processedNodeFields = useMemo(
    () => Object.keys(nodeFields ?? {}).join('\n'),
    [nodeFields],
  );

  const {
    data: rsData,
    isLoading: rsIsLoading,
    isError: rsIsError,
  } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
      research_subject(filter: $filter, accessibility: all, first: 1) {
        project_id
        research_subject_condition_Diagnosis
        research_subject_identifier
        research_subject_patient_id
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              research_subject_patient_id: `${id}`,
            },
          },
        ],
      },
    },
  });

  const {
    data: groupMemberData,
    isLoading: groupIsLoading,
    isError: groupIsError,
  } = useFilteredGroupMembers([`${id}`]);

  // This logic depends on the result of a hook, which is fine.
  const groupIds: string[] = useMemo(() => {
    if (isQueryResponse(groupMemberData)) {
      return (
        extractData(groupMemberData, 'group_member', '') as QueryContent
      ).map((groupMember) => groupMember.group_member_group_id);
    }
    return [];
  }, [groupMemberData]);

  const {
    data,
    isLoading: resourcesIsLoading,
    isError: resourcesIsError,
  } = useGeneralGQLQuery({
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
                  [filterField ?? 0]: [`${id}`],
                },
              },
              {
                IN: {
                  specimen_group_id: groupIds,
                },
              },
            ],
          },
        ],
      },
    },
  });

  if (rsIsLoading || groupIsLoading || resourcesIsLoading) {
    return (
      <Container size="xl" my="xl">
        <LoadingOverlay visible={true} />
      </Container>
    );
  }

  if (rsIsError || groupIsError || resourcesIsError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  const rs = isQueryResponse(rsData)
    ? extractData(rsData, 'research_subject', '')?.[0]
    : {};

  if (Object.keys(rs).length === 0) {
    return <ErrorCard message={'Error: ResearchSubject data not found.'} />;
  }

  if (!idField) {
    return (
      <ErrorCard message={'idField not configured in Tables Details Config'} />
    );
  }

  if (
    !isQueryResponse(data) ||
    !data.data[nodeType ?? ''] ||
    data.data[nodeType ?? ''].length === 0
  ) {
    return (
      <div className="px-6">
        <Text>
          No {nodeType}s found for {idField} {id}
        </Text>
      </div>
    );
  }

  const querySpecimenIds: string[] = Array.isArray(data.data[nodeType ?? ''])
    ? data.data[nodeType ?? ''].map((item: ResourceDict) => item.specimen_id)
    : [];

  const modelTableConfig = Object.entries(nodeFields ?? {}).reduce(
    (acc, [key, value]) => {
      acc[key] = {
        title: fieldNameToTitle(value),
        field: key,
      };
      return acc;
    },
    {} as Record<string, { title: string; field: string }>,
  );

  const subjectTableData = {
    'Clinical Trial': (rs?.research_subject_project_id as string) ?? '',
    'Condition Diagnosis':
      (rs?.research_subject_condition_Diagnosis as string) ?? '',
    'Participant ID': (rs?.research_subject_identifier as string) ?? '',
    'Patient ID': (rs?.research_subject_patient_id as string) ?? '',
  };

  return (
    <Container size="xl" my="xl">
      <div className="flex pb-7">
        <AssaySummaryModal ids={querySpecimenIds} />
        <div className="flex-grow text-center">
          <Title order={3}> Research Subject Dynamic Reports Page </Title>
        </div>
        <AssociatedFilesText specimenIds={querySpecimenIds} />
      </div>
      <div className="pb-5">
        <SimpleTable data={subjectTableData} />
      </div>
      <Divider size="md" color="black" />

      {querySpecimenIds.length > 0 && (
        <div className="grid grid-cols-2">
          <SpecimenAggregationCountsChart
            specimenIds={querySpecimenIds}
            title="Biopsies by Category"
            aggField="document_reference_data_category"
            countField="document_reference_specimen_sample_family_id"
          />
          <SpecimenAggregationCountsChart
            specimenIds={querySpecimenIds}
            aggField="document_reference_assay"
            title="Biopsies by Assay"
            countField="specimen_sample_family_id"
          />
        </div>
      )}
      <Divider size="md" color="black" />
      <div className="flex justify-center p-5 items-center">
        <div className="flex-grow text-center">
          <Title order={3}>Specimen Information Table</Title>
        </div>
        <div>
          <CopyButton value={JSON.stringify(data)} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? 'Copied' : 'Copy raw JSON data'}
                withArrow
                position="right"
              >
                <ActionIcon color={copied ? 'accent.4' : 'gray'} onClick={copy}>
                  {copied ? (
                    <IconCheck size="1rem" />
                  ) : (
                    <IconCopy size="1rem" />
                  )}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </div>
      </div>
      <div>
        <div className="grid">
          <MatchingTable
            isLoading={rsIsLoading || groupIsLoading || resourcesIsLoading}
            columns={modelTableConfig}
            index={nodeType ?? 'document_reference'}
            idField={idField}
            data={data}
          />
        </div>
      </div>
    </Container>
  );
};
