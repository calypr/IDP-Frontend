import {
  buildLoomAggregateQuery,
  buildLoomAggregationsQuery,
  buildLoomDatasetQuery,
  buildLoomRowsQuery,
  normalizeLoomAggregateGraphQLResponse,
  normalizeLoomRowsGraphQLResponse,
} from '../loomSlice';
import { isLoomDataType } from '../types';

describe('Loom GraphQL request contracts', () => {
  it('uses canonical Loom data types', () => {
    expect(isLoomDataType('DocumentReference')).toBe(true);
    expect(isLoomDataType('document_reference')).toBe(false);

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

  it('unwraps and shapes dataframeRows GraphQL responses', () => {
    const response = normalizeLoomRowsGraphQLResponse({
      dataframeRows: {
        materialization: {} as never,
        columns: ['id', 'title'],
        rows: [['file-1', 'example.tif']],
        totalCount: 1,
        pageInfo: { hasNextPage: false },
      },
    });

    expect(response.rows).toEqual([{ id: 'file-1', title: 'example.tif' }]);
    expect(response.totalCount).toBe(1);
  });

  it('unwraps and shapes dataframeAggregate GraphQL responses', () => {
    const response = normalizeLoomAggregateGraphQLResponse({
      dataframeAggregate: {
        materialization: {} as never,
        columns: ['status', 'count'],
        rows: [['active', '12']],
      },
    });

    expect(response.rows).toEqual([{ status: 'active', count: '12' }]);
  });
});
