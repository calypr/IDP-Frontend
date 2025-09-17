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
import { type TableDetailsPanelProps } from '../../features/CohortBuilder';
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

export const ResearchSubjectDetailsPanel = ({
  id, // The table value corresponding to the column name 'idField'
  tableConfig,
}: TableDetailsPanelProps) => {
  const idField = tableConfig.detailsConfig?.idField;
  const nodeType = tableConfig.detailsConfig?.nodeType;
  const nodeFields = tableConfig.detailsConfig?.nodeFields;
  const filterField = tableConfig.detailsConfig?.filterField;

  const processedNodeFields = Object.keys(nodeFields ?? {}).join('\n');

  // get any Groups this Patient is associated with
  const {
    data: groupMemberData,
    isLoading: groupIsLoading,
    isError: groupIsError,
  } = useFilteredGroupMembers([`${id}`]);

  const groupIds: string[] = isQueryResponse(groupMemberData)
    ? (extractData(groupMemberData, 'groupmember', '') as QueryContent).map(
        (groupMember) => groupMember.group_id,
      )
    : [];

  // get resources of type nodeType associated with patient
  // for syntax, see Guppy docs
  // https://github.com/uc-cdis/guppy/blob/master/doc/queries.md#combine-into-advanced-filters
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
            OR: [
              {
                IN: {
                  [filterField ?? 0]: [`${id}`],
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
      ? data.data[nodeType ?? 'researchsubject'].map((item: ResourceDict) => {
          return item.id;
        })
      : []
    : [];

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

  return !isLoading ? (
    <Container size="xl" my="xl">
      <LoadingOverlay visible={isLoading} />
      <div className="flex pb-7">
        <AssaySummaryModal ids={querySpecimenIds} />
        <div className="flex-grow text-center">
          <Title order={3}> Sample Dynamic Reports Page </Title>
        </div>
        <AssociatedFilesText specimenIds={querySpecimenIds} />
      </div>

      <Divider size="md" color="black" />
      <div className="grid grid-cols-2">
        <SpecimenAggregationCountsChart
          specimenIds={querySpecimenIds}
          title={'Biopsies by Category'}
          aggField={'data_category'}
          countField={'specimen_sample_family_id'}
        />
        <SpecimenAggregationCountsChart
          specimenIds={querySpecimenIds}
          aggField={'assay'}
          title={'Biopsies by Assay'}
          countField={'specimen_sample_family_id'}
        />
      </div>
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
            isLoading={isLoading}
            columns={modelTableConfig}
            index={nodeType ?? 'file'}
            idField={idField}
            data={data}
          />
        </div>
      </div>
    </Container>
  ) : (
    <div className="px-6">
      <Text>
        {' '}
        No {nodeType}s found for {idField} {id}
      </Text>
    </div>
  );
};
