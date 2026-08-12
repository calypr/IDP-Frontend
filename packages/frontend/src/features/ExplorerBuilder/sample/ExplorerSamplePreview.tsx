import React from 'react';
import type { RecipeDraftPreview } from '@gen3/core';

export type ExplorerSamplePreviewStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error';

/**
 * Presentation-only overrides for the columns in a Loom preview.
 * `name` remains the source field name; `label` is what a steward sees.
 */
export interface ExplorerSampleColumnConfig {
  /** Loom field name. `field` is accepted for direct Explorer table config use. */
  readonly name?: string;
  readonly field?: string;
  readonly label?: string;
  readonly visible?: boolean;
  readonly order?: number;
}

export interface ExplorerSamplePreviewProps {
  readonly preview?: RecipeDraftPreview;
  readonly output?: string;
  readonly onRetry?: () => void;
  /** Optional lifecycle state from the preview session. Defaults from `preview`. */
  readonly status?: ExplorerSamplePreviewStatus;
  /** Error text to announce when `status` is `error`. */
  readonly error?: string;
  /** Keep showing the last preview while a new sample is being requested. */
  readonly isStale?: boolean;
  /** Steward-defined labels, visibility, and order for preview columns. */
  readonly columnConfig?: ReadonlyArray<ExplorerSampleColumnConfig>;
  /** Alias kept for callers that describe the input as configured columns. */
  readonly configuredColumns?: ReadonlyArray<ExplorerSampleColumnConfig>;
  /** Human-readable directed traversal, e.g. `Patient → Condition → Specimen`. */
  readonly selectedPathSummary?: string | ReadonlyArray<string>;
  /** Render column labels as inputs directly above the live sample rows. */
  readonly editableHeaders?: boolean;
  readonly onColumnLabelChange?: (sourceName: string, label: string) => void;
  readonly onColumnMove?: (sourceName: string, direction: -1 | 1) => void;
  readonly onColumnHide?: (sourceName: string) => void;
}

const valueForCell = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value) ?? '—';
    } catch {
      return String(value);
    }
  }
  return String(value);
};

const pathFor = (
  summary: ExplorerSamplePreviewProps['selectedPathSummary'],
): string | undefined => {
  if (Array.isArray(summary)) return summary.filter(Boolean).join(' → ') || undefined;
  return typeof summary === 'string' ? summary.trim() || undefined : undefined;
};

const configuredColumnMap = (
  configs: ReadonlyArray<ExplorerSampleColumnConfig>,
): ReadonlyMap<string, ExplorerSampleColumnConfig> =>
  new Map(
    configs
      .map((config) => [config.name ?? config.field, config] as const)
      .filter((entry): entry is readonly [string, ExplorerSampleColumnConfig] => Boolean(entry[0])),
  );

const columnsForPreview = (
  preview: RecipeDraftPreview,
  configs: ReadonlyArray<ExplorerSampleColumnConfig>,
): ReadonlyArray<ExplorerSampleColumnConfig & { readonly sourceName: string }> => {
  const configByName = configuredColumnMap(configs);
  return preview.columns
    .map((column, previewIndex) => {
      const config = configByName.get(column.name);
      return {
        sourceName: column.name,
        name: column.name,
        label: config?.label || column.name,
        visible: config?.visible !== false,
        order: config?.order ?? (config ? configs.indexOf(config) : configs.length + previewIndex),
      };
    })
    .filter((column) => column.visible !== false)
    .sort((left, right) => left.order - right.order);
};

const statusTextFor = (
  status: ExplorerSamplePreviewStatus,
  hasPreview: boolean,
  isStale: boolean,
): string => {
  if (status === 'loading' && hasPreview) return 'Refreshing sample preview…';
  if (status === 'loading') return 'Loading sample preview…';
  if (status === 'error') return isStale ? 'Showing the last successful preview.' : 'Sample preview could not be loaded.';
  if (isStale) return 'This sample is from an earlier traversal.';
  if (status === 'ready') return 'Sample preview is ready.';
  return 'Sample preview has not been run yet.';
};

export const ExplorerSamplePreview = ({
  preview,
  output,
  onRetry,
  status: requestedStatus,
  error,
  isStale = false,
  columnConfig,
  configuredColumns,
  selectedPathSummary,
  editableHeaders = false,
  onColumnLabelChange,
  onColumnMove,
  onColumnHide,
}: ExplorerSamplePreviewProps) => {
  const status = requestedStatus ?? (preview ? 'ready' : 'idle');
  const configs = columnConfig ?? configuredColumns ?? [];
  const columns = preview ? columnsForPreview(preview, configs) : [];
  const path = pathFor(selectedPathSummary);
  const outputName = output || preview?.output || 'selected output';
  const rowCount = preview?.rowCount ?? 0;
  const rows = preview?.rows ?? [];
  const hasRows = Boolean(rows.length);
  const showTable = Boolean(preview && columns.length > 0);
  const statusText = statusTextFor(status, Boolean(preview), isStale);
  const errorText = error || 'Try running the sample again.';

  return (
    <section
      aria-busy={status === 'loading'}
      aria-describedby="explorer-sample-preview-status"
      aria-label="Explorer sample preview"
      className="my-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-900">Sample preview</h3>
              <span className="truncate text-sm text-slate-500" title={outputName}>· {outputName}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              A read-only in-memory sample. Downloads are disabled.
            </p>
            {path && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                <span className="font-medium text-slate-500">Traversal</span>
                <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 font-medium text-violet-800">
                  {path}
                </span>
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {preview && (
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                {rowCount.toLocaleString()} {rowCount === 1 ? 'row' : 'rows'}
              </span>
            )}
            {onRetry && (
              <button
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={onRetry}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Refreshing…' : 'Retry sample'}
              </button>
            )}
          </div>
        </div>
        <p
          id="explorer-sample-preview-status"
          aria-live="polite"
          className="mt-3 text-xs text-slate-600"
          role="status"
        >
          {statusText}
        </p>
        {status === 'error' && (
          <p aria-live="assertive" className="mt-1 text-xs font-medium text-red-700" role="alert">
            {errorText}
          </p>
        )}
      </div>

      {status === 'loading' && !preview && (
        <div className="flex items-center gap-3 px-4 py-8 text-sm text-slate-600 sm:px-5" role="status">
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
          Preparing a sample from the selected traversal…
        </div>
      )}

      {status !== 'loading' && status === 'idle' && !preview && (
        <div className="px-4 py-8 text-sm text-slate-500 sm:px-5">
          Run a preview to inspect the first rows of <span className="font-medium text-slate-700">{outputName}</span>.
        </div>
      )}

      {status !== 'loading' && status === 'error' && !preview && (
        <div className="px-4 py-7 text-sm text-red-700 sm:px-5">
          {errorText}
          {onRetry && <span className="ml-1 text-red-600">Use “Retry sample” to try again.</span>}
        </div>
      )}

      {preview && columns.length === 0 && (
        <div className="px-4 py-7 text-sm text-slate-500 sm:px-5">
          No visible columns are configured for this sample yet.
        </div>
      )}

      {showTable && (
        <>
          <p className="sr-only" id="explorer-sample-preview-table-description">
            {hasRows ? `Showing ${rows.length.toLocaleString()} sample rows.` : 'The sample returned no rows.'}
          </p>
          <div className="overflow-x-auto" tabIndex={0} aria-label="Scrollable sample table">
            <table
              aria-describedby="explorer-sample-preview-table-description"
              className="min-w-[42rem] w-full border-collapse text-left text-xs"
            >
              <caption className="sr-only">Sample rows for {outputName}</caption>
              <thead className="sticky top-0 z-10 bg-slate-100 text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  {columns.map((column, columnIndex) => (
                    <th className="whitespace-nowrap border-b border-slate-200 px-4 py-2.5 font-semibold" key={column.sourceName} scope="col">
                      {editableHeaders ? <div className="min-w-44 space-y-1">
                        <input aria-label={`Column ${column.sourceName} display name`} className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold normal-case tracking-normal text-slate-900" value={column.label} onChange={(event) => onColumnLabelChange?.(column.sourceName, event.currentTarget.value)} />
                        <div className="flex items-center gap-1 text-[10px] font-normal normal-case tracking-normal text-slate-500">
                          <code className="max-w-28 flex-1 truncate" title={column.sourceName}>{column.sourceName}</code>
                          <button type="button" aria-label={`Move ${column.label} left`} disabled={columnIndex === 0} className="rounded border bg-white px-1 disabled:opacity-30" onClick={() => onColumnMove?.(column.sourceName, -1)}>←</button>
                          <button type="button" aria-label={`Move ${column.label} right`} disabled={columnIndex === columns.length - 1} className="rounded border bg-white px-1 disabled:opacity-30" onClick={() => onColumnMove?.(column.sourceName, 1)}>→</button>
                          <button type="button" aria-label={`Hide ${column.label}`} className="rounded border bg-white px-1" onClick={() => onColumnHide?.(column.sourceName)}>Hide</button>
                        </div>
                      </div> : column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!hasRows && (
                  <tr>
                    <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={columns.length}>
                      No rows returned for this traversal.
                    </td>
                  </tr>
                )}
                {rows.map((row, rowIndex) => (
                  <tr className="odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/60" key={`sample-row-${rowIndex}`}>
                    {columns.map((column) => (
                      <td className="max-w-[20rem] whitespace-nowrap border-b border-slate-100 px-4 py-2.5 text-slate-700" key={column.sourceName}>
                        {valueForCell(row[column.sourceName])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-2.5 text-xs text-slate-500 sm:px-5 md:hidden">
            Swipe horizontally to see all columns.
          </p>
        </>
      )}
    </section>
  );
};
