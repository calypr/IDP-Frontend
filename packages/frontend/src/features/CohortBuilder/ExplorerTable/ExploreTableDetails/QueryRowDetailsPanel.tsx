import React, { useEffect, useMemo } from 'react';
import { LoadingOverlay, Stack, Table, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  convertFilterSetToLoomFilters,
  isLoomDataType,
  useGetLoomDatasetQuery,
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
}: TableDetailsPanelProps) => {
  //const [queryGuppy, { data, isLoading, isError }] = useLazyGeneralGQLQuery();
  const idField = tableConfig.detailsConfig?.idField;
  const simpleDetailsView = tableConfig.detailsConfig?.simpleDetailsView;
  const { setStudyDetails } = useStudyContext();
  const [opened, { open, close }] = useDisclosure(false);

  const loomDataType = isLoomDataType(index) ? index : null;
  const loomIdentity = loomDataset
    ? ({ selector: loomDataset } as const)
    : loomDataType
      ? ({ dataType: loomDataType } as const)
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
    data: dataset,
    isError: isDatasetError,
    isLoading: isDatasetLoading,
  } = useGetLoomDatasetQuery(loomDataType ?? 'DocumentReference', {
    skip: !loomDataType || Boolean(loomDataset),
  });
  const {
    data: selectedDataset,
    isError: isSelectedDatasetError,
    isLoading: isSelectedDatasetLoading,
  } = useGetLoomDatasetBySelectorQuery(
    {
      selector: loomDataset ?? {
        recipe: '',
        translationVersion: '',
        output: '',
      },
    },
    { skip: !loomDataset },
  );
  const activeDataset = loomDataset ? selectedDataset : dataset;
  const {
    data,
    isError: isRowsError,
    isFetching,
  } = useGetLoomRowsQuery(
    {
      ...(loomIdentity ?? { dataType: 'DocumentReference' as const }),
      columns: tableConfig.fields as string[],
      filters: loomFilters.filters,
      first: 1,
    },
    {
      skip: !loomIdentity || !idField || !id || !!loomFilters.error,
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
    return <ErrorCard message={`Unsupported Explorer data type: ${index}`} />;
  }
  if (loomFilters.error) {
    return <ErrorCard message={loomFilters.error} />;
  }
  if (isDatasetError || isSelectedDatasetError || isRowsError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }
  if (isDatasetLoading || isSelectedDatasetLoading) {
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
