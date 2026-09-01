import {
  currentQueryNavigation,
  initialQueryNavigation,
  moveQueryNavigation,
} from './queryNavigation';

describe('Explorer table query navigation', () => {
  it('resets pagination synchronously when the query identity changes', () => {
    const previous = {
      querySignature: 'old',
      pageIndex: 2,
      cursors: { 0: null, 1: 'cursor-1', 2: 'cursor-2' },
    };

    expect(currentQueryNavigation(previous, 'new')).toEqual(
      initialQueryNavigation('new'),
    );
  });

  it('records the returned cursor as part of moving to the next page', () => {
    expect(
      moveQueryNavigation({
        navigation: initialQueryNavigation('query'),
        querySignature: 'query',
        pageIndex: 1,
        nextCursor: 'cursor-1',
      }),
    ).toEqual({
      querySignature: 'query',
      pageIndex: 1,
      cursors: { 0: null, 1: 'cursor-1' },
    });
  });

  it('rejects forward navigation until the current response supplies a cursor', () => {
    const current = initialQueryNavigation('query');

    expect(
      moveQueryNavigation({
        navigation: current,
        querySignature: 'query',
        pageIndex: 1,
      }),
    ).toBe(current);
  });
});
