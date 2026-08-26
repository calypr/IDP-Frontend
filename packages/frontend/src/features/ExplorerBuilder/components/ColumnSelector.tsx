import React, { useMemo, useState } from 'react';
import type {
  ExplorerBuilderCatalog,
  ExplorerBuilderCandidate,
  ExplorerBuilderEmission,
  ExplorerBuilderSelection,
} from '@gen3/core';
import {
  catalogCandidates,
  derivedOccurrences,
  selectionPresentationKey,
  type DraftTable,
  type PresentationBinding,
} from '../authoring/model';

const titleForResource = (value: string): string =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_.]/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const ColumnSelector = ({
  catalog,
  table,
  emissions,
  occurrenceId,
  disabled,
  onToggle,
  onProjection,
  onPresentation,
}: {
  readonly catalog: ExplorerBuilderCatalog;
  readonly table?: DraftTable;
  readonly emissions: ReadonlyArray<ExplorerBuilderEmission>;
  readonly occurrenceId: string;
  readonly disabled: boolean;
  readonly onToggle: (
    candidateId: string,
    projectionMode: string,
    selected: boolean,
  ) => void;
  readonly onProjection: (candidateId: string, projectionMode: string) => void;
  readonly onPresentation: (
    selection: ExplorerBuilderSelection,
    value: PresentationBinding,
  ) => void;
}) => {
  const [query, setQuery] = useState('');
  const occurrence = derivedOccurrences(table, catalog).find(
    (candidate) => candidate.id === occurrenceId,
  );
  const normalizedQuery = query.trim().toLowerCase();
  const candidatesForOccurrence = useMemo(
    () => catalogCandidates(catalog, occurrence?.nodeId),
    [catalog, occurrence?.nodeId],
  );
  const candidates = useMemo(
    () =>
      candidatesForOccurrence.filter((candidate) =>
        `${candidate.label} ${candidate.logicalType}`
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [candidatesForOccurrence, normalizedQuery],
  );
  const selectionFor = (candidateId: string) =>
    table?.selections.find(
      (selection) =>
        selection.candidateId === candidateId &&
        selection.occurrenceId === occurrenceId,
    );
  const selectedCandidates = candidatesForOccurrence.filter((candidate) =>
    Boolean(selectionFor(candidate.candidateId)),
  );
  const availableCandidates = candidates.filter(
    (candidate) => !selectionFor(candidate.candidateId),
  );
  const resourceType =
    catalog.nodes.find((node) => node.nodeId === occurrence?.nodeId)
      ?.resourceType ?? 'resource';

  const toggleAll = (nextSelected: boolean) => {
    if (disabled) return;
    candidates.forEach((candidate) => {
      const selected = selectionFor(candidate.candidateId);
      if (Boolean(selected) !== nextSelected) {
        onToggle(
          candidate.candidateId,
          selected?.projectionMode ?? candidate.defaultProjectionMode,
          nextSelected,
        );
      }
    });
  };

  const renderCandidate = (
    candidate: ExplorerBuilderCandidate,
    selectedColumn: boolean,
  ) => {
    const selection = selectionFor(candidate.candidateId);
    const matchingEmissions = selection
      ? emissions.filter(
          (emission) =>
            emission.candidateId === selection.candidateId &&
            emission.occurrenceId === selection.occurrenceId &&
            emission.projectionMode === selection.projectionMode,
        )
      : [];
    const presentation = selection
      ? table?.presentation[selectionPresentationKey(selection)] ?? {}
      : {};
    const label = matchingEmissions[0]?.label ?? candidate.label;

    return (
      <div
        key={candidate.candidateId}
        className={`border-b border-slate-200 px-2 py-1.5 last:border-b-0 ${
          selection ? 'bg-blue-50/60' : 'hover:bg-slate-50'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        <label className="flex cursor-pointer items-start gap-2">
          <input
            className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700"
            type="checkbox"
            checked={Boolean(selection)}
            disabled={disabled}
            onChange={(event) =>
              onToggle(
                candidate.candidateId,
                selection?.projectionMode ?? candidate.defaultProjectionMode,
                event.currentTarget.checked,
              )
            }
          />
          <span className="min-w-0 flex-1">
            <span
              className="block break-words text-sm font-medium leading-tight text-slate-800"
              title={candidate.label}
            >
              {candidate.label}
            </span>
            <span className="mt-0.5 block truncate font-mono text-[11px] text-slate-500">
              {candidate.logicalType}
              {candidate.repeated ? ' · repeated' : ''}
              {candidate.filterable || candidate.chartable ? ' · value' : ''}
            </span>
          </span>
        </label>

        {selectedColumn && selection ? (
          <div
            className="mt-1.5 border-t border-blue-200 pt-1.5"
            onClick={(event) => event.stopPropagation()}
          >
            {candidate.projectionModes.length > 1 ? (
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                Projection
                <select
                  aria-label={`Projection mode for ${candidate.label}`}
                  className="rounded border border-slate-300 bg-white px-1.5 py-1 text-[10px] font-bold uppercase text-slate-700"
                  value={selection.projectionMode}
                  disabled={disabled}
                  onChange={(event) =>
                    onProjection(candidate.candidateId, event.currentTarget.value)
                  }
                >
                  {candidate.projectionModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
              <span className="shrink-0 font-medium text-slate-500">Label</span>
              <input
                aria-label={`Display label for ${label}`}
                className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-blue-500"
                value={presentation.label ?? label}
                onChange={(event) =>
                  onPresentation(selection, {
                    ...presentation,
                    label: event.currentTarget.value,
                  })
                }
              />
            </label>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-700">
              {candidate.filterable ? (
                <label className="inline-flex items-center gap-1.5">
                  <input
                    className="h-3.5 w-3.5 accent-blue-700"
                    type="checkbox"
                    checked={Boolean(presentation.filter)}
                    disabled={disabled}
                    onChange={(event) =>
                      onPresentation(selection, {
                        ...presentation,
                        filter: event.currentTarget.checked
                          ? { label: presentation.label ?? label }
                          : undefined,
                      })
                    }
                  />
                  Filter
                </label>
              ) : null}
              {candidate.chartable ? (
                <label className="inline-flex items-center gap-1.5">
                  <input
                    className="h-3.5 w-3.5 accent-blue-700"
                    type="checkbox"
                    checked={Boolean(presentation.chart)}
                    disabled={disabled}
                    onChange={(event) =>
                      onPresentation(selection, {
                        ...presentation,
                        chart: event.currentTarget.checked
                          ? {
                              type: 'bar',
                              title: presentation.label ?? label,
                            }
                          : undefined,
                      })
                    }
                  />
                  Chart
                </label>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <aside className="flex h-[min(65dvh,46rem)] min-h-[36rem] min-w-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">
          Choose {titleForResource(resourceType)} columns
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">
          Selections use Loom candidate, occurrence, and projection identities.
        </p>
      </div>
      {!occurrence ? (
        <p className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Select a resource in the graph to inspect its fields.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          aria-label="Search columns"
          className="min-w-64 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-blue-500"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder="Search columns, types, or paths"
        />
        <button
          type="button"
          className="rounded border border-blue-300 bg-blue-50 px-2 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-50"
          disabled={disabled || candidates.length === 0}
          onClick={() => toggleAll(true)}
        >
          Select all
        </button>
        <button
          type="button"
          className="rounded border border-slate-200 px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={disabled || selectedCandidates.length === 0}
          onClick={() => toggleAll(false)}
        >
          Clear selection
        </button>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <section className="min-w-0 border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="border-b border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-700">
              Available
            </div>
            {availableCandidates.length ? (
              availableCandidates.map((candidate) =>
                renderCandidate(candidate, false),
              )
            ) : (
              <p className="p-3 text-xs text-slate-500">
                {normalizedQuery
                  ? 'No available fields match this search.'
                  : 'All available fields are selected.'}
              </p>
            )}
          </section>
          <section className="min-w-0">
            <div className="border-b border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-700">
              Selected
            </div>
            {selectedCandidates.length ? (
              selectedCandidates.map((candidate) =>
                renderCandidate(candidate, true),
              )
            ) : (
              <p className="p-3 text-xs text-slate-500">
                Select a field from Available to add it to this table.
              </p>
            )}
          </section>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {selectedCandidates.length} selected · {candidatesForOccurrence.length}{' '}
        available for {titleForResource(resourceType)}
        {occurrenceId === 'base' ? ' (row root)' : ' (route step)'}.
      </p>
    </aside>
  );
};
