import React, { useCallback } from 'react';
import { useDeepCompareMemo } from 'use-deep-compare';
import { fieldNameToTitle, JSONObject } from '@gen3/core';
import {
  MantineReactTable,
  type MRT_Column,
  type MRT_Row,
  useMantineReactTable,
} from 'mantine-react-table';
import { jsonPathAccessor } from '../../components/Tables/utils';
import { TableIcons } from '../../components/Tables/TableIcons';
import {
  CellRendererFunctionProps,
  SummaryTableColumn,
} from '../CohortBuilder/ExplorerTable/types';
import {
  CellRendererFunction,
  ExplorerTableCellRendererFactory,
} from '../CohortBuilder/ExplorerTable/ExplorerTableCellRenderers';

interface ExplorerColumn {
  field: string;
  accessorKey: never;
  header: string;
  accessorFn?: (originalRow: ExplorerColumn) => any;
  Cell?: CellRendererFunction;
  size?: number;
}

const DEFAULT_PAGE_LIMIT_LABEL = 'Rows per Page (Limited to 10,000):';
const DEFAULT_PAGE_LIMIT = 10000;

const isRecordAny = (obj: unknown): obj is Record<string, any> => {
  if (Array.isArray(obj)) return false;

  return obj !== null && typeof obj === 'object';
};

type MatchingTableProps = {
  isLoading: boolean;
  columns: Record<string, SummaryTableColumn>;
  idField: string;
  data: any;
  index: string;
};

const MatchingTable = ({
  isLoading,
  columns,
  data,
  index,
  idField,
}: MatchingTableProps) => {
  console.log('DATA? : ', data);
  const fields: string[] = Object.values(columns).map((col) => col.field);
  const cols = useDeepCompareMemo(() => {
    return fields.map((field) => {
      const columnDef = columns?.[field];
      const cellRendererFunc = columnDef?.type
        ? ExplorerTableCellRendererFactory().getRenderer(
            columnDef?.type,
            columnDef?.cellRenderFunction ?? 'default',
          )
        : undefined;

      const cellRendererFuncParams =
        columnDef?.params && isRecordAny(columnDef?.params)
          ? columnDef?.params
          : {};
      return {
        id: field,
        field: field,
        accessorKey: field as never,
        header: columnDef?.title ?? fieldNameToTitle(field),
        accessorFn: columnDef?.accessorPath
          ? jsonPathAccessor(columnDef.accessorPath)
          : undefined,
        Cell:
          cellRendererFunc && columnDef?.params
            ? (cell: CellRendererFunctionProps) =>
                cellRendererFunc(cell, cellRendererFuncParams)
            : cellRendererFunc
              ? cellRendererFunc
              : undefined,

        size: columnDef?.width,
        enableSorting: columnDef?.sortable ?? undefined,
      };
    }, [] as MRT_Column<ExplorerColumn>[]);
  }, [fields, columns]);

  const getRowId = useCallback((idField: string) => {
    return (
      originalRow: JSONObject,
      _index: number,
      _parentRow: MRT_Row<JSONObject>,
    ) =>
      idField && Object.keys(originalRow).includes(idField)
        ? (originalRow[idField] as string)
        : undefined;
  }, []);

  const { totalRowCount, limitLabel } = useDeepCompareMemo(() => {
    if (isLoading) {
      return { totalRowCount: 0, limitLabel: DEFAULT_PAGE_LIMIT_LABEL }; // or any fallback value when loading
    }
    const pageLimit = DEFAULT_PAGE_LIMIT;
    const totalRowCount = Math.min(
      pageLimit,
      data?.data._aggregation?.[index]._totalCount,
    );
    const limitLabel = DEFAULT_PAGE_LIMIT_LABEL;
    return { totalRowCount, limitLabel };
  }, [isLoading, fields, data, index]);
  /**
   * mantine-react-table setup
   * @see https://www.mantine-react-table.com/docs/api/table-options
   * @param columns - column options table config
   *   @see https://www.mantine-react-table.com/docs/api/column-options
   * @param data - data array, from useGetRawDataAndTotalCountsQuery()
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
  if (!isLoading) {
    console.log('DATA:? ', data);
  }
  const table = useMantineReactTable<JSONObject>({
    columns: cols as any[], //TODO: fix this
    data: data?.data?.[index] ?? [],
    enableColumnFilters: false,
    manualSorting: false,
    manualPagination: false,
    enableStickyHeader: true,
    paginateExpandedRows: false,
    enableTopToolbar: false,
    getRowId: getRowId(idField),
    rowCount: totalRowCount,
    icons: TableIcons,
    paginationDisplayMode: 'pages',
    enableRowSelection: false,
    localization: { rowsPerPage: limitLabel },

    mantinePaginationProps: {
      rowsPerPageOptions: ['5', '10', '20', '40', '100', '500'],
      withEdges: false, //note: changed from `showFirstLastButtons` in v1.0
    },
    mantineTableHeadCellProps: {
      style: {
        '--mrt-base-background-color': 'var(--mantine-color-table-1)',
        color: "var(--mantine-color-table-contrast-5')",
      },
    },
    state: {
      isLoading,
      density: 'xs',
    },
    mantineTableBodyRowProps: {},
  });
  return (
    <React.Fragment>
      <div className="inline-block overflow-x-scroll">
        <MantineReactTable table={table} />
      </div>
    </React.Fragment>
  );
};
export default MatchingTable;
