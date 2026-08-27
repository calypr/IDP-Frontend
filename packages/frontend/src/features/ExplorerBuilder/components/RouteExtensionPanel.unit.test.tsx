import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ExplorerBuilderCatalog } from '@gen3/core';
import type { DraftTable } from '../authoring/model';
import { RouteExtensionPanel } from './RouteExtensionPanel';

const catalog: ExplorerBuilderCatalog = {
  snapshotToken: 'snapshot',
  generation: 'generation',
  routePolicy: { allowRepeatedEdges: true, allowSelfLoops: false },
  nodes: [
    {
      nodeId: 'specimen',
      resourceType: 'Specimen',
      rowRootEligible: true,
      populated: true,
      documentCount: 2,
    },
    {
      nodeId: 'observation',
      resourceType: 'Observation',
      rowRootEligible: true,
      populated: true,
      documentCount: 2,
    },
    {
      nodeId: 'patient',
      resourceType: 'Patient',
      rowRootEligible: true,
      populated: true,
      documentCount: 2,
    },
  ],
  edges: [
    {
      edgeId: 'specimen-observation',
      fromNodeId: 'specimen',
      toNodeId: 'observation',
      label: 'focus_Specimen',
    },
    {
      edgeId: 'specimen-patient',
      fromNodeId: 'specimen',
      toNodeId: 'patient',
      label: 'subject_Patient',
    },
    {
      edgeId: 'observation-patient',
      fromNodeId: 'observation',
      toNodeId: 'patient',
      label: 'subject_Patient',
    },
  ],
  candidates: [],
};

const table: DraftTable = {
  outputId: 'Specimen',
  tabId: 'specimen',
  title: 'Specimen',
  document: {
    kind: 'ExplorerBuilderDocument',
    output: { id: 'Specimen', title: 'Specimen' },
    rootResourceType: 'Specimen',
    route: {
      occurrenceId: 'base',
      resourceType: 'Specimen',
      children: [
        {
          occurrenceId: 'observation',
          resourceType: 'Observation',
          relationship: 'focus_Specimen',
        },
      ],
    },
    columns: [],
  },
};

describe('RouteExtensionPanel', () => {
  it('does not render relationship controls for one unambiguous edge', () => {
    const { container } = render(
      <RouteExtensionPanel
        catalog={catalog}
        table={table}
        selectedOccurrenceId="base"
        inspectedNodeId="patient"
        disabled={false}
        onSelectEdge={jest.fn()}
        onUseAsRowStart={jest.fn()}
        onChangeRowStart={jest.fn()}
        onAddEdge={jest.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('only asks for a relationship when multiple edges reach the resource', () => {
    const onSelectEdge = jest.fn();
    const onAddEdge = jest.fn();
    const ambiguousCatalog: ExplorerBuilderCatalog = {
      ...catalog,
      edges: [
        ...catalog.edges,
        {
          edgeId: 'specimen-patient-secondary',
          fromNodeId: 'specimen',
          toNodeId: 'patient',
          label: 'participant_Patient',
        },
      ],
    };
    const { rerender } = render(
      <RouteExtensionPanel
        catalog={ambiguousCatalog}
        table={table}
        selectedOccurrenceId="base"
        inspectedNodeId="patient"
        disabled={false}
        onSelectEdge={onSelectEdge}
        onUseAsRowStart={jest.fn()}
        onChangeRowStart={jest.fn()}
        onAddEdge={onAddEdge}
      />,
    );

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Relationship to add' }),
      {
        target: { value: 'specimen-patient' },
      },
    );
    expect(onSelectEdge).toHaveBeenCalledWith('specimen-patient');

    rerender(
      <RouteExtensionPanel
        catalog={ambiguousCatalog}
        table={table}
        selectedOccurrenceId="base"
        inspectedNodeId="patient"
        selectedEdgeId="specimen-patient"
        disabled={false}
        onSelectEdge={onSelectEdge}
        onUseAsRowStart={jest.fn()}
        onChangeRowStart={jest.fn()}
        onAddEdge={onAddEdge}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add branch' }));
    expect(onAddEdge).toHaveBeenCalledWith('specimen-patient', 'patient');
  });

  it('offers a clear destructive restart for an eligible disconnected node', () => {
    const disconnectedCatalog: ExplorerBuilderCatalog = {
      ...catalog,
      nodes: [
        ...catalog.nodes,
        {
          nodeId: 'substance',
          resourceType: 'Substance',
          rowRootEligible: true,
          populated: true,
          documentCount: 1,
        },
      ],
    };
    const onChangeRowStart = jest.fn();
    render(
      <RouteExtensionPanel
        catalog={disconnectedCatalog}
        table={table}
        selectedOccurrenceId="base"
        inspectedNodeId="substance"
        disabled={false}
        onSelectEdge={jest.fn()}
        onUseAsRowStart={jest.fn()}
        onChangeRowStart={onChangeRowStart}
        onAddEdge={jest.fn()}
      />,
    );

    expect(screen.queryByText(/not reachable/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Start new query from Substance',
      }),
    );
    expect(onChangeRowStart).toHaveBeenCalledWith('substance');
  });
});
