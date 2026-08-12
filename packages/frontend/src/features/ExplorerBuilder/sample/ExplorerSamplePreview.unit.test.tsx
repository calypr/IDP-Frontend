import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RecipeDraftPreview } from '@gen3/core';
import { ExplorerSamplePreview } from './ExplorerSamplePreview';

const preview: RecipeDraftPreview = {
  output: 'Patient overview',
  columns: [
    { name: 'id' } as RecipeDraftPreview['columns'][number],
    { name: 'gender' } as RecipeDraftPreview['columns'][number],
    { name: 'internal_note' } as RecipeDraftPreview['columns'][number],
  ],
  rows: [
    { id: 'p-001', gender: 'female', internal_note: 'hidden' },
    { id: 'p-002', gender: null, internal_note: 'hidden' },
  ],
  rowCount: 2,
  validation: { outputs: [], diagnostics: [] },
};

describe('ExplorerSamplePreview', () => {
  it('renders a configured, accessible table with ordered labels and hidden columns', () => {
    render(
      <ExplorerSamplePreview
        preview={preview}
        selectedPathSummary={['Patient', 'Condition', 'Specimen']}
        columnConfig={[
          { name: 'gender', label: 'Administrative gender', order: 0 },
          { name: 'internal_note', visible: false, order: 1 },
          { name: 'id', label: 'Patient ID', order: 2 },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: /sample preview/i })).toBeInTheDocument();
    expect(screen.getByText('Patient → Condition → Specimen')).toBeInTheDocument();
    expect(screen.getByText('Administrative gender')).toBeInTheDocument();
    expect(screen.getByText('Patient ID')).toBeInTheDocument();
    expect(screen.queryByText('internal_note')).not.toBeInTheDocument();
    expect(screen.getByText('p-001')).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveAccessibleName('Sample rows for Patient overview');
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    expect(screen.getAllByRole('columnheader')[0]).toHaveAttribute('scope', 'col');
    expect(screen.getByText(/swipe horizontally/i)).toBeInTheDocument();
  });

  it('exposes idle, loading, error, and empty states without requiring preview data', () => {
    const retry = jest.fn();
    const { rerender } = render(<ExplorerSamplePreview onRetry={retry} />);
    expect(screen.getByText(/run a preview to inspect/i)).toBeInTheDocument();

    rerender(<ExplorerSamplePreview onRetry={retry} status="loading" />);
    expect(screen.getByText(/preparing a sample/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled();

    rerender(<ExplorerSamplePreview error="Gateway timed out." onRetry={retry} status="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Gateway timed out.');
    fireEvent.click(screen.getByRole('button', { name: /retry sample/i }));
    expect(retry).toHaveBeenCalledTimes(1);

    rerender(<ExplorerSamplePreview preview={{ ...preview, rows: [], rowCount: 0 }} />);
    expect(screen.getByText(/no rows returned/i)).toBeInTheDocument();
  });

  it('keeps the last table visible while announcing a stale refresh or error', () => {
    render(
      <ExplorerSamplePreview
        error="The new traversal failed."
        isStale
        preview={preview}
        status="error"
      />,
    );
    expect(screen.getByText(/showing the last successful preview/i)).toBeInTheDocument();
    expect(screen.getByText(/the new traversal failed/i)).toBeInTheDocument();
    expect(screen.getByText('p-001')).toBeInTheDocument();
  });
});

