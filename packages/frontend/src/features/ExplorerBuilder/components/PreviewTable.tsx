import React, { useState } from 'react';
import type {
  ExplorerBuilderColumn,
  ExplorerBuilderEmission,
  ExplorerBuilderPreviewResult,
} from '@gen3/core';
import type { DraftTable } from '../authoring/model';
import { useDismissibleLayer } from './useDismissibleLayer';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const scalarText = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value.trim() || undefined;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return undefined;
};

export const formatPreviewCell = (value: unknown, depth = 0): string => {
  if (value === undefined || value === null) return '—';
  const scalar = scalarText(value);
  if (scalar !== undefined) return scalar;
  if (Array.isArray(value)) {
    const items = value
      .map((item) => formatPreviewCell(item, depth + 1))
      .filter((item) => item !== '—');
    return items.length > 0 ? items.join('; ') : '—';
  }
  if (isRecord(value)) {
    // Prefer the human-bearing fields used by common FHIR datatypes.
    for (const key of ['text', 'display', 'value', 'code']) {
      const preferred = scalarText(value[key]);
      if (preferred !== undefined) return preferred;
    }
    if (value.reference !== undefined) {
      return formatPreviewCell(value.reference, depth + 1);
    }
    if (value.coding !== undefined) {
      return formatPreviewCell(value.coding, depth + 1);
    }
    if (depth < 3) {
      const parts = Object.entries(value)
        .map(([key, nested]) => {
          const formatted = formatPreviewCell(nested, depth + 1);
          return formatted === '—' ? undefined : `${key}: ${formatted}`;
        })
        .filter((part): part is string => part !== undefined);
      if (parts.length > 0) return parts.join(' · ');
    }
  }
  return previewCellTitle(value);
};

export const previewCellTitle = (value: unknown): string => {
  if (value === undefined || value === null) return '—';
  const scalar = scalarText(value);
  if (scalar !== undefined) return scalar;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

export const PreviewTable = ({
  preview,
  table,
  limit,
  onLimitChange,
  onColumnChange,
  onColumnsChange,
}: {
  readonly preview?: ExplorerBuilderPreviewResult;
  readonly table?: DraftTable;
  readonly limit: number;
  readonly onLimitChange: (value: 25 | 50 | 100 | 500 | 1000) => void;
  readonly onColumnChange: (column: ExplorerBuilderColumn) => void;
  readonly onColumnsChange: (
    columns: ReadonlyArray<ExplorerBuilderColumn>,
  ) => void;
}) => {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const columnsMenuRef = useDismissibleLayer<HTMLDivElement>(
    columnsOpen,
    setColumnsOpen,
  );
  const [draggedColumn, setDraggedColumn] = useState<string>();
  const [dropIndex, setDropIndex] = useState<number>();
  const draggedColumnRef = React.useRef<string | undefined>(undefined);
  const authoredByColumn = new Map(
    table?.document.columns.map((column) => [column.column, column]) ?? [],
  );
  const orderedColumns: ExplorerBuilderEmission[] = (preview?.columns ?? [])
    .map((column) => {
      const authored = authoredByColumn.get(column.column);
      return {
        ...column,
        outputId: preview?.outputId ?? table?.outputId ?? '',
        candidateId: column.column,
        occurrenceId: authored?.occurrenceId ?? 'base',
        projectionMode: authored?.source.projectionMode ?? 'FIRST',
        emissionId: column.column,
        publicColumn: column.column,
      };
    })
    .sort(
      (left, right) =>
        (authoredByColumn.get(left.column)?.table?.order ??
          Number.MAX_SAFE_INTEGER) -
        (authoredByColumn.get(right.column)?.table?.order ??
          Number.MAX_SAFE_INTEGER),
    );
  const columns = orderedColumns.filter((column) => {
    const authored = authoredByColumn.get(column.column);
    return authored?.table?.visible ?? Boolean(authored?.table);
  });
  const resetDrag = () => {
    draggedColumnRef.current = undefined;
    setDraggedColumn(undefined);
    setDropIndex(undefined);
  };
  const reorderColumns = (columnName: string, insertionIndex: number) => {
    const fromIndex = orderedColumns.findIndex(
      (column) => column.column === columnName,
    );
    if (fromIndex < 0) return;
    const reordered = [...orderedColumns];
    const [moved] = reordered.splice(fromIndex, 1);
    const adjustedIndex = Math.max(
      0,
      Math.min(
        reordered.length,
        insertionIndex - (fromIndex < insertionIndex ? 1 : 0),
      ),
    );
    reordered.splice(adjustedIndex, 0, moved);
    const updates = reordered.flatMap((column, order) => {
      const authored = authoredByColumn.get(column.column);
      return !authored || authored.table?.order === order
        ? []
        : [
            {
              ...authored,
              table: { ...(authored.table ?? {}), order },
            },
          ];
    });
    if (updates.length > 0) onColumnsChange(updates);
  };
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Preview and configure
        </h3>
        <div ref={columnsMenuRef} className="relative ml-auto">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setColumnsOpen((value) => !value)}
          >
            Columns
          </button>
          {columnsOpen && (
            <div className="absolute right-0 z-20 mt-1 w-[min(32rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              <p className="border-b border-slate-100 px-2 pb-2 text-[11px] text-slate-500">
                Check columns to show them. Drag rows to change table order.
              </p>
              <div
                role="list"
                aria-label="Table columns"
                className="max-h-[min(60dvh,28rem)] overflow-y-auto overflow-x-hidden py-1 pr-1"
              >
                {orderedColumns.map((column, index) => {
                  const authored = authoredByColumn.get(column.column);
                  const visible =
                    authored?.table?.visible ?? Boolean(authored?.table);
                  return (
                    <div
                      key={column.emissionId}
                      role="listitem"
                      onDragOver={(event) => {
                        if (!draggedColumnRef.current) return;
                        event.preventDefault();
                        const bounds =
                          event.currentTarget.getBoundingClientRect();
                        setDropIndex(
                          index +
                            (event.clientY > bounds.top + bounds.height / 2
                              ? 1
                              : 0),
                        );
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const columnName =
                          draggedColumnRef.current ??
                          event.dataTransfer.getData('text/plain');
                        if (columnName) {
                          const bounds =
                            event.currentTarget.getBoundingClientRect();
                          const insertionIndex =
                            index +
                            (event.clientY > bounds.top + bounds.height / 2
                              ? 1
                              : 0);
                          reorderColumns(columnName, insertionIndex);
                        }
                        resetDrag();
                      }}
                      className={`relative flex items-center gap-2 rounded px-2 py-2 text-xs hover:bg-slate-50 ${draggedColumn === column.column ? 'opacity-50' : ''}`}
                    >
                      {draggedColumn && dropIndex === index && (
                        <span className="pointer-events-none absolute inset-x-1 -top-px h-0.5 rounded bg-blue-500" />
                      )}
                      <span
                        aria-label={`Drag ${authored?.label ?? column.label}`}
                        draggable={Boolean(authored)}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData(
                            'text/plain',
                            column.column,
                          );
                          draggedColumnRef.current = column.column;
                          setDraggedColumn(column.column);
                          setDropIndex(index);
                        }}
                        onDragEnd={resetDrag}
                        className="cursor-grab select-none text-base leading-none text-slate-400 active:cursor-grabbing"
                      >
                        ⋮⋮
                      </span>
                      <label className="flex min-w-0 flex-1 items-start gap-2 leading-5">
                        <input
                          type="checkbox"
                          className="mt-0.5 shrink-0"
                          checked={visible}
                          disabled={!authored}
                          onChange={(event) =>
                            authored &&
                            onColumnChange({
                              ...authored,
                              table: {
                                ...(authored.table ?? {}),
                                visible: event.currentTarget.checked,
                                order: authored.table?.order ?? index,
                              },
                            })
                          }
                        />
                        <span className="min-w-0 break-words">
                          {authored?.label ?? column.label}
                        </span>
                      </label>
                    </div>
                  );
                })}
                {draggedColumn && dropIndex === orderedColumns.length && (
                  <div className="mx-1 h-0.5 rounded bg-blue-500" />
                )}
              </div>
            </div>
          )}
        </div>
        <label className="text-xs font-medium text-slate-600">
          Rows{' '}
          <select
            aria-label="Preview row limit"
            className="min-w-20 rounded-md border border-slate-300 bg-white py-1.5 pl-2 pr-8 text-right font-normal tabular-nums text-slate-800"
            value={limit}
            onChange={(event) =>
              onLimitChange(
                Number(event.currentTarget.value) as 25 | 50 | 100 | 500 | 1000,
              )
            }
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1,000</option>
          </select>
        </label>
      </div>
      <div
        data-testid="preview-table-scroll"
        className="max-h-[min(65dvh,40rem)] max-w-full overflow-auto overscroll-contain"
      >
        {!preview ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            Choose a row resource and at least one visible column, then preview.
          </p>
        ) : (
          <table className="w-max min-w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.emissionId}
                    className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 font-semibold"
                  >
                    {authoredByColumn.get(column.column)?.label ?? column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(preview.rows ?? []).map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/60"
                >
                  {columns.map((column) => {
                    const rawValue = row[column.publicColumn];
                    const value = formatPreviewCell(rawValue);
                    return (
                      <td
                        key={column.emissionId}
                        className="max-w-56 border-b border-slate-100 px-4 py-2.5 text-slate-700"
                      >
                        <div
                          className="truncate whitespace-nowrap"
                          title={previewCellTitle(rawValue)}
                        >
                          {value}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
};
