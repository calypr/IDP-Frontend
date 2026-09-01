import { shapeLoomRows, aggregateToHistogram } from '../processing';

describe('Loom response adapters', () => {
  it('shapes flat dotted columns while preserving null and repeated values', () => {
    expect(
      shapeLoomRows(
        [['r1', null, ['a', 'b']]],
        ['subject.id', 'subject.birthDate', 'tags'],
      ),
    ).toEqual([
      {
        subject: { id: 'r1', birthDate: null },
        tags: ['a', 'b'],
      },
    ]);
  });

  it('adapts empty pages and grouped counts without inventing rows', () => {
    expect(shapeLoomRows([], ['id'])).toEqual([]);
    expect(
      aggregateToHistogram(
        {
          materialization: {} as any,
          columns: ['status', 'count'],
          rows: [{ status: 'active', count: 3 }],
        },
        'status',
      ),
    ).toEqual({ status: [{ key: 'active', count: 3 }] });
  });
});
