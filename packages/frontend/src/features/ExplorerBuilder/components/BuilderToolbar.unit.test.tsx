import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { DraftTable } from '../authoring/model';
import { BuilderToolbar } from './BuilderToolbar';

const draftTable = (outputId: string, title: string): DraftTable => ({
  outputId,
  tabId: outputId.toLowerCase(),
  title,
  document: {
    kind: 'ExplorerBuilderDocument',
    output: { id: outputId, title },
    rootResourceType: 'Patient',
    route: { occurrenceId: 'base', resourceType: 'Patient' },
    columns: [],
  },
});

describe('BuilderToolbar', () => {
  it('uses one draggable table menu for selection, naming, and ordering', () => {
    const onSelectTable = jest.fn();
    const onRenameTable = jest.fn();
    const onReorderTable = jest.fn();
    render(
      <BuilderToolbar
        explorers={[
          {
            project: 'HTAN_INT/BForePC',
            explorerId: 'default',
            title: 'Default',
            management: 'repository',
            updatedAt: '2026-08-27T00:00:00Z',
          },
        ]}
        selectedExplorerId="default"
        onExplorerChange={jest.fn()}
        onCreateExplorer={jest.fn()}
        deleteSupported={false}
        tables={[
          draftTable('Patient', 'Patient'),
          draftTable('Specimen', 'Specimen'),
        ]}
        selectedOutputId="Patient"
        onSelectTable={onSelectTable}
        onRenameTable={onRenameTable}
        onNewTable={jest.fn()}
        onDuplicateTable={jest.fn()}
        onDeleteTable={jest.fn()}
        onReorderTable={onReorderTable}
        onPreview={jest.fn()}
        onPublish={jest.fn()}
        previewDisabled={false}
        publishDisabled={false}
        columnCreationSupported={false}
      />,
    );

    expect(screen.getByLabelText('Table selector')).toHaveTextContent(
      'Patient',
    );
    expect(screen.queryByText(/Tables \(2\)/)).not.toBeInTheDocument();
    expect(screen.queryByText('Open explorer')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Table name')).not.toBeInTheDocument();

    const specimenName = screen.getByLabelText('Table name for Specimen');
    fireEvent.focus(specimenName);
    expect(onSelectTable).toHaveBeenCalledWith('Specimen');
    fireEvent.change(specimenName, { target: { value: 'Samples' } });
    expect(onRenameTable).toHaveBeenCalledWith('Specimen', 'Samples');

    fireEvent.dragStart(screen.getByLabelText('Drag Patient'));
    const specimenRow = specimenName.closest('li');
    expect(specimenRow).not.toBeNull();
    fireEvent.dragOver(specimenRow!);
    fireEvent.drop(specimenRow!);
    expect(onReorderTable).toHaveBeenCalledWith('Patient', undefined);
  });
});
