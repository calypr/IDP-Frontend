import {
  buildLoomAggregateQuery,
  buildLoomAggregationsQuery,
  buildLoomCountQuery,
  buildLoomDatasetQuery,
  buildLoomDatasetSelectorQuery,
  buildLoomRowsQuery,
  normalizeLoomAggregateGraphQLResponse,
  normalizeLoomRowsGraphQLResponse,
} from '../loomSlice';
import { dataframeSelectorForRecipeOutput } from '../explorer';
import { buildLoomDownloadRequest } from '../loomDownload';
import {
  isLoomDataType,
  loomDatasetIdentityKey,
  normalizeLegacyLoomOutput,
} from '../types';

describe('Loom GraphQL request contracts', () => {
  const selector = {
    recipe: 'project_recipe',
    translationVersion: 'r000001_abcd',
    output: 'CustomOutput',
  } as const;

  it('requires complete recipe selectors for every dataframe request', () => {
    expect(isLoomDataType('Patient')).toBe(true);
    expect(isLoomDataType('DocumentReference')).toBe(true);
    expect(isLoomDataType('document_reference')).toBe(false);

    const request = buildLoomDatasetQuery(selector);
    expect(request.variables).toEqual({ input: { selector } });
    expect(request.query).toContain('dataframeDataset');
  });

  it('derives selectors only from server recipe identity', () => {
    expect(
      dataframeSelectorForRecipeOutput(
        {
          recipeName: 'calypr-meta-default',
          translationVersion: 'r000042_default',
        },
        'Patient',
      ),
    ).toEqual({
      recipe: 'calypr-meta-default',
      translationVersion: 'r000042_default',
      output: 'Patient',
    });
    expect(() =>
      dataframeSelectorForRecipeOutput({ outputs: [{ name: 'Patient' }] }, 'Patient'),
    ).toThrow('server recipe name');
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

  it('builds and keys immutable recipe selectors', () => {
    const identity = { selector } as const;
    expect(buildLoomDatasetSelectorQuery(identity).variables).toEqual({
      input: { selector },
    });
    expect(loomDatasetIdentityKey(identity)).toContain('CustomOutput');
    expect(loomDatasetIdentityKey(identity)).toContain('r000001_abcd');
  });

  it('does not serialize the unsupported legacy project scope field', () => {
    const identity = { selector, projectIds: ['project-b', 'project-a', 'project-b'] } as const;
    expect(buildLoomDatasetSelectorQuery(identity).variables).toEqual({
      input: { selector },
    });
    expect(buildLoomRowsQuery({ ...identity, columns: ['id'] }).variables).toMatchObject({
      input: { selector },
    });
    expect(buildLoomAggregateQuery({ ...identity, operation: 'COUNT' }).variables).toMatchObject({
      input: { selector },
    });
    expect(buildLoomCountQuery({ ...identity, operation: 'COUNT' }).variables).toMatchObject({
      input: { selector },
    });
    expect(buildLoomAggregationsQuery({ ...identity, fields: ['status'] }).variables).toMatchObject({
      input0: { selector },
    });
    expect(buildLoomDownloadRequest({ ...identity, fields: ['id'], format: 'csv' })).toMatchObject({
      selector,
    });
    expect(JSON.stringify(identity)).toContain('projectIds');
    expect(JSON.stringify([
      buildLoomDatasetSelectorQuery(identity),
      buildLoomRowsQuery({ ...identity, columns: ['id'] }),
      buildLoomAggregateQuery({ ...identity, operation: 'COUNT' }),
      buildLoomCountQuery({ ...identity, operation: 'COUNT' }),
      buildLoomAggregationsQuery({ ...identity, fields: ['status'] }),
      buildLoomDownloadRequest({ ...identity, fields: ['id'], format: 'csv' }),
    ])).not.toContain('projectIds');
    expect(loomDatasetIdentityKey(identity)).toBe(
      loomDatasetIdentityKey({ selector }),
    );
  });

  it('keeps immutable recipe selectors nested in GraphQL input', () => {
    expect(
      buildLoomRowsQuery({
        selector,
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

  it('never asks Loom to expose internal authorization or pagination columns', () => {
    expect(
      buildLoomRowsQuery({
        selector,
        columns: ['id', 'auth_resource_path', '__loom_row_id'],
        sort: { column: 'auth_resource_path', desc: false },
      }).variables,
    ).toMatchObject({
      input: {
        selector,
        columns: ['id'],
        sort: undefined,
      },
    });
  });

  it('uses the selector for rows, counts, and single aggregates', () => {
    expect(
      buildLoomRowsQuery({ selector, columns: ['id'] }).variables,
    ).toMatchObject({ input: { selector } });
    expect(
      buildLoomAggregateQuery({
        selector,
        operation: 'COUNT',
      }).variables,
    ).toMatchObject({ input: { selector } });
    expect(
      buildLoomCountQuery({ selector, operation: 'COUNT' }).variables,
    ).toMatchObject({ input: { selector } });
  });

  it('preserves opaque cursor pagination and sort variables', () => {
    const request = buildLoomRowsQuery({
      selector,
      columns: ['id', 'status'],
      filters: [{ column: 'status', op: 'EQ', value: 'active' }],
      sort: { column: 'id', desc: true },
      first: 10,
      after: 'opaque-next-cursor',
    });
    expect(request.variables).toEqual({
      input: {
        selector,
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
      selector,
      groupBy: ['status'],
      filters: [{ column: 'project_id', op: 'EQ', value: 'p1' }],
      operation: 'COUNT',
      column: 'status',
    });
    expect(aggregate.variables).toMatchObject({
      input: {
        selector,
        groupBy: ['status'],
        operation: 'COUNT',
      },
    });

    const aggregations = buildLoomAggregationsQuery({
      selector,
      fields: ['status'],
      filters: [{ column: 'status', op: 'IN', value: ['active', 'stopped'] }],
    });
    expect(aggregations.query).toContain('a0: dataframeAggregate');
    expect(aggregations.variables).toEqual({
      input0: {
        selector,
        groupBy: ['status'],
        filters: [{ column: 'status', op: 'IN', value: ['active', 'stopped'] }],
        operation: 'COUNT',
        column: 'status',
      },
    });
  });

  it('rejects empty aggregation selections before GraphQL serialization', () => {
    expect(() =>
      buildLoomAggregationsQuery({
        selector,
        fields: [],
      }),
    ).toThrow('Loom aggregations require at least one non-empty field');

    expect(() =>
      buildLoomAggregationsQuery({
        selector,
        fields: [''],
      }),
    ).toThrow('Loom aggregations require at least one non-empty field');
  });

  it('never serializes the retired materializationId or dataType request fields', () => {
    const requests = [
      buildLoomDatasetQuery(selector),
      buildLoomRowsQuery({ selector, columns: ['id'] }),
      buildLoomAggregateQuery({ selector, operation: 'COUNT' }),
      buildLoomCountQuery({ selector, operation: 'COUNT' }),
      buildLoomAggregationsQuery({ selector, fields: ['status'] }),
      buildLoomDownloadRequest({ selector, fields: ['id'], format: 'csv' }),
    ];
    expect(JSON.stringify(requests)).not.toMatch(/materializationId|dataType/);
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
