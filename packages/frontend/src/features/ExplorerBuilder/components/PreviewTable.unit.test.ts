import { formatPreviewCell, previewCellTitle } from './PreviewTable';

describe('formatPreviewCell', () => {
  it('preserves scalar values', () => {
    expect(formatPreviewCell('Tissue')).toBe('Tissue');
    expect(formatPreviewCell(25)).toBe('25');
    expect(formatPreviewCell(false)).toBe('false');
    expect(formatPreviewCell(null)).toBe('—');
  });

  it('renders common structured FHIR values as compact human text', () => {
    expect(formatPreviewCell({ reference: 'Patient/example' })).toBe(
      'Patient/example',
    );
    expect(formatPreviewCell([{ use: 'official', value: 'ABC' }])).toBe('ABC');
    expect(
      formatPreviewCell({
        coding: [{ code: 'fix', display: 'Fixation', system: 'example' }],
        text: 'Fixation',
      }),
    ).toBe('Fixation');
    expect(
      formatPreviewCell({
        bodySite: { reference: { reference: 'BodyStructure/example' } },
        collector: { reference: 'Practitioner/example' },
      }),
    ).toBe('bodySite: BodyStructure/example · collector: Practitioner/example');
  });

  it('keeps the lossless JSON value available for the cell tooltip', () => {
    expect(previewCellTitle({ reference: 'Patient/example' })).toBe(
      '{"reference":"Patient/example"}',
    );
  });
});
