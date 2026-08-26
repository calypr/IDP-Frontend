import React, { useState } from 'react';
import { IconCopy, IconGripVertical, IconTrash } from '@tabler/icons-react';

import type { ExplorerSummary } from '@gen3/core';
import type { DraftTable } from '../authoring/model';

interface BuilderToolbarProps {
  explorers: ReadonlyArray<ExplorerSummary>;
  selectedExplorerId: string;
  projectId: string;
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
}

export function BuilderToolbar({
  explorers,
  selectedExplorerId,
  projectId,
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
}: BuilderToolbarProps) {
  const [newExplorerOpen, setNewExplorerOpen] = useState(false);
  const [newExplorerName, setNewExplorerName] = useState('');
  const [newExplorerFromDefault, setNewExplorerFromDefault] = useState(false);
  const [draggedOutputId, setDraggedOutputId] = useState<string | null>(null);

  const selectedTable =
    tables.find((table) => table.outputId === selectedOutputId) ?? null;
  const explorerHref = `/org/${encodeURIComponent(
    projectId,
  )}/explorers/builder?explorerId=${encodeURIComponent(selectedExplorerId)}`;

  const createExplorer = (fromDefault: boolean) => {
    const name = newExplorerName.trim();
    if (!name) return;
    onCreateExplorer(name, fromDefault);
    setNewExplorerName('');
    setNewExplorerFromDefault(false);
    setNewExplorerOpen(false);
  };

  return (
    <div
      className="border-b border-slate-200 bg-white"
      data-explorer-delete-supported={deleteSupported}
    >
      <div className="flex min-w-0 items-center gap-2 px-4 py-1.5">
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
                  createExplorer(newExplorerFromDefault);
              }}
              placeholder="e.g. Clinical overview"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              autoFocus={newExplorerOpen}
            />
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
                onClick={() => createExplorer(newExplorerFromDefault)}
                disabled={!newExplorerName.trim() || busy}
                className="rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create {newExplorerFromDefault ? 'copy' : 'blank'}
              </button>
            </div>
          </div>
        </details>

        <a
          href={explorerHref}
          className="ml-auto shrink-0 rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          Open explorer
        </a>
      </div>

      <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-2">
        <div
          role="toolbar"
          aria-label="Table workspace"
          className="flex flex-nowrap items-center gap-2 overflow-x-auto"
        >
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="sr-only">Table</span>
            <select
              aria-label="Table"
              value={selectedOutputId ?? ''}
              onChange={(event) => onSelectTable(event.target.value)}
              className="max-w-52 min-w-44 rounded border border-slate-300 bg-white px-2 py-1.5 text-sm font-normal text-slate-800"
            >
              {tables.map((table) => (
                <option key={table.outputId} value={table.outputId}>
                  {table.title || table.outputId}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={onNewTable}
            disabled={busy}
            className="shrink-0 rounded-md border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            New table
          </button>

          <button
            type="button"
            onClick={onDuplicateTable}
            disabled={!selectedTable || busy}
            aria-label="Duplicate table"
            title="Duplicate table"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconCopy size={16} stroke={1.8} />
          </button>

          <button
            type="button"
            onClick={onDeleteTable}
            disabled={!selectedTable || tables.length <= 1 || busy}
            aria-label="Delete table"
            title="Delete table"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <IconTrash size={16} stroke={1.8} />
          </button>

          {selectedTable ? (
            <input
              aria-label="Table name"
              value={selectedTable.title}
              onChange={(event) =>
                onRenameTable(selectedTable.outputId, event.target.value)
              }
              className="min-w-36 max-w-64 shrink-0 rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
            />
          ) : null}

          <details className="relative shrink-0">
            <summary className="cursor-pointer list-none rounded border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
              Tables ({tables.length})
            </summary>
            <div className="absolute left-0 top-full z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg">
              <p className="px-2 py-1 text-xs text-slate-500">
                Drag to set table order.
              </p>
              <ol className="space-y-1">
                {tables.map((table) => (
                  <li
                    key={table.outputId}
                    draggable
                    onDragStart={() => setDraggedOutputId(table.outputId)}
                    onDragEnd={() => setDraggedOutputId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (
                        draggedOutputId &&
                        draggedOutputId !== table.outputId
                      ) {
                        onReorderTable(draggedOutputId, table.outputId);
                      }
                      setDraggedOutputId(null);
                    }}
                    className={`flex items-center gap-2 rounded border px-2 py-1.5 text-sm ${
                      table.outputId === selectedOutputId
                        ? 'border-blue-200 bg-blue-50 text-blue-900'
                        : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <IconGripVertical
                      size={15}
                      className="shrink-0 text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => onSelectTable(table.outputId)}
                      className="min-w-0 flex-1 truncate text-left"
                    >
                      {table.title || table.outputId}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </details>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onPreview}
              disabled={!selectedTable || busy || previewDisabled}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={!selectedTable || busy || publishDisabled}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
