import type { ExplorerBuilderCatalog } from '@gen3/core';
import type { DraftTable } from './model';
import {
  isLegalRouteExtension,
  legalEdgesToNode,
  legalOutgoingEdges,
} from './routeActions';

const catalog: ExplorerBuilderCatalog = {
  snapshotToken: 'snapshot',
  generation: 'generation',
  routePolicy: { allowRepeatedEdges: true, allowSelfLoops: true },
  nodes: [
    {
      nodeId: 'patient',
      resourceType: 'Patient',
      rowRootEligible: true,
      populated: true,
      documentCount: 1,
    },
    {
      nodeId: 'specimen',
      resourceType: 'Specimen',
      rowRootEligible: true,
      populated: true,
      documentCount: 1,
    },
  ],
  edges: [
    {
      edgeId: 'patient-specimen',
      fromNodeId: 'patient',
      toNodeId: 'specimen',
      label: 'specimens',
    },
    {
      edgeId: 'specimen-self',
      fromNodeId: 'specimen',
      toNodeId: 'specimen',
      label: 'related',
    },
  ],
  candidates: [],
};
const table = (rootNodeId?: string): DraftTable => ({
  outputId: 'table',
  tabId: 'tab-table',
  title: 'Table',
  rootNodeId,
  routeSteps: [],
  selections: [],
  presentation: {},
});

describe('Builder V2 route actions', () => {
  it('does not offer edges before a row root exists', () => {
    expect(legalOutgoingEdges(catalog, table())).toEqual([]);
  });

  it('offers directed edges from the derived route tail', () => {
    expect(legalOutgoingEdges(catalog, table('patient'))).toEqual([
      catalog.edges[0],
    ]);
    expect(legalEdgesToNode(catalog, table('patient'), 'specimen')).toEqual([
      catalog.edges[0],
    ]);
    expect(
      isLegalRouteExtension(
        catalog,
        table('patient'),
        'patient-specimen',
        'specimen',
      ),
    ).toBe(true);
  });

  it('honors self-loop and repeated-edge policy without a hidden hop cap', () => {
    const atSpecimen: DraftTable = {
      ...table('patient'),
      routeSteps: [
        { edgeId: 'patient-specimen', occurrenceId: 'specimen-1' },
        ...Array.from({ length: 20 }, (_, index) => ({
          edgeId: 'specimen-self',
          occurrenceId: `specimen-${index + 2}`,
        })),
      ],
    };
    expect(legalOutgoingEdges(catalog, atSpecimen)).toContainEqual(
      catalog.edges[1],
    );
  });
});
