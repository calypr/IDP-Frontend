import React from 'react';
import {
  isJSONObject,
  type ExplorerAuthoringDocument,
  type JSONObject,
} from '@gen3/core';
export {
  decorationCapability,
  preserveIncompatibleDecorations,
} from './capabilities';
export type { OutputColumnCapability } from './capabilities';

type TabRecord = JSONObject;

const tabsOf = (document: ExplorerAuthoringDocument): TabRecord[] =>
  Array.isArray(document.tabs)
    ? (document.tabs.filter(isJSONObject) as TabRecord[])
    : [];

export const ExplorerVisualEditor = ({
  document,
  onChange,
  disabled = false,
}: {
  readonly document: ExplorerAuthoringDocument;
  readonly onChange: (document: ExplorerAuthoringDocument) => void;
  readonly disabled?: boolean;
}) => {
  const tabs = tabsOf(document);
  return (
    <section
      aria-label="Explorer visual editor"
      className="my-3 rounded border p-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Explorer tabs</h3>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange({
              ...document,
              schemaVersion: 1,
              tabs: [
                ...tabs,
                {
                  id: `tab-${tabs.length + 1}`,
                  title: `Tab ${tabs.length + 1}`,
                  output: '',
                  table: { columns: [] },
                },
              ],
            })
          }
        >
          Add tab
        </button>
      </div>
      <ol className="mt-2 space-y-2">
        {tabs.map((tab, index) => (
          <li
            key={`${String(tab.id ?? index)}-${index}`}
            className="rounded bg-slate-50 p-2"
          >
            <div className="flex flex-wrap gap-2">
              <input
                aria-label={`Tab ${index + 1} title`}
                disabled={disabled}
                value={typeof tab.title === 'string' ? tab.title : ''}
                onChange={(event) => {
                  const next = [...tabs];
                  next[index] = { ...tab, title: event.currentTarget.value };
                  onChange({ ...document, schemaVersion: 1, tabs: next });
                }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onChange({
                    ...document,
                    schemaVersion: 1,
                    tabs: tabs.filter((_, candidate) => candidate !== index),
                  })
                }
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
