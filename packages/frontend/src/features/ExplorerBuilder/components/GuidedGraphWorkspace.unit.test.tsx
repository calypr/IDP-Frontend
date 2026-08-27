import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ExplorerBuilderCatalog } from '@gen3/core';
import type { DraftTable } from '../authoring/model';
import { GuidedGraphWorkspace } from './GuidedGraphWorkspace';

const mockFitView = jest.fn();
const mockLayoutDatasetGraph = jest.fn();

jest.mock('@xyflow/react', () => {
  const ReactFlow = ({
    nodes,
    edges,
    children,
    onNodeClick,
    onPaneClick,
  }: {
    readonly nodes: ReadonlyArray<{
      readonly id: string;
      readonly data: { readonly label: React.ReactNode };
      readonly style?: { readonly border?: string };
    }>;
    readonly edges: ReadonlyArray<{
      readonly id: string;
      readonly source: string;
      readonly target: string;
      readonly markerEnd?: { readonly type?: string };
    }>;
    readonly children?: React.ReactNode;
    readonly onNodeClick?: (
      event: unknown,
      node: { readonly id: string },
    ) => void;
    readonly onPaneClick?: () => void;
  }) => (
    <div
      data-testid="mock-react-flow"
      data-node-count={nodes.length}
      data-edge-count={edges.length}
    >
      {nodes.map((node) => (
        <button
          type="button"
          key={node.id}
          aria-label={`Graph node ${node.id}`}
          data-testid={`graph-node-${node.id}`}
          data-border={node.style?.border}
          onClick={(event) => onNodeClick?.(event, node)}
        >
          {node.data.label}
        </button>
      ))}
      {edges.map((edge) => (
        <div
          key={edge.id}
          data-testid={`graph-edge-${edge.id}`}
          data-source={edge.source}
          data-target={edge.target}
          data-marker-type={edge.markerEnd?.type}
        />
      ))}
      <button type="button" onClick={onPaneClick}>
        Graph background
      </button>
      {children}
    </div>
  );
  return {
    Background: () => null,
    Controls: () => null,
    MarkerType: { ArrowClosed: 'arrowclosed' },
    ReactFlow,
    useNodesInitialized: () => true,
    useReactFlow: () => ({
      fitView: mockFitView,
      viewportInitialized: true,
    }),
  };
});

jest.mock('../graphLayout', () => ({
  layoutDatasetGraph: (...args: unknown[]) => mockLayoutDatasetGraph(...args),
}));

jest.mock('./RouteExtensionPanel', () => ({
  RouteExtensionPanel: () => null,
}));

const catalog: ExplorerBuilderCatalog = {
  snapshotToken: 'snapshot',
  generation: 'generation',
  routePolicy: { allowRepeatedEdges: true, allowSelfLoops: true },
  nodes: [
    {
      nodeId: 'node-patient',
      resourceType: 'Patient',
      rowRootEligible: true,
      populated: true,
      documentCount: 3,
    },
    {
      nodeId: 'node-document',
      resourceType: 'DocumentReference',
      rowRootEligible: true,
      populated: true,
      documentCount: 2,
    },
    {
      nodeId: 'node-file',
      resourceType: 'File',
      rowRootEligible: false,
      populated: true,
      documentCount: 1,
    },
    {
      nodeId: 'node-orphan',
      resourceType: 'Condition',
      rowRootEligible: false,
      populated: false,
      documentCount: 0,
    },
  ],
  edges: [
    {
      edgeId: 'patient-document',
      fromNodeId: 'node-patient',
      toNodeId: 'node-document',
      label: 'has document',
    },
    {
      edgeId: 'document-file',
      fromNodeId: 'node-document',
      toNodeId: 'node-file',
      label: 'references file',
    },
  ],
  candidates: [],
};

const table = (rootNodeId: string): DraftTable => ({
  outputId: 'documents',
  tabId: 'documents',
  title: 'Documents',
  document: {
    kind: 'ExplorerBuilderDocument',
    output: { id: 'documents', title: 'Documents' },
    rootResourceType:
      catalog.nodes.find((node) => node.nodeId === rootNodeId)?.resourceType ??
      rootNodeId,
    route: {
      occurrenceId: 'base',
      resourceType:
        catalog.nodes.find((node) => node.nodeId === rootNodeId)
          ?.resourceType ?? rootNodeId,
    },
    columns: [],
  },
});

const renderGraph = (currentTable: DraftTable) =>
  render(
    <GuidedGraphWorkspace
      catalog={catalog}
      table={currentTable}
      selectedOccurrenceId="base"
      disabled={false}
      onSelectOccurrence={jest.fn()}
      onSetBase={jest.fn()}
      onChangeBase={jest.fn()}
      onAppendEdge={jest.fn()}
      onTruncate={jest.fn()}
    />,
  );

describe('GuidedGraphWorkspace', () => {
  beforeEach(() => {
    mockFitView.mockReset();
    mockLayoutDatasetGraph.mockReset();
    mockLayoutDatasetGraph.mockImplementation(async (nodes) => ({
      positions: new Map(
        nodes.map((node: { id: string }, index: number) => [
          node.id,
          { x: index * 220, y: 0 },
        ]),
      ),
      routes: new Map(),
    }));
  });

  it('shows the full graph and optionally includes orphans', async () => {
    renderGraph(table('node-document'));

    await waitFor(() =>
      expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
        'data-node-count',
        '3',
      ),
    );
    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-edge-count',
      '2',
    );
    expect(screen.getByTestId('graph-edge-patient-document')).toHaveAttribute(
      'data-source',
      'node-patient',
    );
    expect(screen.getByTestId('graph-edge-patient-document')).toHaveAttribute(
      'data-target',
      'node-document',
    );
    expect(screen.getByTestId('graph-edge-patient-document')).toHaveAttribute(
      'data-marker-type',
      'arrowclosed',
    );
    expect(screen.getByTestId('graph-node-node-document')).toBeInTheDocument();
    expect(screen.getByTestId('graph-node-node-patient')).toBeInTheDocument();
    expect(
      screen.queryByTestId('graph-node-node-orphan'),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(mockFitView).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show orphans' }));

    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-node-count',
      '4',
    );
    expect(screen.getByTestId('graph-node-node-orphan')).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'Focus route' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the graph populated when a stale route id does not match catalog nodes', async () => {
    renderGraph(table('DocumentReference'));

    await waitFor(() =>
      expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
        'data-node-count',
        '3',
      ),
    );
    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-edge-count',
      '2',
    );
  });

  it('renders and independently selects every sibling in a configured route tree', async () => {
    const siblingCatalog: ExplorerBuilderCatalog = {
      ...catalog,
      nodes: [
        {
          nodeId: 'node-specimen',
          resourceType: 'Specimen',
          rowRootEligible: true,
          populated: true,
          documentCount: 2,
        },
        {
          nodeId: 'node-observation',
          resourceType: 'Observation',
          rowRootEligible: true,
          populated: true,
          documentCount: 2,
        },
        {
          nodeId: 'node-patient',
          resourceType: 'Patient',
          rowRootEligible: true,
          populated: true,
          documentCount: 2,
        },
      ],
      edges: [
        {
          edgeId: 'specimen-observation',
          fromNodeId: 'node-specimen',
          toNodeId: 'node-observation',
          label: 'focus_Specimen',
        },
        {
          edgeId: 'specimen-patient',
          fromNodeId: 'node-specimen',
          toNodeId: 'node-patient',
          label: 'subject_Patient',
        },
      ],
    };
    const siblingTable: DraftTable = {
      outputId: 'Specimen',
      tabId: 'Specimen',
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
            {
              occurrenceId: 'patient',
              resourceType: 'Patient',
              relationship: 'subject_Patient',
            },
          ],
        },
        columns: [],
      },
    };
    const onSelectOccurrence = jest.fn();

    render(
      <GuidedGraphWorkspace
        catalog={siblingCatalog}
        table={siblingTable}
        selectedOccurrenceId="base"
        disabled={false}
        onSelectOccurrence={onSelectOccurrence}
        onSetBase={jest.fn()}
        onChangeBase={jest.fn()}
        onAppendEdge={jest.fn()}
        onTruncate={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
        'data-node-count',
        '3',
      ),
    );
    expect(
      screen.getByRole('button', { name: 'Observation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Patient' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
    expect(onSelectOccurrence).toHaveBeenCalledWith('patient');
  });

  it('expands on graph interaction, highlights the clicked node, and directly adds one legal edge', async () => {
    const onAppendEdge = jest.fn();
    render(
      <GuidedGraphWorkspace
        catalog={catalog}
        table={table('node-document')}
        selectedOccurrenceId="base"
        disabled={false}
        onSelectOccurrence={jest.fn()}
        onSetBase={jest.fn()}
        onChangeBase={jest.fn()}
        onAppendEdge={onAppendEdge}
        onTruncate={jest.fn()}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('graph-node-node-file')).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: 'Expand graph' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('graph-node-node-file'));

    expect(onAppendEdge).toHaveBeenCalledWith(
      'base',
      'document-file',
      'node-file',
    );
    const expandedGraph = screen.getByRole('dialog', {
      name: 'Expanded dataset graph',
    });
    expect(expandedGraph).toBeInTheDocument();
    expect(expandedGraph).toHaveClass('fixed', 'inset-3');
    expect(expandedGraph).not.toHaveClass('relative');
    expect(screen.getByTestId('graph-node-node-file')).toHaveAttribute(
      'data-border',
      '3px solid #f59e0b',
    );
  });
});
