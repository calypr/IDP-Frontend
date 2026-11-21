import React, { useCallback, useRef } from 'react';
import { MantineReactTable, useMantineReactTable } from 'mantine-react-table';
import { JSONObject } from '@gen3/core';
import type { ExplorerTableSubTableProps } from './types';
import { TableIcons } from '../../../../components/Tables/TableIcons';

const ExplorerTableSubTable = ({
  columns,
  data,
  setHeaderHeight = () => {},
}: ExplorerTableSubTableProps) => {
  const table = useMantineReactTable<JSONObject>({
    columns: columns,
    data: data ?? [],
    enablePagination: false,
    enableTableFooter: false,
    enableTopToolbar: false,
    enableBottomToolbar: false,
    enableColumnResizing: true,
    icons: TableIcons,
    layoutMode: 'grid-no-grow',
    defaultColumn: {
      minSize: 300,
      maxSize: 1000,
      size: 360,
    },
    mantineTableProps: {
      style: {
        borderRadius: '0rem 0rem 0rem 0rem',
        backgroundColor: 'var(--mantine-color-base-1)',
        '--mrt-striped-row-background-color': 'var(--mantine-color-base-3)',
        fontSize: 'var(--mantine-font-size-sm)',
        zIndex: 10,
        '-mrt-border-color': 'var(--mantine-color-table-1)',
      },
    },
    mantineTableHeadProps: {
      style: {
        '--mrt-base-background-color': 'var(--mantine-color-secondary-1)',
        firstChild: {
          borderRadius: '0rem 0rem 0rem 0rem',
        },
      },
    },
    mantineTableHeadCellProps: {
      style: {
        '--mrt-base-background-color': 'var(--mantine-color-secondary-1)',
        color: `var(--mantine-color-secondary-contrast-1')`,
        padding: '0.2rem',
        paddingLeft: '1.5rem',
        borderBottom: 'none',
        borderTop: 'none',
        borderRight: '1px solid var(--mantine-color-table-1)',
        firstChild: {
          borderRadius: '0rem 0rem 0rem 0rem',
        },
      },
    },
  });

  const resizeObserver = useRef<ResizeObserver | undefined>(undefined);
  const observeTable = useCallback(
    (container: HTMLDivElement | null) => {
      resizeObserver.current?.disconnect();
      resizeObserver.current = undefined;
      const header = container?.querySelector('thead');
      if (!header) return;
      const updateHeaderHeight = () =>
        setHeaderHeight(header.getBoundingClientRect().height);
      updateHeaderHeight();
      resizeObserver.current = new ResizeObserver(updateHeaderHeight);
      resizeObserver.current.observe(header);
    },
    [setHeaderHeight],
  );

  return (
    <div ref={observeTable}>
      <MantineReactTable table={table} />
    </div>
  );
};

export default ExplorerTableSubTable;
