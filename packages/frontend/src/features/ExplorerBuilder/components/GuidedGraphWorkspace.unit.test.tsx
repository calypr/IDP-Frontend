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
  }: {
    readonly nodes: ReadonlyArray<{
      readonly id: string;
      readonly data: { readonly label: React.ReactNode };
    }>;
    readonly edges: ReadonlyArray<{
      readonly id: string;
      readonly source: string;
      readonly target: string;
      readonly markerEnd?: { readonly type?: string };
    }>;
    readonly children?: React.ReactNode;
  }) => (
    <div
      data-testid="mock-react-flow"
      data-node-count={nodes.length}
      data-edge-count={edges.length}
    >
      {nodes.map((node) => (
        <div key={node.id} data-testid={`graph-node-${node.id}`}>
          {node.data.label}
        </div>
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
    { nodeId: 'node-patient', resourceType: 'Patient', rowRootEligible: true, populated: true, documentCount: 3 },
    { nodeId: 'node-document', resourceType: 'DocumentReference', rowRootEligible: true, populated: true, documentCount: 2 },
    { nodeId: 'node-file', resourceType: 'File', rowRootEligible: false, populated: true, documentCount: 1 },
    { nodeId: 'node-orphan', resourceType: 'Condition', rowRootEligible: false, populated: false, documentCount: 0 },
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
  rootNodeId,
  routeSteps: [],
  selections: [],
  presentation: {},
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

  it('shows the full graph by default and supports focused inspection', async () => {
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
    expect(screen.queryByTestId('graph-node-node-orphan')).not.toBeInTheDocument();
    await waitFor(() => expect(mockFitView).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('checkbox', { name: 'Show orphans' }));

    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-node-count',
      '4',
    );
    expect(screen.getByTestId('graph-node-node-orphan')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Focus route' }));

    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-node-count',
      '2',
    );
    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-edge-count',
      '1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show full graph' }));

    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-node-count',
      '4',
    );
    expect(screen.getByTestId('mock-react-flow')).toHaveAttribute(
      'data-edge-count',
      '2',
    );
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
});
