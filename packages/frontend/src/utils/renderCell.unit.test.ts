import { renderCell } from './renderCell';

describe('renderCell', () => {
  it('renders scalar values and empty values', () => {
    expect(renderCell(null)).toBe('');
    expect(renderCell(undefined)).toBe('');
    expect(renderCell(false)).toBe('false');
    expect(renderCell(42)).toBe('42');
    expect(renderCell('value')).toBe('value');
  });

  it('prefers FHIR text and coding labels', () => {
    expect(renderCell({ text: 'Free-form diagnosis' })).toBe(
      'Free-form diagnosis',
    );
    expect(
      renderCell({
        coding: [
          { system: 'http://snomed.info/sct', code: '123' },
          { display: 'Example diagnosis' },
        ],
      }),
    ).toBe('123, Example diagnosis');
  });

  it('renders nested arrays and falls back to JSON for other objects', () => {
    expect(renderCell([{ coding: [{ display: 'One' }] }, 'Two'])).toBe(
      'One, Two',
    );
    expect(renderCell({ system: 'example', code: '123' })).toBe(
      '{"system":"example","code":"123"}',
    );
  });
});
