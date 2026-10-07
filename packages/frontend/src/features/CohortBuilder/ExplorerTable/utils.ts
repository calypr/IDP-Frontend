import { fieldNameToTitle } from '@gen3/core';
import type {
  CellRendererFunctionProps,
  TableColumnsAndFields,
  ExplorerColumn,
  ExplorerTableColumnMRT,
} from './types';
import { type MRT_Column } from 'mantine-react-table';
import {
  ExplorerTableCellRendererFactory,
  RenderArrayCell,
  ValueCellRenderer,
} from './ExplorerTableCellRenderers';
import { FileActionsConfig } from '../types';
import { jsonPathAccessor } from '../../../components/Tables/utils';
import { ArrayCellRenderer } from './ArrayCellRenderer';

export const isRecordAny = (obj: unknown): obj is Record<string, any> => {
  if (Array.isArray(obj)) return false;

  return obj !== null && typeof obj === 'object';
};

export const publicLoomFields = (fields: ReadonlyArray<string>) =>
  fields.filter(
    (field) => field !== 'auth_resource_path' && !field.startsWith('__loom_'),
  );

export const includeAvailableSha256 = (
  fields: ReadonlyArray<string>,
  datasetColumns?: ReadonlyArray<{ name: string }>,
): ReadonlyArray<string> =>
  (() => {
    const available = datasetColumns
      ? new Set(datasetColumns.map((column) => column.name))
      : undefined;
    const publicFields = publicLoomFields(fields).filter(
      (field) => !available || available.has(field),
    );
    return datasetColumns?.some((column) => column.name === 'sha256') &&
      !publicFields.includes('sha256')
      ? [...publicFields, 'sha256']
      : publicFields;
  })();

export const createTableColumns = (
  tableConfig: TableColumnsAndFields,
  fileActions?: FileActionsConfig,
): ExplorerTableColumnMRT[] => {
  return publicLoomFields(tableConfig.fields).map((field) => {
    const columnDef = tableConfig?.columns?.[field];

    const cellRendererFunc = columnDef?.type
      ? ExplorerTableCellRendererFactory().getRenderer(
          columnDef?.type,
          columnDef?.cellRenderFunction ?? 'default',
        )
      : undefined;

    const cellRendererFuncParams =
      columnDef?.params && isRecordAny(columnDef?.params)
        ? { ...columnDef?.params, fileActions }
        : { fileActions };
    return {
      id: field,
      field: field,
      accessorKey: field as never,
      header: columnDef?.title ?? fieldNameToTitle(field),
      accessorFn: columnDef?.accessorPath
        ? jsonPathAccessor(columnDef.accessorPath)
        : undefined,
      Cell: cellRendererFunc
        ? (cell: CellRendererFunctionProps) =>
            cellRendererFunc(cell, cellRendererFuncParams)
        : ValueCellRenderer,

      size: columnDef?.width,
      enableSorting: columnDef?.sortable ?? undefined,
    };
  }, [] as MRT_Column<ExplorerColumn>[]);
};

export const createArrayTableColumns = (
  root: string,
  tableConfig: TableColumnsAndFields,
): ExplorerTableColumnMRT[] => {
  return publicLoomFields(tableConfig.fields).map((field) => {
    const columnDef = tableConfig?.columns?.[field];

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
      Cell: cellRendererFunc
        ? (cell: CellRendererFunctionProps) =>
            ArrayCellRenderer(cellRendererFunc, cell, cellRendererFuncParams)
        : RenderArrayCell,

      size: columnDef?.width,
      enableSorting: columnDef?.sortable ?? undefined,
    };
  }, [] as MRT_Column<ExplorerColumn>[]);
};
