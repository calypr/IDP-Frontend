import { layoutDatasetGraph } from './graphLayout';

describe('layoutDatasetGraph', () => {
  it('keeps the graph deterministic, layered, and routed', async () => {
    const nodes = [
      { id: 'Patient', width: 220, height: 90 },
      { id: 'Observation', width: 220, height: 90 },
      { id: 'DocumentReference', width: 230, height: 90 },
    ];
    const edges = [
      { id: 'patient-observation', source: 'Patient', target: 'Observation' },
      {
        id: 'observation-file',
        source: 'Observation',
        target: 'DocumentReference',
      },
    ];
    const first = await layoutDatasetGraph(nodes, edges);
    const second = await layoutDatasetGraph(nodes, edges);
    expect([...first.positions]).toEqual([...second.positions]);
    expect(first.positions.get('Patient')!.x).toBeLessThan(
      first.positions.get('Observation')!.x,
    );
    expect(first.positions.get('Observation')!.x).toBeLessThan(
      first.positions.get('DocumentReference')!.x,
    );
    expect(
      nodes.every((node) => {
        const position = first.positions.get(node.id);
        return Number.isFinite(position?.x) && Number.isFinite(position?.y);
      }),
    ).toBe(true);
    expect([...first.routes.keys()].sort()).toEqual(
      edges.map((edge) => edge.id).sort(),
    );
  });
});
