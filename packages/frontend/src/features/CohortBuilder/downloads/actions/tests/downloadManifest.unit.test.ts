import { downloadToManifestAction } from '../downloadManifest';
import { downloadLoomRows } from '@gen3/core';
import { handleDownload } from '../utils';

// add mock implementation for handleDownload
jest.mock('../utils', () => ({
  handleDownload: jest.fn(),
}));

jest.mock('@gen3/core', () => ({
  downloadLoomRows: jest.fn(),
  isFilterSet: (value: unknown) =>
    typeof value === 'object' &&
    value !== null &&
    'mode' in value &&
    'root' in value,
}));

describe('downloadToManifestAction function', () => {
  it('should handle download to manifest action when type equals resourceIndexType', async () => {
    const params = {
      type: 'mockResourceIndexType',
      resourceIndexType: 'mockResourceIndexType',
      filter: { mode: 'and', root: {} },
      fields: ['md5sum', 'file_name', 'file_size'],
      accessibility: 'public',
      sort: [],
      filename: 'test_manifest.json',
      referenceIdFieldInDataIndex: 'object_id',
      fileFields: [],
      resourceIdField: 'object_id',
      selector: {
        recipe: 'project_recipe',
        translationVersion: 'r000001_abcd',
        output: 'DocumentReference',
      },
    };

    const done = jest.fn();
    const onError = jest.fn();
    const onAbort = jest.fn();
    const signal = new AbortController().signal;

    (downloadLoomRows as jest.Mock).mockReturnValue([
      {
        object_id: 'mocked-object-id-1',
        md5sum: 'mocked-md5sum-1',
        file_name: 'mocked.20130502.genotypes.vcf.gz.tbi',
        file_size: 8077,
      },
      {
        object_id: 'mocked-object-id-2',
        md5sum: 'mocked-md5sum-2',
        file_name: 'mocked.20130502.genotypes.vcf.gz',
        file_size: 5656911,
      },
      {
        object_id: 'mocked-object-id-3',
        md5sum: 'mocked-md5sum-3',
        file_name: 'mocked_populations.tsv',
        file_size: 30970,
      },
      {
        object_id: 'mocked-object-id-4',
        md5sum: 'mocked-md5sum-4',
        file_name: 'integrated_call_samples_v3.20200731.ALL.ped',
        file_size: 209431,
      },
    ]);

    await downloadToManifestAction(params, done, onError, onAbort, signal);

    expect(handleDownload).toHaveBeenCalled();
    expect(done).toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(downloadLoomRows).toHaveBeenCalledWith(
      expect.objectContaining({
        selector: params.selector,
        fields: ['object_id'],
        filter: params.filter,
      }),
      signal,
    );

    // Add more expect statements or tests to check if function behavior is correct
  });

  it('should handle error when no data found for the current filters', async () => {
    const params = {
      type: 'mockResourceIndexType',
      resourceIndexType: 'mockResourceIndexType',
      filter: { mode: 'and', root: {} },
      fields: [],
      accessibility: 'public',
      sort: [],
      filename: 'test_manifest.json',
      referenceIdFieldInDataIndex: '',
      fileFields: [],
      resourceIdField: '',
      selector: {
        recipe: 'project_recipe',
        translationVersion: 'r000001_abcd',
        output: 'DocumentReference',
      },
    };

    const done = jest.fn();
    const onError = jest.fn();
    const onAbort = jest.fn();
    const signal = new AbortController().signal;

    (downloadLoomRows as jest.Mock).mockResolvedValue([]);

    await downloadToManifestAction(params, done, onError, onAbort, signal);

    expect(onError).toHaveBeenCalledWith(
      new Error('No data found for the current filters'),
    );
    expect(done).not.toHaveBeenCalled();
  });

  // Add more tests for different use cases or edge cases
});

it('uses the real resource reference column for a scoped cross-dataset manifest', async () => {
  jest.mocked(downloadLoomRows).mockReset();
  jest
    .mocked(downloadLoomRows)
    .mockResolvedValueOnce([{ patient_id: 'P1' }])
    .mockResolvedValueOnce([{ object_id: 'F1', file_name: 'file.txt' }]);
  const onError = jest.fn();
  const selector = {
    recipe: 'metadata',
    translationVersion: 'r1',
    output: 'ResearchSubject',
  };
  const resourceSelector = { ...selector, output: 'DocumentReference' };
  await downloadToManifestAction(
    {
      type: 'ResearchSubject',
      resourceIndexType: 'DocumentReference',
      resourceIdField: 'object_id',
      referenceIdFieldInDataIndex: 'patient_id',
      referenceIdFieldInResourceIndex: 'subject_id',
      fileFields: ['file_name'],
      selector,
      resourceSelector,
      projectIds: ['HTAN_INT/BForePC'],
    },
    undefined,
    onError,
  );
  expect(onError).not.toHaveBeenCalled();
  expect(downloadLoomRows).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({
      projectIds: ['HTAN_INT/BForePC'],
      selector: resourceSelector,
      filter: {
        mode: 'and',
        root: {
          subject_id: { operator: 'in', field: 'subject_id', operands: ['P1'] },
        },
      },
    }),
    undefined,
  );
});
