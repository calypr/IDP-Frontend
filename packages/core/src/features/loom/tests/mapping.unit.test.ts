import {
  EXPLORER_TO_LOOM_DATA_TYPE,
  isExplorerDataType,
  toLoomDataType,
} from '../mapping';
import { convertFilterSetToLoomFilters } from '../filters';

describe('Explorer to Loom mapping', () => {
  it.each([
    ['file', 'DocumentReference'],
    ['document_reference', 'DocumentReference'],
    ['research_subject', 'ResearchSubject'],
    ['specimen', 'Specimen'],
    ['medication_administration', 'MedicationAdministration'],
    ['group_member', 'GroupMember'],
  ])('maps %s to %s', (explorerType, loomType) => {
    expect(toLoomDataType(explorerType)).toBe(loomType);
  });

  it('exposes a complete canonical mapping', () => {
    expect(Object.keys(EXPLORER_TO_LOOM_DATA_TYPE)).toHaveLength(6);
    expect(isExplorerDataType('unknown')).toBe(false);
    expect(() => toLoomDataType('unknown')).toThrow(
      'Unsupported Explorer data type: unknown',
    );
  });

  it('translates supported filter operations without using Guppy JSON', () => {
    expect(
      convertFilterSetToLoomFilters({
        mode: 'and',
        root: {
          status: { operator: '=', field: 'status', operand: 'active' },
          category: {
            operator: 'in',
            field: 'category',
            operands: ['a', 'b'],
          },
        },
      }),
    ).toEqual([
      { column: 'status', op: 'EQ', value: 'active' },
      { column: 'category', op: 'IN', value: ['a', 'b'] },
    ]);
  });

  it('flattens Explorer nested field paths and rejects unsupported unions', () => {
    expect(() =>
      convertFilterSetToLoomFilters({ mode: 'or', root: {} }),
    ).toThrow('Unsupported Loom filter union');
    expect(
      convertFilterSetToLoomFilters({
        mode: 'and',
        root: {
          'subject.id': {
            operator: 'nested',
            path: 'subject',
            operand: { operator: '=', field: 'id', operand: '1' },
          },
        },
      }),
    ).toEqual([{ column: 'subject.id', op: 'EQ', value: '1' }]);
  });
});
