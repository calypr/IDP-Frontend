import { fetchGraphQL } from '@gen3/core';
import { scanFhirProjectMap } from './fhirProjectMap';

jest.mock('@gen3/core', () => ({
  GEN3_LOOM_API: '/loom',
  fetchGraphQL: jest.fn(),
}));

describe('scanFhirProjectMap', () => {
  it('requests the scoped project and removes relationship-path artifacts', async () => {
    (fetchGraphQL as jest.Mock).mockResolvedValueOnce({
      dataframeBuilderProjectMap: {
        resources: [
          { resourceType: 'Patient', documentCount: 12, fields: [], traversals: [] },
          { resourceType: 'Specimen', documentCount: 3, fields: [], traversals: [] },
          { resourceType: 'Organization', documentCount: 2, fields: [{ fieldRef: 'Organization.id' }], traversals: [] },
          { resourceType: 'Parent', fields: [], traversals: [] },
        ],
        relationships: [
          { fromType: 'Patient', label: 'subject_Specimen', toType: 'Specimen', edgeCount: 4 },
          { fromType: 'Specimen', label: 'parent', toType: 'Parent', edgeCount: 3 },
        ],
      },
    });

    const map = await scanFhirProjectMap('HTAN_INT/BForePC');

    expect(fetchGraphQL).toHaveBeenCalledWith(
      expect.objectContaining({
        variables: {
          input: {
            project: 'HTAN_INT/BForePC',
            includePivotOnlyFields: false,
          },
        },
      }),
      expect.objectContaining({ endpoint: '/loom/graphql/graph' }),
    );
    expect(map.nodes.map((node) => node.resourceType)).toEqual(['Patient', 'Specimen']);
    expect(map.edges).toEqual([
      expect.objectContaining({ label: 'subject_Specimen', edgeCount: 4 }),
    ]);
  });
});
