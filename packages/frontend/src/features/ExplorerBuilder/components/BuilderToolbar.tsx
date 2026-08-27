import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCopy, IconGripVertical, IconTrash } from '@tabler/icons-react';

import type { ExplorerSummary } from '@gen3/core';
import type { DraftTable } from '../authoring/model';

interface BuilderToolbarProps {
  explorers: ReadonlyArray<ExplorerSummary>;
  selectedExplorerId: string;
  onExplorerChange: (explorerId: string) => void;
  onCreateExplorer: (name: string, fromDefault: boolean) => void;
  deleteSupported: boolean;
  tables: ReadonlyArray<DraftTable>;
  selectedOutputId?: string;
  onSelectTable: (outputId: string) => void;
  onRenameTable: (outputId: string, title: string) => void;
  onNewTable: () => void;
  onDuplicateTable: () => void;
  onDeleteTable: () => void;
  onReorderTable: (outputId: string, before?: string) => void;
  onPreview: () => void;
  onPublish: () => void;
  previewDisabled: boolean;
  publishDisabled: boolean;
  busy?: boolean;
  columnCreationSupported?: boolean;
  tableToolbarHost?: HTMLElement | null;
}

const TableToolbar = ({
  tables,
  selectedOutputId,
  onSelectTable,
  onRenameTable,
  onNewTable,
  onDuplicateTable,
  onDeleteTable,
  onReorderTable,
  onPreview,
  onPublish,
  previewDisabled,
  publishDisabled,
  busy,
  columnCreationSupported,
}: Pick<
  BuilderToolbarProps,
  | 'tables'
  | 'selectedOutputId'
  | 'onSelectTable'
  | 'onRenameTable'
  | 'onNewTable'
  | 'onDuplicateTable'
  | 'onDeleteTable'
  | 'onReorderTable'
  | 'onPreview'
  | 'onPublish'
  | 'previewDisabled'
  | 'publishDisabled'
  | 'busy'
  | 'columnCreationSupported'
>) => {
  const [draggedOutputId, setDraggedOutputId] = useState<string | null>(null);
  const selectedTable =
    tables.find((table) => table.outputId === selectedOutputId) ?? null;

  return (
    <div className="border-b border-slate-200 bg-slate-50/60 px-4 py-2">
      <div
        role="toolbar"
        aria-label="Table workspace"
        className="flex min-w-0 items-center gap-2"
      >
        <details className="relative shrink-0">
          <summary
            aria-label="Table selector"
            className="min-w-40 max-w-56 cursor-pointer list-none truncate rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
          >
            {selectedTable?.title || selectedTable?.outputId || 'Select table'}
          </summary>
          <div className="absolute left-0 top-full z-30 mt-1 w-80 rounded-md border border-slate-200 bg-white p-2 shadow-xl">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="text-xs font-semibold text-slate-700">Tables</p>
              <p className="text-[10px] text-slate-400">
                Drag to reorder · edit names directly
              </p>
            </div>
            <ol className="space-y-1">
              {tables.map((table) => (
                <li
                  key={table.outputId}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedOutputId && draggedOutputId !== table.outputId) {
                      const fromIndex = tables.findIndex(
                        (candidate) => candidate.outputId === draggedOutputId,
                      );
                      const targetIndex = tables.findIndex(
                        (candidate) => candidate.outputId === table.outputId,
                      );
                      onReorderTable(
                        draggedOutputId,
                        fromIndex < targetIndex
                          ? tables[targetIndex + 1]?.outputId
                          : table.outputId,
                      );
                    }
                    setDraggedOutputId(null);
                  }}
                  className={`flex items-center gap-2 rounded border px-2 py-1.5 ${
                    table.outputId === selectedOutputId
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span
                    draggable
                    aria-label={`Drag ${table.title || table.outputId}`}
                    title="Drag to reorder"
                    onDragStart={() => setDraggedOutputId(table.outputId)}
                    onDragEnd={() => setDraggedOutputId(null)}
                    className="cursor-grab text-slate-400 active:cursor-grabbing"
                  >
                    <IconGripVertical size={16} />
                  </span>
                  <input
                    aria-label={`Table name for ${table.title || table.outputId}`}
                    value={table.title}
                    onFocus={() => onSelectTable(table.outputId)}
                    onChange={(event) =>
                      onRenameTable(table.outputId, event.target.value)
                    }
                    className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-1 text-sm text-slate-800 outline-none focus:border-blue-300 focus:bg-white"
                  />
                </li>
              ))}
            </ol>
            {columnCreationSupported ? (
              <button
                type="button"
                onClick={onNewTable}
                disabled={busy}
                className="mt-2 w-full rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:opacity-50"
              >
                New table
              </button>
            ) : null}
          </div>
        </details>
        <button
          type="button"
          onClick={onDuplicateTable}
          disabled={!selectedTable || busy}
          aria-label="Duplicate table"
          title="Duplicate table"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <IconCopy size={16} stroke={1.8} />
        </button>
        <button
          type="button"
          onClick={onDeleteTable}
          disabled={!selectedTable || tables.length <= 1 || busy}
          aria-label="Delete table"
          title="Delete table"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <IconTrash size={16} stroke={1.8} />
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onPreview}
            disabled={!selectedTable || busy || previewDisabled}
            className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={!selectedTable || busy || publishDisabled}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>
    </div>
  );
};

export function BuilderToolbar({
  explorers,
  selectedExplorerId,
  onExplorerChange,
  onCreateExplorer,
  deleteSupported,
  tables,
  selectedOutputId,
  onSelectTable,
  onRenameTable,
  onNewTable,
  onDuplicateTable,
  onDeleteTable,
  onReorderTable,
  onPreview,
  onPublish,
  previewDisabled,
  publishDisabled,
  busy = false,
  columnCreationSupported = true,
  tableToolbarHost,
}: BuilderToolbarProps) {
  const [newExplorerOpen, setNewExplorerOpen] = useState(false);
  const [newExplorerName, setNewExplorerName] = useState('');
  const [newExplorerFromDefault, setNewExplorerFromDefault] = useState(false);
  const createExplorer = (fromDefault: boolean) => {
    const name = newExplorerName.trim();
    if (!name) return;
    onCreateExplorer(name, fromDefault);
    setNewExplorerName('');
    setNewExplorerFromDefault(false);
    setNewExplorerOpen(false);
  };
  const tableToolbar = (
    <TableToolbar
      tables={tables}
      selectedOutputId={selectedOutputId}
      onSelectTable={onSelectTable}
      onRenameTable={onRenameTable}
      onNewTable={onNewTable}
      onDuplicateTable={onDuplicateTable}
      onDeleteTable={onDeleteTable}
      onReorderTable={onReorderTable}
      onPreview={onPreview}
      onPublish={onPublish}
      previewDisabled={previewDisabled}
      publishDisabled={publishDisabled}
      busy={busy}
      columnCreationSupported={columnCreationSupported}
    />
  );

  return (
    <div
      className="min-w-0 bg-white"
      data-explorer-delete-supported={deleteSupported}
    >
      <div className="flex min-w-0 items-center gap-2 py-1">
        <label className="flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="sr-only">Explorer</span>
          <select
            aria-label="Explorer"
            value={selectedExplorerId}
            onChange={(event) => onExplorerChange(event.target.value)}
            className="max-w-72 min-w-48 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-800"
          >
            {explorers.map((explorer) => (
              <option key={explorer.explorerId} value={explorer.explorerId}>
                {explorer.title}
              </option>
            ))}
          </select>
        </label>

        <details
          open={newExplorerOpen}
          onToggle={(event) => setNewExplorerOpen(event.currentTarget.open)}
          className="relative shrink-0"
        >
          <summary className="cursor-pointer list-none rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50">
            New explorer
          </summary>
          <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
            <label
              className="block text-xs font-semibold text-slate-600"
              htmlFor="new-explorer-name"
            >
              Explorer name
            </label>
            <input
              id="new-explorer-name"
              value={newExplorerName}
              onChange={(event) => setNewExplorerName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  createExplorer(
                    columnCreationSupported ? newExplorerFromDefault : true,
                  );
              }}
              placeholder="e.g. Clinical overview"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              autoFocus={newExplorerOpen}
            />
            {columnCreationSupported ? (
              <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={newExplorerFromDefault}
                  onChange={(event) =>
                    setNewExplorerFromDefault(event.currentTarget.checked)
                  }
                  className="mt-0.5 accent-blue-700"
                />
                Start with a copy of the current explorer
              </label>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                The new Explorer will start with a copy of the current
                configured tables.
              </p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNewExplorerOpen(false)}
                className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  createExplorer(
                    columnCreationSupported ? newExplorerFromDefault : true,
                  )
                }
                disabled={!newExplorerName.trim() || busy}
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create{' '}
                {!columnCreationSupported || newExplorerFromDefault
                  ? 'copy'
                  : 'blank'}
              </button>
            </div>
          </div>
        </details>
      </div>
      {tableToolbarHost
        ? createPortal(tableToolbar, tableToolbarHost)
        : tableToolbarHost === undefined
          ? tableToolbar
          : null}
    </div>
  );
}
