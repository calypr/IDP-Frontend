import React, { useEffect, useMemo } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { LoadingOverlay, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  convertFilterSetToLoomFilters,
  useGetLoomDatasetBySelectorQuery,
  useGetLoomRowsQuery,
} from '@gen3/core';
import { MdKeyboardDoubleArrowLeft as BackIcon } from 'react-icons/md';
import ErrorCard from '../../../../components/MessageCards/ErrorCard';
import { TableDetailsPanelProps } from './types';
import { buildNested } from '../../../../components/facets';
import { JSONPath } from 'jsonpath-plus';
import { isArray } from 'lodash';
import { useStudyContext } from '../../../Study/StudyProvider';
import { SinglePageStudyDetailsPanel } from '../../../Study';
import { includeAvailableSha256 } from '../utils';

const ExtractData = (
  row: Record<string, any> | undefined,
  path?: string,
): Record<string, any> => {
  if (!row) return {};

  let rowData = row;
  if (path) {
    const tmp = JSONPath({ path: path, json: row });
    if (!isArray(tmp)) {
      return {};
    }
    if (tmp.length > 0) {
      rowData = tmp[0];
    }
  }

  return rowData;
};

export const QueryRowDetailsPanel = ({
  id,
  index,
  tableConfig,
  accessibility,
  loomDataset,
  loomProjectIds,
}: TableDetailsPanelProps) => {
  //const [queryGuppy, { data, isLoading, isError }] = useLazyGeneralGQLQuery();
  const idField = tableConfig.detailsConfig?.idField;
  const simpleDetailsView = tableConfig.detailsConfig?.simpleDetailsView;
  const { setStudyDetails } = useStudyContext();
  const [opened, { open, close }] = useDisclosure(false);

  const loomIdentity = loomDataset
    ? ({ selector: loomDataset, projectIds: loomProjectIds } as const)
    : null;
  const loomFilters = useMemo(() => {
    if (!idField || !id) return { filters: [], error: null };
    try {
      return {
        filters: convertFilterSetToLoomFilters({
          mode: 'and',
          root: {
            [idField]: buildNested(idField, {
              operator: '=',
              field: idField,
              operand: id,
            }),
          },
        }),
        error: null,
      };
    } catch (error) {
      return {
        filters: [],
        error:
          error instanceof Error ? error.message : 'Unsupported Loom filter',
      };
    }
  }, [id, idField]);
  const {
    data: selectedDataset,
    isError: isSelectedDatasetError,
    isLoading: isSelectedDatasetLoading,
  } = useGetLoomDatasetBySelectorQuery(
    loomIdentity ?? skipToken,
  );
  const activeDataset = selectedDataset;
  const {
    data,
    isError: isRowsError,
    isFetching,
  } = useGetLoomRowsQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          columns: includeAvailableSha256(
            tableConfig.fields,
            activeDataset?.columns,
          ),
          filters: loomFilters.filters,
          first: 1,
        }
      : skipToken,
    {
      skip:
        !loomIdentity ||
        !activeDataset ||
        !idField ||
        !id ||
        !!loomFilters.error,
    },
  );

  const queryData = useMemo(
    () => ExtractData(data?.rows?.[0], tableConfig?.detailsConfig?.dataPath),
    [data, tableConfig?.detailsConfig?.dataPath],
  );

  useEffect(() => {
    setStudyDetails(queryData);
  }, [queryData, setStudyDetails]);

  if (!idField) {
    return (
      <ErrorCard message={'idField not configure in Tables Details Config'} />
    );
  }

  if (!loomIdentity) {
    return (
      <ErrorCard
        message={`No published Loom dataset selector is available for Explorer output ${index}`}
      />
    );
  }
  if (loomFilters.error) {
    return <ErrorCard message={loomFilters.error} />;
  }
  if (isSelectedDatasetError || isRowsError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }
  if (isSelectedDatasetLoading) {
    return <LoadingOverlay visible />;
  }
  if (!activeDataset || activeDataset.state !== 'READY') {
    return <ErrorCard message="Loom dataset is not ready for detail lookup" />;
  }

  // Inital attempt at using Study Details component

  return (
    <Stack>
      <LoadingOverlay visible={isFetching} />
      {simpleDetailsView ? (
        <SinglePageStudyDetailsPanel
          data={queryData ?? {}}
          studyConfig={simpleDetailsView}
        />
      ) : (
        <div>Study Details Panel not configured</div>
      )}
    </Stack>
  );
};

export default QueryRowDetailsPanel;
