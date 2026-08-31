import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type {
  ExplorerBuilderCandidate,
  ExplorerBuilderCatalog,
} from '@gen3/core';
import type { DraftTable } from '../authoring/model';
import { ColumnSelector, columnFromCandidate } from './ColumnSelector';

const catalog: ExplorerBuilderCatalog = {
  snapshotToken: 'snapshot',
  generation: 'generation',
  routePolicy: {},
  nodes: [
    {
      nodeId: 'research-subject',
      resourceType: 'ResearchSubject',
      rowRootEligible: true,
      populated: true,
      documentCount: 3,
    },
  ],
  edges: [],
  candidates: [],
};

const table: DraftTable = {
  outputId: 'Patient',
  tabId: 'patient',
  title: 'Patient',
  document: {
    kind: 'ExplorerBuilderDocument',
    output: { id: 'Patient', title: 'Patient' },
    rootResourceType: 'ResearchSubject',
    route: { occurrenceId: 'base', resourceType: 'ResearchSubject' },
    columns: [
      {
        column: 'research_subject_identifier',
        label: 'Research Subject ID',
        occurrenceId: 'base',
        source: {
          kind: 'field',
          fieldPath: 'identifier[].value',
          projectionMode: 'FIRST',
        },
        table: { visible: true, order: 0 },
      },
    ],
  },
};

describe('configured V2 columns', () => {
  it('renders document columns even when the catalog has no candidates', () => {
    const onChange = jest.fn();
    render(
      <ColumnSelector
        catalog={catalog}
        table={table}
        occurrenceId="base"
        disabled={false}
        onAdd={jest.fn()}
        onAddAll={jest.fn()}
        onChange={onChange}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText('Research Subject columns')).toBeInTheDocument();
    expect(screen.getByText(/research_subject_identifier/)).toBeInTheDocument();
    expect(screen.getByText(/1 configured · 0 available/)).toBeInTheDocument();

    const displayName = screen.getByRole('textbox', {
      name: 'Display name for configured Research Subject ID',
    });
    fireEvent.change(displayName, { target: { value: 'Subject ID' } });
    fireEvent.blur(displayName);
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        column: 'research_subject_identifier',
        label: 'Subject ID',
      }),
    );

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: 'Use Research Subject ID as filter',
      }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        column: 'research_subject_identifier',
        filter: { label: 'Research Subject ID' },
      }),
    );
  });

  it('shows primitive leaf fields, hides object containers, and adds from the table checkbox', () => {
    const candidate: ExplorerBuilderCandidate = {
      candidateId: 'c_birth_date',
      nodeId: 'research-subject',
      fieldPath: 'birthDate',
      label: 'Birth date',
      logicalType: 'date',
      filterable: true,
      chartable: true,
      projectionModes: ['FIRST'],
      defaultProjectionMode: 'FIRST',
    };
    const onAdd = jest.fn();
    const onAddAll = jest.fn();
    render(
      <ColumnSelector
        catalog={{
          ...catalog,
          candidates: [
            candidate,
            {
              ...candidate,
              candidateId: 'c_identifier_container',
              fieldPath: 'identifier[]',
              label: 'identifier',
              logicalType: 'unknown',
              repeated: true,
            },
          ],
        }}
        table={table}
        occurrenceId="base"
        disabled={false}
        onAdd={onAdd}
        onAddAll={onAddAll}
        onChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(screen.getByText(/1 configured · 1 available/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue('identifier')).not.toBeInTheDocument();
    const displayName = screen.getByRole('textbox', {
      name: 'Display name for available Birth date',
    });
    fireEvent.change(displayName, { target: { value: 'Date of birth' } });
    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Add Date of birth to table' }),
    );
    expect(onAdd).toHaveBeenCalledWith(candidate, 'Date of birth', 'TABLE');

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Add Date of birth as filter' }),
    );
    expect(onAdd).toHaveBeenCalledWith(candidate, 'Date of birth', 'FILTER');

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Add Date of birth as chart' }),
    );
    expect(onAdd).toHaveBeenCalledWith(candidate, 'Date of birth', 'CHART');

    fireEvent.click(
      screen.getByRole('button', { name: 'Select all table columns' }),
    );
    expect(onAddAll).toHaveBeenCalledWith([candidate]);
  });

  it('disables only presentations the catalog reports as unsupported', () => {
    const candidate: ExplorerBuilderCandidate = {
      candidateId: 'c_status',
      nodeId: 'research-subject',
      fieldPath: 'status',
      label: 'Status',
      logicalType: 'string',
      filterable: true,
      chartable: false,
      projectionModes: ['FIRST'],
      defaultProjectionMode: 'FIRST',
    };
    render(
      <ColumnSelector
        catalog={{
          ...catalog,
          candidates: [
            candidate,
            {
              ...candidate,
              candidateId: 'c_identifier',
              fieldPath: 'identifier[].value',
              label: 'Research Subject ID',
              filterable: false,
            },
          ],
        }}
        table={table}
        occurrenceId="base"
        disabled={false}
        onAdd={jest.fn()}
        onAddAll={jest.fn()}
        onChange={jest.fn()}
        onRemove={jest.fn()}
      />,
    );

    expect(
      screen.getByRole('checkbox', { name: 'Add Status as filter' }),
    ).toBeEnabled();
    expect(
      screen.getByRole('checkbox', { name: 'Add Status as chart' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {
        name: 'Use Research Subject ID as filter',
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole('checkbox', {
        name: 'Use Research Subject ID as chart',
      }),
    ).toBeDisabled();
  });

  it('toggles all configured table columns off without removing their configuration', () => {
    const onChange = jest.fn();
    render(
      <ColumnSelector
        catalog={catalog}
        table={table}
        occurrenceId="base"
        disabled={false}
        onAdd={jest.fn()}
        onAddAll={jest.fn()}
        onChange={onChange}
        onRemove={jest.fn()}
      />,
    );

    const toggle = screen.getByRole('button', {
      name: 'Deselect all table columns',
    });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        column: 'research_subject_identifier',
        table: expect.objectContaining({ visible: false }),
      }),
    );
  });

  it('converts a chosen candidate to one durable typed V2 column', () => {
    const column = columnFromCandidate(
      {
        candidateId: 'c_birth_date',
        nodeId: 'research-subject',
        fieldPath: 'birthDate',
        label: 'Birth date',
        logicalType: 'date',
        filterable: true,
        chartable: true,
        projectionModes: ['FIRST'],
        defaultProjectionMode: 'FIRST',
      },
      'patient-step',
      table.document.columns,
      'Date of birth',
    );

    expect(column).toMatchObject({
      column: 'patient_step__birth_date',
      label: 'Date of birth',
      occurrenceId: 'patient-step',
      source: {
        kind: 'field',
        fieldPath: 'birthDate',
        projectionMode: 'FIRST',
      },
      table: { visible: true, order: 1 },
    });
  });

  it('derives readable base column keys from resource type and FHIR leaf path', () => {
    const column = columnFromCandidate(
      {
        candidateId: 'c_5d11d8d24ce3124cea823c9e',
        nodeId: 'research-subject',
        fieldPath: 'identifier[].value',
        label: 'Research Subject ID',
        logicalType: 'string',
        repeated: true,
        filterable: true,
        chartable: false,
        projectionModes: ['FIRST', 'ALL'],
        defaultProjectionMode: 'FIRST',
      },
      'base',
      [],
      'Research Subject ID',
      'ResearchSubject',
    );

    expect(column.column).toBe('research_subject_identifier');
    expect(column.source.fieldPath).toBe('identifier[].value');
  });
});
