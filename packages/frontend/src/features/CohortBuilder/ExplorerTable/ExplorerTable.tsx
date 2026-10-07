import React, { useCallback, useMemo, useState } from 'react';
import { skipToken } from '@reduxjs/toolkit/query';
import { useDeepCompareMemo } from 'use-deep-compare';
import {
  CoreState,
  convertFilterSetToLoomFilters,
  isJSONValue,
  JSONObject,
  selectIndexFilters,
  useCoreSelector,
  useGetLoomTableRenderQuery,
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
import { renderCell } from '../../../utils/renderCell';
import { useExplorerTableNotifications } from '../../../hooks/explorerViewer/useExplorerTableNotifications';
import {
  currentQueryNavigation,
  initialQueryNavigation,
  moveQueryNavigation,
} from './queryNavigation';

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
  loomDataset,
  loomProjectIds,
  loomActiveDataset,
  facetSpecs,
  tableRenderSignature,
  onTableRender,
  onTableRenderState,
}: ExplorerTableProps) => {
  const [pageSize, setPageSize] = useState(10);

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
        return renderCell(selectedRow[field]);
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

  const loomIdentity = useMemo(
    () =>
      loomDataset
        ? ({ selector: loomDataset, projectIds: loomProjectIds } as const)
        : null,
    [loomDataset, loomProjectIds],
  );
  const loomFilters = useMemo(() => {
    try {
      return {
        filters: convertFilterSetToLoomFilters(cohortFilters),
        error: null,
      };
    } catch (error) {
      return {
        filters: [],
        error:
          error instanceof Error ? error.message : 'Unsupported Loom filter',
      };
    }
  }, [cohortFilters]);
  const activeDataset = loomActiveDataset;
  const queryFields = useMemo(
    () => includeAvailableSha256(fields, activeDataset?.columns),
    [activeDataset?.columns, fields],
  );
  const querySignature = useMemo(
    () =>
      JSON.stringify({
        loomIdentity,
        loomFilters: loomFilters.filters,
        sorting,
        pageSize,
        facetSpecs,
      }),
    [facetSpecs, loomIdentity, loomFilters.filters, pageSize, sorting],
  );
  const [navigation, setNavigation] = useState(() =>
    initialQueryNavigation(querySignature),
  );
  const activeNavigation = currentQueryNavigation(navigation, querySignature);
  const pagination = {
    pageIndex: activeNavigation.pageIndex,
    pageSize,
  } satisfies MRT_PaginationState;

  const {
    data: tableRender,
    isLoading,
    isError: isRowsError,
    isFetching,
  } = useGetLoomTableRenderQuery(
    loomIdentity
      ? {
          ...loomIdentity,
          columns: queryFields,
          filters: loomFilters.filters,
          first: pagination.pageSize,
          after: activeNavigation.cursors[pagination.pageIndex] ?? null,
          sort: sorting[0]
            ? { column: sorting[0].id, desc: sorting[0].desc }
            : undefined,
          facets:
            pagination.pageIndex === 0 && facetSpecs?.length
              ? facetSpecs
              : undefined,
        }
      : skipToken,
    {
      skip: !loomIdentity || !!loomFilters.error,
    },
  );
  useExplorerTableNotifications({
    response: tableRender,
    requestSignature: tableRenderSignature,
    isFetching,
    isError: isRowsError,
    onResponse: onTableRender,
    onStateChange: onTableRenderState,
  });

  const setTablePagination = useCallback(
    (
      updater:
        | MRT_PaginationState
        | ((current: MRT_PaginationState) => MRT_PaginationState),
    ) => {
      const next =
        typeof updater === 'function' ? updater(pagination) : updater;
      if (next.pageSize !== pageSize) {
        setPageSize(next.pageSize);
        setNavigation(initialQueryNavigation(querySignature));
        return;
      }
      setNavigation((current) =>
        moveQueryNavigation({
          navigation: current,
          querySignature,
          pageIndex: next.pageIndex,
          nextCursor: tableRender?.pageInfo?.endCursor ?? undefined,
        }),
      );
    },
    [pageSize, pagination, querySignature, tableRender?.pageInfo?.endCursor],
  );

  const data = useMemo<JSONObject[]>(
    () => [...(tableRender?.rows ?? [])],
    [tableRender?.rows],
  );
  const isError = isRowsError;

  const { totalRowCount, limitLabel } = useDeepCompareMemo(() => {
    const pageLimit =
      (tableConfig?.pageLimit && tableConfig?.pageLimit?.limit) ??
      DEFAULT_PAGE_LIMIT;
    const totalRowCount = tableConfig?.pageLimit
      ? Math.min(
          pageLimit,
          tableRender?.totalCount ??
            activeDataset?.rowCount ??
            pagination.pageSize,
        )
      : (tableRender?.totalCount ??
        activeDataset?.rowCount ??
        pagination.pageSize);
    const limitLabel = tableConfig?.pageLimit
      ? (tableConfig?.pageLimit?.label ?? DEFAULT_PAGE_LIMIT_LABEL)
      : 'Rows per Page:';
    return { totalRowCount, limitLabel };
  }, [
    activeDataset?.rowCount,
    pagination.pageSize,
    tableConfig,
    tableRender?.totalCount,
    index,
  ]);
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
  if (!loomIdentity) {
    return <ErrorCard message={`Unsupported Explorer data type: ${index}`} />;
  }
  if (loomFilters.error) {
    return <ErrorCard message={loomFilters.error} />;
  }
  if (activeDataset && activeDataset.state !== 'READY') {
    return (
      <ErrorCard
        message={`Loom dataset is ${activeDataset.state.toLowerCase()}${activeDataset.error ? `: ${activeDataset.error}` : ''}`}
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
              loomDataset,
              loomProjectIds,
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
