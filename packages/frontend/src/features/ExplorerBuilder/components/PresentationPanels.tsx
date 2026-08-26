import React from 'react';

export const PresentationPanels = ({
  features,
}: {
  readonly features?: {
    readonly sharedFilters: boolean;
    readonly fixedFilters: boolean;
    readonly fileActions: boolean;
  };
}) => (
  <details className="rounded-xl border border-slate-200 bg-white shadow-sm">
    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-800">
      Shared filters and file actions
    </summary>
    <div className="grid gap-3 border-t border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600 md:grid-cols-3">
      <fieldset
        disabled={!features?.sharedFilters}
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm disabled:opacity-60"
      >
        <legend>Shared filters</legend>
        <p>
          {features?.sharedFilters
            ? 'Configure shared filters.'
            : 'Disabled because Loom Authoring V2 does not expose safe shared-filter intent.'}
        </p>
      </fieldset>
      <fieldset
        disabled={!features?.fixedFilters}
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm disabled:opacity-60"
      >
        <legend>Fixed filters</legend>
        <p>
          {features?.fixedFilters
            ? 'Configure fixed filters.'
            : 'Disabled because Loom Authoring V2 does not expose safe fixed-filter intent.'}
        </p>
      </fieldset>
      <fieldset
        disabled={!features?.fileActions}
        className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm disabled:opacity-60"
      >
        <legend>File actions</legend>
        <p>
          {features?.fileActions
            ? 'Configure file actions.'
            : 'Disabled because Loom Authoring V2 does not expose safe file-action intent.'}
        </p>
      </fieldset>
    </div>
  </details>
);
