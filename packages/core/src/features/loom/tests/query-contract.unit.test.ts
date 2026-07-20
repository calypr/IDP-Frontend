import {
  buildLoomAggregateQuery,
  buildLoomAggregationsQuery,
  buildLoomDatasetQuery,
  buildLoomRowsQuery,
} from '../loomSlice';

describe('Loom GraphQL request contracts', () => {
  it('maps a legacy file request at the caller boundary', () => {
    const request = buildLoomDatasetQuery('DocumentReference');
    expect(request.variables).toEqual({ dataType: 'DocumentReference' });
    expect(request.query).toContain('dataframeDataset');
  });

  it('preserves opaque cursor pagination and sort variables', () => {
    const request = buildLoomRowsQuery({
      dataType: 'ResearchSubject',
      columns: ['id', 'status'],
      filters: [{ column: 'status', op: 'EQ', value: 'active' }],
      sort: { column: 'id', desc: true },
      first: 10,
      after: 'opaque-next-cursor',
    });
    expect(request.variables).toEqual({
      input: {
        dataType: 'ResearchSubject',
        columns: ['id', 'status'],
        filters: [{ column: 'status', op: 'EQ', value: 'active' }],
        sort: { column: 'id', desc: true },
        first: 10,
        after: 'opaque-next-cursor',
      },
    });
  });

  it('builds grouped and filtered aggregate requests', () => {
    const aggregate = buildLoomAggregateQuery({
      dataType: 'Specimen',
      groupBy: ['status'],
      filters: [{ column: 'project_id', op: 'EQ', value: 'p1' }],
      operation: 'COUNT',
      column: 'status',
    });
    expect(aggregate.variables).toMatchObject({
      input: {
        dataType: 'Specimen',
        groupBy: ['status'],
        operation: 'COUNT',
      },
    });

    const aggregations = buildLoomAggregationsQuery({
      dataType: 'MedicationAdministration',
      fields: ['status'],
      filters: [{ column: 'status', op: 'IN', value: ['active', 'stopped'] }],
    });
    expect(aggregations.query).toContain('a0: dataframeAggregate');
    expect(aggregations.variables).toEqual({
      dataType: 'MedicationAdministration',
      filters: [{ column: 'status', op: 'IN', value: ['active', 'stopped'] }],
    });
  });
});
