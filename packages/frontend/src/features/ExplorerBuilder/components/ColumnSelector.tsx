import React, { useMemo, useState } from 'react';
import type {
  ExplorerBuilderCandidate,
  ExplorerBuilderCatalog,
  ExplorerBuilderColumn,
} from '@gen3/core';
import { derivedOccurrences, type DraftTable } from '../authoring/model';

const titleForResource = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const safeName = (value: string): string => {
  const normalized = value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return 'column';
  return /^[0-9]/.test(normalized) ? `x_${normalized}` : normalized;
};

const candidateFieldName = (fieldPath: string): string => {
  const segments = fieldPath
    .replace(/^root\./, '')
    .split('.')
    .map((segment) => segment.replace(/\[\]/g, ''))
    .filter(Boolean);
  if (segments.length > 1 && segments[segments.length - 1] === 'value')
    segments.pop();
  return safeName(segments.join('_'));
};

const isTabularCandidate = (candidate: ExplorerBuilderCandidate): boolean =>
  !['', 'unknown', 'object', 'array'].includes(
    candidate.logicalType.trim().toLowerCase(),
  );

type InitialPresentation = 'TABLE' | 'FILTER' | 'CHART';

const candidateColumnName = (
  candidate: ExplorerBuilderCandidate,
  occurrenceId: string,
  resourceType: string,
  existing: ReadonlySet<string>,
): string => {
  const leaf = candidateFieldName(candidate.fieldPath);
  const resourcePrefix = resourceType.trim() ? safeName(resourceType) : '';
  const base =
    occurrenceId === 'base'
      ? [resourcePrefix, leaf].filter(Boolean).join('_')
      : `${safeName(occurrenceId)}__${leaf}`;
  let value = base;
  let suffix = 2;
  while (existing.has(value)) value = `${base}_${suffix++}`;
  return value;
};

const sourceSummary = (column: ExplorerBuilderColumn): string =>
  [column.source.kind, column.source.fieldPath, column.source.match]
    .filter(Boolean)
    .join(' · ');

const ConfiguredColumnRow = ({
  column,
  order,
  disabled,
  filterable,
  chartable,
  onChange,
  onRemove,
}: {
  readonly column: ExplorerBuilderColumn;
  readonly order: number;
  readonly disabled: boolean;
  readonly filterable: boolean;
  readonly chartable: boolean;
  readonly onChange: (value: ExplorerBuilderColumn) => void;
  readonly onRemove: () => void;
}) => {
  const [label, setLabel] = useState(column.label);

  const commitLabel = () => {
    const next = label.trim();
    if (!next) {
      setLabel(column.label);
      return;
    }
    if (next !== column.label) onChange({ ...column, label: next });
  };
  const visible = column.table?.visible ?? Boolean(column.table);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem_2rem] items-center gap-2 border-b border-slate-200 px-2 py-1.5 last:border-b-0 hover:bg-slate-50/70">
      <div className="min-w-0">
        <input
          aria-label={`Display name for configured ${column.label}`}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-800 outline-blue-500 focus:border-blue-500"
          value={label}
          disabled={disabled}
          onChange={(event) => setLabel(event.currentTarget.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') {
              setLabel(column.label);
              event.currentTarget.blur();
            }
          }}
        />
        <div className="break-all px-1 font-mono text-[10px] leading-tight text-slate-400">
          {column.column} · {sourceSummary(column)}
        </div>
      </div>
      <label className="flex justify-center" title="Display in table">
        <span className="sr-only">Table</span>
        <input
          aria-label={`Display ${column.label} in table`}
          type="checkbox"
          checked={visible}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...column,
              table: {
                ...(column.table ?? {}),
                visible: event.currentTarget.checked,
                order: column.table?.order ?? order,
              },
            })
          }
        />
      </label>
      <label
        className="flex justify-center"
        title={
          filterable
            ? 'Use as filter'
            : 'Filters are unavailable for this field type'
        }
      >
        <span className="sr-only">Filter</span>
        <input
          aria-label={`Use ${column.label} as filter`}
          type="checkbox"
          checked={Boolean(column.filter)}
          disabled={disabled || (!filterable && !column.filter)}
          onChange={(event) =>
            onChange({
              ...column,
              filter: event.currentTarget.checked
                ? { label: column.label }
                : undefined,
            })
          }
        />
      </label>
      <label
        className="flex justify-center"
        title={
          chartable
            ? 'Use as chart'
            : 'Charts are unavailable for this field type'
        }
      >
        <span className="sr-only">Chart</span>
        <input
          aria-label={`Use ${column.label} as chart`}
          type="checkbox"
          checked={Boolean(column.chart)}
          disabled={disabled || (!chartable && !column.chart)}
          onChange={(event) =>
            onChange({
              ...column,
              chart: event.currentTarget.checked
                ? { type: 'bar', title: column.label }
                : undefined,
            })
          }
        />
      </label>
      <button
        type="button"
        aria-label={`Remove ${column.label}`}
        title="Remove configured column"
        className="h-6 w-6 rounded text-base leading-none text-red-600 hover:bg-red-50 disabled:opacity-40"
        disabled={disabled}
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
};

const AvailableColumnRow = ({
  candidate,
  disabled,
  onAdd,
}: {
  readonly candidate: ExplorerBuilderCandidate;
  readonly disabled: boolean;
  readonly onAdd: (
    displayName: string,
    initialPresentation: InitialPresentation,
  ) => void;
}) => {
  const [displayName, setDisplayName] = useState(candidate.label);
  const normalizedDisplayName = displayName.trim();

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem_2rem] items-center gap-2 border-b border-slate-200 px-2 py-1.5 last:border-b-0 hover:bg-blue-50/40">
      <div className="min-w-0">
        <input
          aria-label={`Display name for available ${candidate.label}`}
          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-sm font-medium text-slate-700 outline-blue-500 focus:border-blue-500"
          value={displayName}
          disabled={disabled}
          onChange={(event) => setDisplayName(event.currentTarget.value)}
          onBlur={() => {
            if (!displayName.trim()) setDisplayName(candidate.label);
          }}
        />
        <div className="break-all px-1 font-mono text-[10px] leading-tight text-slate-400">
          {candidate.fieldPath} · {candidate.logicalType}
          {candidate.repeated ? ' · repeated' : ''}
        </div>
      </div>
      <label className="flex justify-center" title="Add to table">
        <span className="sr-only">Table</span>
        <input
          aria-label={`Add ${normalizedDisplayName || candidate.label} to table`}
          type="checkbox"
          checked={false}
          disabled={disabled || !normalizedDisplayName}
          onChange={(event) =>
            event.currentTarget.checked && onAdd(normalizedDisplayName, 'TABLE')
          }
        />
      </label>
      <label
        className="flex justify-center"
        title={
          candidate.filterable
            ? 'Add as filter'
            : 'Filters are unavailable for this field type'
        }
      >
        <input
          aria-label={`Add ${normalizedDisplayName || candidate.label} as filter`}
          type="checkbox"
          checked={false}
          disabled={disabled || !normalizedDisplayName || !candidate.filterable}
          onChange={(event) =>
            event.currentTarget.checked &&
            onAdd(normalizedDisplayName, 'FILTER')
          }
        />
      </label>
      <label
        className="flex justify-center"
        title={
          candidate.chartable
            ? 'Add as chart'
            : 'Charts are unavailable for this field type'
        }
      >
        <input
          aria-label={`Add ${normalizedDisplayName || candidate.label} as chart`}
          type="checkbox"
          checked={false}
          disabled={disabled || !normalizedDisplayName || !candidate.chartable}
          onChange={(event) =>
            event.currentTarget.checked && onAdd(normalizedDisplayName, 'CHART')
          }
        />
      </label>
      <span />
    </div>
  );
};

export const ColumnSelector = ({
  catalog,
  table,
  occurrenceId,
  disabled,
  loadingCandidates = false,
  onAdd,
  onAddAll,
  onChange,
  onRemove,
}: {
  readonly catalog: ExplorerBuilderCatalog;
  readonly table?: DraftTable;
  readonly occurrenceId: string;
  readonly disabled: boolean;
  readonly loadingCandidates?: boolean;
  readonly onAdd: (
    candidate: ExplorerBuilderCandidate,
    displayName: string,
    initialPresentation: InitialPresentation,
  ) => void;
  readonly onAddAll: (
    candidates: ReadonlyArray<ExplorerBuilderCandidate>,
  ) => void;
  readonly onChange: (column: ExplorerBuilderColumn) => void;
  readonly onRemove: (column: string) => void;
}) => {
  const [query, setQuery] = useState('');
  const occurrence = derivedOccurrences(table, catalog).find(
    (candidate) => candidate.id === occurrenceId,
  );
  const resourceType =
    catalog.nodes.find((node) => node.nodeId === occurrence?.nodeId)
      ?.resourceType ?? 'resource';
  const configured = useMemo(
    () =>
      (table?.document.columns ?? []).filter(
        (column) => column.occurrenceId === occurrenceId,
      ),
    [occurrenceId, table?.document.columns],
  );
  const configuredFieldPaths = useMemo(
    () =>
      new Set(
        configured.flatMap((column) =>
          column.source.kind === 'field' && column.source.fieldPath
            ? [column.source.fieldPath.replace(/^root\./, '')]
            : [],
        ),
      ),
    [configured],
  );
  const configuredCapabilities = useMemo(
    () =>
      new Map(
        configured.map((column) => [
          column.column,
          column.source.kind === 'field'
            ? (catalog.candidates ?? []).find(
                (candidate) =>
                  candidate.nodeId === occurrence?.nodeId &&
                  candidate.fieldPath.replace(/^root\./, '') ===
                    column.source.fieldPath?.replace(/^root\./, ''),
              )
            : undefined,
        ]),
      ),
    [catalog.candidates, configured, occurrence?.nodeId],
  );
  const available = useMemo(
    () =>
      (catalog.candidates ?? []).filter(
        (candidate) =>
          candidate.nodeId === occurrence?.nodeId &&
          isTabularCandidate(candidate) &&
          !configuredFieldPaths.has(candidate.fieldPath.replace(/^root\./, '')),
      ),
    [catalog.candidates, configuredFieldPaths, occurrence?.nodeId],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const rows = useMemo(
    () =>
      [
        ...configured.map((column) => ({
          kind: 'configured' as const,
          column,
        })),
        ...available.map((candidate) => ({
          kind: 'available' as const,
          candidate,
        })),
      ]
        .filter((row) => {
          if (!normalizedQuery) return true;
          const value =
            row.kind === 'configured'
              ? `${row.column.label} ${row.column.column} ${sourceSummary(row.column)}`
              : `${row.candidate.label} ${row.candidate.fieldPath} ${row.candidate.logicalType}`;
          return value.toLowerCase().includes(normalizedQuery);
        })
        .sort((left, right) => {
          const leftLabel =
            left.kind === 'configured'
              ? left.column.label
              : left.candidate.label;
          const rightLabel =
            right.kind === 'configured'
              ? right.column.label
              : right.candidate.label;
          return leftLabel.localeCompare(rightLabel);
        }),
    [available, configured, normalizedQuery],
  );
  const addCandidate = (
    candidate: ExplorerBuilderCandidate,
    displayName: string,
    initialPresentation: InitialPresentation,
  ) => {
    if (disabled) return;
    onAdd(candidate, displayName, initialPresentation);
  };
  const allTableColumnsSelected =
    available.length === 0 &&
    configured.length > 0 &&
    configured.every(
      (column) => column.table?.visible ?? Boolean(column.table),
    );
  const toggleAllTableColumns = () => {
    if (disabled) return;
    if (allTableColumnsSelected) {
      configured.forEach((column) =>
        onChange({
          ...column,
          table: {
            ...(column.table ?? {}),
            visible: false,
          },
        }),
      );
      return;
    }
    configured
      .filter((column) => !(column.table?.visible ?? Boolean(column.table)))
      .forEach((column, order) =>
        onChange({
          ...column,
          table: {
            ...(column.table ?? {}),
            visible: true,
            order: column.table?.order ?? order,
          },
        }),
      );
    if (available.length > 0) onAddAll(available);
  };

  return (
    <aside className="flex h-[min(70dvh,52rem)] min-h-[43rem] min-w-0 flex-col overflow-hidden bg-slate-100/40 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">
            {titleForResource(resourceType)} columns
          </h2>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={
              disabled || (configured.length === 0 && available.length === 0)
            }
            aria-pressed={allTableColumnsSelected}
            onClick={toggleAllTableColumns}
            className="rounded border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {allTableColumnsSelected
              ? 'Deselect all table columns'
              : 'Select all table columns'}
          </button>
          <span className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-600">
            {configured.length} configured · {available.length} available
          </span>
        </div>
      </div>
      {!occurrence ? (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Select a resource in the configured traversal to inspect its columns.
        </p>
      ) : (
        <>
          <input
            aria-label="Search columns"
            className="mt-2 rounded border border-slate-300 px-2.5 py-1.5 text-sm outline-blue-500"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search labels, column names, or field paths"
          />
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_3.5rem_3.5rem_3.5rem_2rem] gap-2 border-b border-slate-200 bg-slate-50/70 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <span className="text-left">Display name / source</span>
            <span>Table</span>
            <span>Filter</span>
            <span>Chart</span>
            <span />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white/80">
            {rows.length ? (
              rows.map((row, order) =>
                row.kind === 'configured' ? (
                  <ConfiguredColumnRow
                    key={`configured:${row.column.column}:${row.column.label}`}
                    column={row.column}
                    order={row.column.table?.order ?? order}
                    disabled={disabled}
                    filterable={
                      configuredCapabilities.get(row.column.column)
                        ?.filterable ?? true
                    }
                    chartable={
                      configuredCapabilities.get(row.column.column)
                        ?.chartable ?? true
                    }
                    onChange={onChange}
                    onRemove={() => onRemove(row.column.column)}
                  />
                ) : (
                  <AvailableColumnRow
                    key={`available:${row.candidate.candidateId}:${row.candidate.label}`}
                    candidate={row.candidate}
                    disabled={disabled}
                    onAdd={(displayName, initialPresentation) =>
                      addCandidate(
                        row.candidate,
                        displayName,
                        initialPresentation,
                      )
                    }
                  />
                ),
              )
            ) : (
              <p className="p-4 text-sm text-slate-500">
                {loadingCandidates
                  ? 'Loading available dataset columns…'
                  : normalizedQuery
                    ? 'No columns match this search.'
                    : 'No configured or available columns were found.'}
              </p>
            )}
          </div>
        </>
      )}
    </aside>
  );
};

export const columnFromCandidate = (
  candidate: ExplorerBuilderCandidate,
  occurrenceId: string,
  existing: ReadonlyArray<ExplorerBuilderColumn>,
  displayName = candidate.label,
  resourceType = '',
): ExplorerBuilderColumn => {
  const names = new Set(existing.map((column) => column.column));
  const order =
    Math.max(-1, ...existing.map((column) => column.table?.order ?? -1)) + 1;
  return {
    column: candidateColumnName(candidate, occurrenceId, resourceType, names),
    label: displayName.trim() || candidate.label,
    logicalType: candidate.logicalType,
    occurrenceId,
    source: {
      kind: 'field',
      fieldPath: candidate.fieldPath,
      projectionMode: candidate.defaultProjectionMode,
    },
    table: { visible: true, order },
  };
};
