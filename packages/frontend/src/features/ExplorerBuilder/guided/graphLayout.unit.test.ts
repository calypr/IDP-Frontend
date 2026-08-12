import { layoutDatasetGraph } from './graphLayout';

describe('layoutDatasetGraph', () => {
  const nodes = [
    { id: 'Patient', width: 220, height: 90 },
    { id: 'Observation', width: 220, height: 90 },
    { id: 'Specimen', width: 200, height: 80 },
    { id: 'DocumentReference', width: 230, height: 90 },
  ];
  const edges = [
    { id: 'patient-observation', source: 'Patient', target: 'Observation' },
    { id: 'patient-specimen', source: 'Patient', target: 'Specimen' },
    { id: 'observation-file', source: 'Observation', target: 'DocumentReference' },
    { id: 'specimen-file', source: 'Specimen', target: 'DocumentReference' },
  ];

  it('produces a deterministic left-to-right layered layout with routed edges', async () => {
    const first = await layoutDatasetGraph(nodes, edges);
    const second = await layoutDatasetGraph(nodes, edges);

    expect([...first.positions]).toEqual([...second.positions]);
    expect(first.positions.get('Patient')!.x).toBeLessThan(
      first.positions.get('Observation')!.x,
    );
    expect(first.positions.get('Observation')!.x).toBeLessThan(
      first.positions.get('DocumentReference')!.x,
    );
    expect([...first.routes.keys()].sort()).toEqual(
      edges.map((edge) => edge.id).sort(),
    );

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        const leftPosition = first.positions.get(left.id)!;
        const rightPosition = first.positions.get(right.id)!;
        const separated =
          leftPosition.x + left.width <= rightPosition.x ||
          rightPosition.x + right.width <= leftPosition.x ||
          leftPosition.y + left.height <= rightPosition.y ||
          rightPosition.y + right.height <= leftPosition.y;
        expect(separated).toBe(true);
      }
    }
  });
});
