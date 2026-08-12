import React from 'react';
import { isJSONObject, type JSONObject, type RecipeAuthoringDocument } from '@gen3/core';

type OutputRecord = JSONObject;

const outputsOf = (document: RecipeAuthoringDocument): OutputRecord[] =>
  Array.isArray(document.outputs)
    ? document.outputs.filter(isJSONObject) as OutputRecord[]
    : [];

export const RecipeVisualEditor = ({
  document,
  onChange,
  disabled = false,
}: {
  readonly document: RecipeAuthoringDocument;
  readonly onChange: (document: RecipeAuthoringDocument) => void;
  readonly disabled?: boolean;
}) => {
  const outputs = outputsOf(document);
  const update = (next: OutputRecord[]) => onChange({ ...document, outputs: next });
  return (
    <section aria-label="Recipe visual editor" className="my-3 rounded border p-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Outputs</h3>
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            update([
              ...outputs,
              { name: `Output${outputs.length + 1}`, rootResourceType: '', rowGrain: 'row', fields: [] },
            ])
          }
        >
          Add output
        </button>
      </div>
      {outputs.length === 0 && <p className="text-sm text-slate-500">No outputs defined.</p>}
      <ol className="mt-2 space-y-2">
        {outputs.map((output, index) => (
          <li key={`${String(output.name ?? index)}-${index}`} className="rounded bg-slate-50 p-2">
            <div className="flex flex-wrap gap-2">
              <input
                aria-label={`Output ${index + 1} name`}
                disabled={disabled}
                value={typeof output.name === 'string' ? output.name : ''}
                onChange={(event) => {
                  const next = [...outputs];
                  next[index] = { ...output, name: event.currentTarget.value };
                  update(next);
                }}
              />
              <input
                aria-label={`Output ${index + 1} root resource type`}
                disabled={disabled}
                placeholder="Root resource type"
                value={typeof output.rootResourceType === 'string' ? output.rootResourceType : ''}
                onChange={(event) => {
                  const next = [...outputs];
                  next[index] = { ...output, rootResourceType: event.currentTarget.value };
                  update(next);
                }}
              />
              <input
                aria-label={`Output ${index + 1} row grain`}
                disabled={disabled}
                placeholder="Row grain"
                value={typeof output.rowGrain === 'string' ? output.rowGrain : ''}
                onChange={(event) => {
                  const next = [...outputs];
                  next[index] = { ...output, rowGrain: event.currentTarget.value };
                  update(next);
                }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => update(outputs.filter((_, candidate) => candidate !== index))}
              >
                Remove
              </button>
              <button
                type="button"
                disabled={disabled || index === 0}
                onClick={() => {
                  const next = [...outputs];
                  [next[index - 1], next[index]] = [next[index], next[index - 1]];
                  update(next);
                }}
              >
                Move up
              </button>
              <button
                type="button"
                disabled={disabled || index === outputs.length - 1}
                onClick={() => {
                  const next = [...outputs];
                  [next[index], next[index + 1]] = [next[index + 1], next[index]];
                  update(next);
                }}
              >
                Move down
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
};
