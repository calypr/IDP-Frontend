import React, { useState } from 'react';
import type {
  ExplorerBuilderPreviewResult,
  ExplorerBuilderSelection,
} from '@gen3/core';
import {
  presentationForEmission,
  type DraftTable,
  type PresentationBinding,
} from '../authoring/model';

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
  onPresentation,
}: {
  readonly preview?: ExplorerBuilderPreviewResult;
  readonly table?: DraftTable;
  readonly limit: number;
  readonly onLimitChange: (value: 10 | 25 | 50 | 100) => void;
  readonly onPresentation: (
    selection: ExplorerBuilderSelection,
    value: PresentationBinding,
  ) => void;
}) => {
  const [columnsOpen, setColumnsOpen] = useState(false);
  const orderedColumns = [...(preview?.columns ?? [])].sort(
    (left, right) =>
      (presentationForEmission(table, left)?.order ?? Number.MAX_SAFE_INTEGER) -
      (presentationForEmission(table, right)?.order ?? Number.MAX_SAFE_INTEGER),
  );
  const columns = orderedColumns.filter(
    (column) => presentationForEmission(table, column)?.visible !== false,
  );
  const selectionFor = (column: (typeof orderedColumns)[number]) => ({
    candidateId: column.candidateId,
    occurrenceId: column.occurrenceId,
    projectionMode: column.projectionMode,
  });
  const moveColumn = (
    column: (typeof orderedColumns)[number],
    offset: -1 | 1,
  ) => {
    const index = orderedColumns.indexOf(column);
    const neighbor = orderedColumns[index + offset];
    if (!neighbor) return;
    const currentPresentation = presentationForEmission(table, column) ?? {};
    const neighborPresentation = presentationForEmission(table, neighbor) ?? {};
    onPresentation(selectionFor(column), {
      ...currentPresentation,
      order: index + offset,
    });
    onPresentation(selectionFor(neighbor), {
      ...neighborPresentation,
      order: index,
    });
  };
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Preview and configure
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Rows are addressed by Loom’s exact emitted public columns.
          </p>
        </div>
        <div className="relative ml-auto">
          <button
            type="button"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            onClick={() => setColumnsOpen((value) => !value)}
          >
            Columns
          </button>
          {columnsOpen && (
            <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
              {orderedColumns.map((column, index) => {
                const presentation =
                  presentationForEmission(table, column) ?? {};
                const selection = selectionFor(column);
                return (
                  <div
                    key={column.emissionId}
                    className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    <label className="min-w-0 flex-1 truncate">
                      <input
                        type="checkbox"
                        checked={presentation.visible !== false}
                        onChange={(event) =>
                          onPresentation(selection, {
                            ...presentation,
                            visible: event.currentTarget.checked,
                          })
                        }
                      />{' '}
                      {presentation.label ?? column.label}
                    </label>
                    <button
                      type="button"
                      aria-label={`Move ${column.label} earlier`}
                      disabled={index === 0}
                      onClick={() => moveColumn(column, -1)}
                      className="rounded px-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${column.label} later`}
                      disabled={index === orderedColumns.length - 1}
                      onClick={() => moveColumn(column, 1)}
                      className="rounded px-1 text-slate-500 hover:bg-slate-200 disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <label className="text-xs font-medium text-slate-600">
          Rows{' '}
          <select
            className="rounded-md border border-slate-300 bg-white px-1.5 py-1.5 font-normal text-slate-800"
            value={limit}
            onChange={(event) =>
              onLimitChange(
                Number(event.currentTarget.value) as 10 | 25 | 50 | 100,
              )
            }
          >
            <option>10</option>
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </label>
      </div>
      <div className="overflow-auto">
        {!preview ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            Choose a row resource and at least one visible column, then preview.
          </p>
        ) : (
          <table className="min-w-[42rem] w-full border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.emissionId}
                    className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 font-semibold"
                  >
                    {presentationForEmission(table, column)?.label ??
                      column.label}
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
