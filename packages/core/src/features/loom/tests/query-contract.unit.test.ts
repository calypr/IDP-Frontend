import {
  buildLoomAggregateQuery,
  buildLoomAggregationsQuery,
  buildLoomDatasetQuery,
  buildLoomDatasetSelectorQuery,
  buildLoomRowsQuery,
  normalizeLoomAggregateGraphQLResponse,
  normalizeLoomRowsGraphQLResponse,
} from '../loomSlice';
import {
  isLoomDataType,
  loomDatasetIdentityKey,
  normalizeLegacyLoomOutput,
} from '../types';

describe('Loom GraphQL request contracts', () => {
  it('uses canonical Loom data types', () => {
    expect(isLoomDataType('Patient')).toBe(true);
    expect(isLoomDataType('DocumentReference')).toBe(true);
    expect(isLoomDataType('document_reference')).toBe(false);

    const request = buildLoomDatasetQuery('DocumentReference');
    expect(request.variables).toEqual({ dataType: 'DocumentReference' });
    expect(request.query).toContain('dataframeDataset');
  });

  it.each([
    ['file', 'DocumentReference'],
    ['document_reference', 'DocumentReference'],
    ['research_subject', 'ResearchSubject'],
    ['specimen', 'Specimen'],
    ['medication_administration', 'MedicationAdministration'],
    ['group_member', 'GroupMember'],
    ['CustomOutput', 'CustomOutput'],
  ])(
    'normalizes legacy output %s without closing custom outputs',
    (input, expected) => {
      expect(normalizeLegacyLoomOutput(input)).toEqual({ output: expected });
    },
  );

  it('reports unsupported aliases instead of falling back to DocumentReference', () => {
    expect(normalizeLegacyLoomOutput('unknown_output').diagnostic?.code).toBe(
      'UNSUPPORTED_LEGACY_OUTPUT',
    );
  });

  it('builds and keys immutable materialization selectors', () => {
    const identity = {
      selector: {
        recipe: 'project_recipe',
        translationVersion: 'r000001_abcd',
        output: 'CustomOutput',
        materializationId: 'materialization-1',
      },
    } as const;
    expect(buildLoomDatasetSelectorQuery(identity).variables).toEqual({
      input: { materializationId: 'materialization-1' },
    });
    expect(loomDatasetIdentityKey(identity)).toContain('CustomOutput');
    expect(loomDatasetIdentityKey(identity)).toContain('materialization-1');
  });

  it('keeps immutable recipe selectors nested in GraphQL input', () => {
    expect(
      buildLoomRowsQuery({
        selector: {
          recipe: 'project_recipe',
          translationVersion: 'r000001_abcd',
          output: 'CustomOutput',
        },
        columns: ['id'],
      }).variables,
    ).toMatchObject({
      input: {
        selector: {
          recipe: 'project_recipe',
          translationVersion: 'r000001_abcd',
          output: 'CustomOutput',
        },
      },
    });
  });

  it('supports direct materialization IDs for rows and single aggregates', () => {
    expect(
      buildLoomRowsQuery({ materializationId: 'mat-1', columns: ['id'] }).variables,
    ).toMatchObject({ input: { materializationId: 'mat-1' } });
    expect(
      buildLoomAggregateQuery({
        materializationId: 'mat-1',
        operation: 'COUNT',
      }).variables,
    ).toMatchObject({ input: { materializationId: 'mat-1' } });
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
