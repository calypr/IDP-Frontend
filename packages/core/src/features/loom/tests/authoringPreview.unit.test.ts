import { bindAuthoringPreview } from '../authoringPreview';

describe('Authoring V1 preview binding', () => {
  const bindings = [
    {
      outputId: 'specimen',
      semanticColumn: 'coding',
      candidateId: 'candidate-coding',
      occurrenceId: 'specimen-type',
      emissionId: 'emission-type-coding',
    },
    {
      outputId: 'specimen',
      semanticColumn: 'coding',
      candidateId: 'candidate-coding',
      occurrenceId: 'specimen-processing',
      emissionId: 'emission-processing-coding',
    },
  ];

  it('uses emission identity for repeated Specimen candidates and accepts sparse rows', () => {
    const result = bindAuthoringPreview(
      {
        outputId: 'specimen',
        columns: [
          {
            emissionId: 'emission-type-coding',
            candidateId: 'candidate-coding',
            occurrenceId: 'specimen-type',
            publicColumn: 'c_specimen_type_coding',
            logicalType: 'Coding',
          },
          {
            emissionId: 'emission-processing-coding',
            candidateId: 'candidate-coding',
            occurrenceId: 'specimen-processing',
            publicColumn: 'c_specimen_processing_coding',
            logicalType: 'Coding',
          },
        ],
        rows: [
          { c_specimen_type_coding: 'Tissue' },
          { c_specimen_processing_coding: 'Frozen' },
        ],
        rowCount: 2,
        diagnostics: [],
      },
      bindings,
      'specimen',
      () => ({
        severity: 'warning',
        code: 'TEST_DIAGNOSTIC',
        message: 'test',
      }),
    );

    expect(result).toEqual({
      data: expect.objectContaining({
        output: 'specimen',
        rows: [
          { c_specimen_type_coding: 'Tissue' },
          { c_specimen_processing_coding: 'Frozen' },
        ],
        columns: [
          expect.objectContaining({
            name: 'coding',
            emissionId: 'emission-type-coding',
            rowKey: 'c_specimen_type_coding',
          }),
          expect.objectContaining({
            name: 'coding',
            emissionId: 'emission-processing-coding',
            rowKey: 'c_specimen_processing_coding',
          }),
        ],
      }),
    });
  });

  it('rejects only genuinely unknown preview emissions', () => {
    const result = bindAuthoringPreview(
      {
        columns: [{ emissionId: 'unknown', publicColumn: 'c_unknown' }],
        rows: [],
      },
      bindings,
      'specimen',
      () => ({
        severity: 'warning',
        code: 'TEST_DIAGNOSTIC',
        message: 'test',
      }),
    );

    expect(result).toEqual({
      error: expect.objectContaining({
        code: 'PREVIEW_COLUMN_BINDING_FAILED',
        retryable: false,
        details: {
          outputId: 'specimen',
          unmatchedColumns: ['c_unknown'],
        },
      }),
    });
  });
});
