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
const table = (resourceType = ''): DraftTable => ({
  outputId: 'table',
  tabId: 'tab-table',
  title: 'Table',
  document: {
    kind: 'ExplorerBuilderDocument',
    output: { id: 'table', title: 'Table' },
    rootResourceType: resourceType,
    route: { occurrenceId: 'base', resourceType },
    columns: [],
  },
});

describe('Builder V2 route actions', () => {
  it('does not offer edges before a row root exists', () => {
    expect(legalOutgoingEdges(catalog, table(), 'base')).toEqual([]);
  });

  it('offers directed edges from the selected occurrence', () => {
    expect(legalOutgoingEdges(catalog, table('Patient'), 'base')).toEqual([
      catalog.edges[0],
    ]);
    expect(
      legalEdgesToNode(catalog, table('Patient'), 'base', 'specimen'),
    ).toEqual([catalog.edges[0]]);
    expect(
      isLegalRouteExtension(
        catalog,
        table('Patient'),
        'base',
        'patient-specimen',
        'specimen',
      ),
    ).toBe(true);
  });

  it('honors self-loop and repeated-edge policy without a hidden hop cap', () => {
    const atSpecimen: DraftTable = {
      ...table('Patient'),
      document: {
        ...table('Patient').document,
        route: {
          occurrenceId: 'base',
          resourceType: 'Patient',
          children: [
            {
              occurrenceId: 'specimen',
              resourceType: 'Specimen',
              relationship: 'specimens',
            },
          ],
        },
      },
    };
    expect(legalOutgoingEdges(catalog, atSpecimen, 'specimen')).toContainEqual(
      catalog.edges[1],
    );
  });
});
