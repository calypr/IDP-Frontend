import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ExplorerBuilderPreviewResult,
  ExplorerBuilderColumn,
} from '@gen3/core';
import type { DraftTable } from '../authoring/model';
import {
  formatPreviewCell,
  PreviewTable,
  previewCellTitle,
} from './PreviewTable';

const column = (
  name: string,
  label: string,
  order: number,
): ExplorerBuilderColumn => ({
  column: name,
  label,
  occurrenceId: 'base',
  source: { kind: 'field', fieldPath: name, projectionMode: 'FIRST' },
  table: { visible: true, order },
});

const firstColumn = column('first_column', 'First column', 0);
const secondColumn = column('second_column', 'Second column', 1);
const table: DraftTable = {
  outputId: 'Specimen',
  tabId: 'specimen',
  title: 'Specimen',
  document: {
    kind: 'ExplorerBuilderDocument',
    output: { id: 'Specimen', title: 'Specimen' },
    rootResourceType: 'Specimen',
    route: { occurrenceId: 'base', resourceType: 'Specimen' },
    columns: [firstColumn, secondColumn],
  },
};
const preview: ExplorerBuilderPreviewResult = {
  apiVersion: 'loom.calypr.org/explorer-authoring/v2',
  kind: 'ExplorerBuilderPreview',
  receiptId: 'receipt_preview',
  outputId: 'Specimen',
  columns: [firstColumn, secondColumn].map((value) => ({
    column: value.column,
    label: value.label,
    logicalType: 'string',
    filterable: true,
    chartable: true,
  })),
  rows: [{ first_column: 'one', second_column: 'two' }],
  rowCount: 1,
  diagnostics: [],
};

describe('formatPreviewCell', () => {
  it('preserves scalar values', () => {
    expect(formatPreviewCell('Tissue')).toBe('Tissue');
    expect(formatPreviewCell(25)).toBe('25');
    expect(formatPreviewCell(false)).toBe('false');
    expect(formatPreviewCell(null)).toBe('—');
  });

  it('renders common structured FHIR values as compact human text', () => {
    expect(formatPreviewCell({ reference: 'Patient/example' })).toBe(
      'Patient/example',
    );
    expect(formatPreviewCell([{ use: 'official', value: 'ABC' }])).toBe('ABC');
    expect(
      formatPreviewCell({
        coding: [{ code: 'fix', display: 'Fixation', system: 'example' }],
        text: 'Fixation',
      }),
    ).toBe('Fixation');
    expect(
      formatPreviewCell({
        bodySite: { reference: { reference: 'BodyStructure/example' } },
        collector: { reference: 'Practitioner/example' },
      }),
    ).toBe('bodySite: BodyStructure/example · collector: Practitioner/example');
  });

  it('keeps the lossless JSON value available for the cell tooltip', () => {
    expect(previewCellTitle({ reference: 'Patient/example' })).toBe(
      '{"reference":"Patient/example"}',
    );
  });
});

describe('PreviewTable column controls', () => {
  it('reports row-limit changes to the preview owner', () => {
    const onLimitChange = jest.fn();
    render(
      React.createElement(PreviewTable, {
        preview,
        table,
        limit: 25,
        onLimitChange,
        onColumnChange: jest.fn(),
      }),
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: '100' },
    });
    expect(onLimitChange).toHaveBeenCalledWith(100);
  });

  it('uses scrollable table and selector surfaces', () => {
    render(
      React.createElement(PreviewTable, {
        preview,
        table,
        limit: 25,
        onLimitChange: jest.fn(),
        onColumnChange: jest.fn(),
      }),
    );

    expect(screen.getByTestId('preview-table-scroll')).toHaveClass(
      'overflow-x-auto',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));
    expect(screen.getByRole('list', { name: 'Table columns' })).toHaveClass(
      'overflow-y-auto',
    );
    expect(
      screen.getByText(/Drag rows to change table order/),
    ).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    expect(
      screen.queryByRole('list', { name: 'Table columns' }),
    ).not.toBeInTheDocument();
  });

  it('toggles visibility and drag-reorders columns from the selector', () => {
    const onColumnChange = jest.fn();
    render(
      React.createElement(PreviewTable, {
        preview,
        table,
        limit: 25,
        onLimitChange: jest.fn(),
        onColumnChange,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Columns' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'First column' }));
    expect(onColumnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        column: 'first_column',
        table: { visible: false, order: 0 },
      }),
    );

    onColumnChange.mockClear();
    const dataTransfer = {
      effectAllowed: 'move',
      setData: jest.fn(),
      getData: jest.fn(() => 'second_column'),
    };
    fireEvent.dragStart(screen.getByLabelText('Drag Second column'), {
      dataTransfer,
    });
    const firstRow = screen.getByLabelText('Drag First column').parentElement;
    expect(firstRow).not.toBeNull();
    fireEvent.dragOver(firstRow!, { clientY: 0, dataTransfer });
    fireEvent.drop(firstRow!, { clientY: 0, dataTransfer });

    expect(onColumnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        column: 'second_column',
        table: expect.objectContaining({ order: 0 }),
      }),
    );
    expect(onColumnChange).toHaveBeenCalledWith(
      expect.objectContaining({
        column: 'first_column',
        table: expect.objectContaining({ order: 1 }),
      }),
    );
  });
});
