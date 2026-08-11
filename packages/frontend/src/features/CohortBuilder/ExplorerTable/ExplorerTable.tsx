import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDeepCompareMemo } from 'use-deep-compare';
import {
  CoreState,
  convertFilterSetToLoomFilters,
  isLoomDataType,
  isJSONValue,
  JSONObject,
  selectIndexFilters,
  useCoreSelector,
  useGetLoomDatasetQuery,
  useGetLoomRowsQuery,
} from '@gen3/core';
import {
  MantineReactTable,
  type MRT_PaginationState,
  type MRT_Row,
  type MRT_RowSelectionState,
  type MRT_SortingState,
  useMantineReactTable,
} from 'mantine-react-table';
import { TableIcons } from '../../../components/Tables/TableIcons';
import type { ExplorerTableProps, SummaryTable } from './types';
import { type TableDetailsPanelProps } from './ExploreTableDetails';
import { DetailsModal, DetailsDrawer } from '../../../components/Details';
import { createTableColumns, includeAvailableSha256 } from './utils';
import SubtableStack from './SubTables/SubtableStack';
import { JSONPath } from 'jsonpath-plus';
import { StudyProvider } from '../../Study';
import QueryRowDetailsPanel from './ExploreTableDetails/QueryRowDetailsPanel';
import { ErrorCard } from '../../../components/MessageCards';

const DEFAULT_PAGE_LIMIT_LABEL = 'Rows per Page (Limited to 10,0000):';
const DEFAULT_PAGE_LIMIT = 10000;

/**
 * Main table component for the Explorer page. Fetches canonical Loom rows and
 * adapts them to the existing table contract.
 *
 * @param index - Offset to use for fetching/displaying pages of rows
 * @param tableConfig - Inherited from ExplorerPageGetServerSideProps
 * @param accessibility - set the access level for the cohort data
 */
const ExplorerTable = ({
  index,
  tableConfig,
  accessibility,
  classNames,
  size = 'sm',
  fileActions,
}: ExplorerTableProps) => {
  const [pagination, setPagination] = useState<MRT_PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const DetailsComponent = useMemo(() => {
    if (
      !tableConfig?.detailsConfig ||
      !tableConfig?.detailsConfig?.panel ||
      tableConfig?.detailsConfig?.mode === 'none'
    )
      return null;
    return tableConfig?.detailsConfig?.panelContainer === 'drawer'
      ? DetailsDrawer<TableDetailsPanelProps>
      : DetailsModal<TableDetailsPanelProps>;
  }, []);

  const [sorting, setSorting] = useState<MRT_SortingState>([]);
  const [rowSelection, setRowSelection] = useState<MRT_RowSelectionState>({});
  const [selectedRow, setSelectedRow] = useState<
    MRT_Row<Record<string, any>> | undefined
  >(undefined);

  // const DetailsPanel = useMemo(
  //   () =>
  //     ExplorerTableDetailsPanelFactory().getRenderer(
  //       'tableDetails',
  //       tableConfig?.detailsConfig?.panel ?? 'default',
  //     ),
  //   [tableConfig?.detailsConfig?.panel],
  // );

  const DetailsPanel = useMemo(() => QueryRowDetailsPanel, []);

  const tableColumns = useDeepCompareMemo(() => {
    return createTableColumns(tableConfig, fileActions);
  }, [tableConfig, fileActions]);

  const initialColumnVisibility = useDeepCompareMemo(() => {
    const visibility: Record<string, boolean> = {
      'mrt-row-expand': false, // Keep expand column hidden by default
    };

    // Set visibility for each column based on config
    tableConfig.fields.forEach((field) => {
      const columnDef = tableConfig.columns?.[field];
      if (columnDef?.visible === false) {
        visibility[field] = false;
      }
    });

    return visibility;
  }, [tableConfig]);

  // TODO: add support for nested fields
  const fields = useMemo(
    () => tableColumns.map((column) => column.field),
    [tableColumns],
  );

  // Returns a value in the selected table row
  const getFieldValue = useCallback(
    (
      tableConfig: SummaryTable,
      rowSelection: MRT_RowSelectionState,
      data: JSONObject[],
      field: string,
    ): string => {
      const { detailsConfig } = tableConfig || {};
      const idField: string | undefined = detailsConfig?.idField;
      const selectedRowId = Object.keys(rowSelection).at(0);
      if (!selectedRowId || !data) {
        return 'Default Placeholder';
      }
      const selectedRow = data.find(
        (row) => row[idField ?? ''] === selectedRowId,
      );

      if (selectedRow && field in selectedRow) {
        return selectedRow[field] as string;
      }
      return 'Default Placeholder';
    },
    [],
  );
  const getRowId = useCallback((tableConfig: SummaryTable) => {
    const { detailsConfig } = tableConfig || {};
    const idField: string | undefined = detailsConfig?.idField;
    if (!idField) return undefined;

    return (originalRow: JSONObject) => {
      const id = JSONPath({ json: originalRow, path: idField });

      if (id.length > 0) {
        return id[0];
      } else {
        return undefined;
      }
    };
  }, []);

  const cohortFilters = useCoreSelector((state: CoreState) =>
    selectIndexFilters(state, index),
  );

  const loomDataType = isLoomDataType(index) ? index : null;
  const loomFilters = useMemo(() => {
    try {
      return {
        filters: convertFilterSetToLoomFilters(cohortFilters),
        error: null,
      };
    } catch (error) {
      return {
        filters: [],
        error: error instanceof Error ? error.message : 'Unsupported Loom filter',
      };
    }
  }, [cohortFilters]);
  const {
    data: dataset,
    isError: isDatasetError,
    isLoading: isDatasetLoading,
  } = useGetLoomDatasetQuery(loomDataType ?? 'DocumentReference', {
    skip: !loomDataType,
  });
  const queryFields = useMemo(
    () => includeAvailableSha256(fields, dataset?.columns),
    [dataset?.columns, fields],
  );
  const [cursorLedger, setCursorLedger] = useState<Record<number, string | null>>({
    0: null,
  });
  const querySignature = useMemo(
    () =>
      JSON.stringify({
        loomDataType,
        loomFilters: loomFilters.filters,
        sorting,
        pageSize: pagination.pageSize,
      }),
    [loomDataType, loomFilters.filters, sorting, pagination.pageSize],
  );
  useEffect(() => {
    setCursorLedger({ 0: null });
    setPagination((current) => ({ ...current, pageIndex: 0 }));
  }, [querySignature]);

  const {
    data: loomRows,
    isLoading,
    isError: isRowsError,
    isFetching,
  } = useGetLoomRowsQuery(
    {
      dataType: loomDataType ?? 'DocumentReference',
      columns: queryFields,
      filters: loomFilters.filters,
      first: pagination.pageSize,
      after: cursorLedger[pagination.pageIndex] ?? null,
      sort: sorting[0]
        ? { column: sorting[0].id, desc: sorting[0].desc }
        : undefined,
    },
    { skip: !loomDataType || !!loomFilters.error },
  );
  useEffect(() => {
    const nextCursor = loomRows?.pageInfo?.endCursor;
    if (nextCursor) {
      setCursorLedger((current) =>
        current[pagination.pageIndex + 1] === nextCursor
          ? current
          : { ...current, [pagination.pageIndex + 1]: nextCursor },
      );
    }
  }, [loomRows, pagination.pageIndex]);

  const setTablePagination = useCallback(
    (
      updater:
        | MRT_PaginationState
        | ((current: MRT_PaginationState) => MRT_PaginationState),
    ) => {
      setPagination((current) => {
        const next =
          typeof updater === 'function' ? updater(current) : updater;
        return next.pageIndex === 0 || next.pageIndex in cursorLedger
          ? next
          : current;
      });
    },
    [cursorLedger],
  );

  const data = useMemo<JSONObject[]>(
    () => [...(loomRows?.rows ?? [])],
    [loomRows?.rows],
  );
  const isError = isRowsError || isDatasetError;

  const { totalRowCount, limitLabel } = useDeepCompareMemo(() => {
    const pageLimit =
      (tableConfig?.pageLimit && tableConfig?.pageLimit?.limit) ??
      DEFAULT_PAGE_LIMIT;
    const totalRowCount = tableConfig?.pageLimit
      ? Math.min(
          pageLimit,
          loomRows?.totalCount ?? dataset?.rowCount ?? pagination.pageSize,
        )
      : (loomRows?.totalCount ?? dataset?.rowCount ?? pagination.pageSize);
    const limitLabel = tableConfig?.pageLimit
      ? (tableConfig?.pageLimit?.label ?? DEFAULT_PAGE_LIMIT_LABEL)
      : 'Rows per Page:';
    return { totalRowCount, limitLabel };
  }, [tableConfig, data, pagination.pageSize, index]);
  /**
   * mantine-react-table setup
   * @see https://www.mantine-react-table.com/docs/api/table-options
   * @param columns - column options table config
   *   @see https://www.mantine-react-table.com/docs/api/column-options
   * @param data - data array, from the Loom row adapter
   * @param manualSorting - If this is true, you will be expected to sort your data before it is passed to the table.
   * @param manualPagination - If this is true, you will be expected to manually paginate the rows before passing them to the table
0.
   * @param paginateExpandedRows - If true expanded rows will be paginated along with the rest of the table (which means expanded rows may span multiple pages)      -
   * @param onPaginationChange - If this function is provided, it will be called when the pagination state changes and you will be expected to manage the state yourself
   * @param onSortingChange - If provided, this function will be called with an updaterFn when variable state. sorting changes. Overrides default internal state management
   * @param enableTopToolbar - enables additional ux features
   * @param rowCount - Number of rows in the table
   * @param tableConfig - Inherited from ExplorerPageGetServerSideProps
   * @param {Partial<MRT_TableState<TData>>} state - State management configs
   *   @see https://www.mantine-react-table.com/docs/guides/state-management#manage-individual-states-as-needed
   */

  const table = useMantineReactTable<JSONObject>({
    columns: tableColumns as any[], //TODO: fix this
    data,
    enableColumnFilters: false,
    manualSorting: true,
    manualPagination: true,
    enableStickyHeader: true,
    paginateExpandedRows: false,
    onPaginationChange: setTablePagination,
    onSortingChange: setSorting,
    enableTopToolbar: false,
    enableExpandAll: false,
    displayColumnDefOptions: {
      'mrt-row-expand': {
        enableHiding: true, //now row numbers are hidable too
      },
    },
    enableExpanding: !!tableConfig?.detailsConfig,
    getRowId: getRowId(tableConfig),
    rowCount: totalRowCount,
    icons: TableIcons,
    paginationDisplayMode: 'pages',
    enableRowSelection: tableConfig?.selectableRows ?? false,
    localization: { rowsPerPage: limitLabel },
    // mantineExpandAllButtonProps: {
    //   style: {
    //     visibility: 'hidden',
    //   },
    // },
    // mantineExpandButtonProps: {
    //   style: {
    //     visibility: 'hidden',
    //   },
    // },
    mantineTableProps: {
      style: {
        backgroundColor: 'var(--mantine-color-base-1)',
        '--mrt-striped-row-background-color': 'var(--mantine-color-base-3)',
        fontSize: `var(--mantine-font-size-${size})`,
        zIndex: 10,
      },
    },
    mantinePaginationProps: {
      rowsPerPageOptions: ['5', '10', '20', '40', '100'],
      withEdges: false, //note: changed from `showFirstLastButtons` in v1.0
    },

    mantineTableHeadCellProps: {
      style: {
        '--mrt-base-background-color': 'var(--mantine-color-table-1)',
        color: `var(--mantine-color-table-contrast-5')`,
      },
      // sx: (theme) => {
      //   return {
      //     backgroundColor: theme.colors.table[1],
      //     color: theme.colors['table-contrast'][5],
      //     textAlign: 'center',
      //     padding: theme.spacing.md,
      //     fontWeight: 'bold',
      //     fontSize: theme.fontSizes.lg,
      //   };
      // },
    },
    state: {
      isLoading,
      pagination,
      sorting,
      showProgressBars: isFetching,
      showAlertBanner: isError,
      density: 'xs',
      rowSelection: rowSelection,
      columnVisibility: initialColumnVisibility,
    },
    mantineTableBodyRowProps:
      tableConfig.detailsConfig?.mode === 'click'
        ? ({ row }) => ({
            onClick: () => {
              if (Object.keys(rowSelection).includes(row.id)) {
                setRowSelection({});
                setSelectedRow(undefined);
              } else {
                setRowSelection({ [row.id as string]: true });
                setSelectedRow(row as any); // TODO: fix this typecast
              }
            },
            sx: {
              cursor: 'pointer', //you might want to change the cursor too when adding an onClick
            },
          })
        : {},
    renderDetailPanel:
      tableConfig.detailsConfig?.mode === 'expand' || tableConfig?.subTables
        ? ({ row }) => {
            const val = tableConfig?.subTables?.some((subTable) => {
              if (
                subTable.root in row.original &&
                isJSONValue(row.original[subTable.root])
              ) {
                return (
                  Object.values(row.original[subTable.root] as JSONObject)
                    .length > 0
                );
              } else return false;
            });
            if (tableConfig?.subTables && val) {
              return (
                <SubtableStack
                  subTables={tableConfig.subTables}
                  data={row.original ?? []}
                />
              );
            } else return null;
          }
        : undefined,
  });
  if (!loomDataType) {
    return <ErrorCard message={`Unsupported Explorer data type: ${index}`} />;
  }
  if (loomFilters.error) {
    return <ErrorCard message={loomFilters.error} />;
  }
  if (isDatasetError) {
    return <ErrorCard message="Unable to discover the authorized Loom dataset" />;
  }
  if (isDatasetLoading) {
    return (
      <div className="flex items-center justify-center w-full h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }
  if (!dataset) {
    return <ErrorCard message="No authorized Loom dataset is available for this Explorer tab" />;
  }
  if (dataset.state !== 'READY') {
    return (
      <ErrorCard
        message={`Loom dataset is ${dataset.state.toLowerCase()}${dataset.error ? `: ${dataset.error}` : ''}`}
      />
    );
  }

  return (
    <React.Fragment>
      <StudyProvider>
        {DetailsComponent && (
          <DetailsComponent
            title={`${String(tableConfig?.detailsConfig?.nodeType).charAt(0).toUpperCase() + String(tableConfig?.detailsConfig?.nodeType).slice(1)} / ${getFieldValue(
              tableConfig,
              rowSelection,
              data,
              'project_id',
            )} / ${getFieldValue(
              tableConfig,
              rowSelection,
              data,
              tableConfig?.detailsConfig?.title as string,
            )}`}
            id={
              Object.keys(rowSelection).length > 0
                ? Object.keys(rowSelection).at(0)
                : undefined
            }
            row={selectedRow}
            onClose={() => setRowSelection({})}
            panel={DetailsPanel}
            classNames={tableConfig?.detailsConfig?.classNames}
            panelProps={{
              index,
              tableConfig,
              ...(tableConfig?.detailsConfig?.params ?? {}),
              accessibility,
            }}
          />
        )}
        <div className="inline-block overflow-x-scroll">
          <MantineReactTable table={table} />
        </div>
      </StudyProvider>
    </React.Fragment>
  );
};

export default ExplorerTable;
