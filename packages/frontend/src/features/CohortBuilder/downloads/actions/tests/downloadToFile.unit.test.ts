import { downloadToFileAction } from '../downloadToFile';
import { downloadLoomFile } from '@gen3/core';
import { handleDownload } from '../utils';

jest.mock('@gen3/core', () => ({
  downloadLoomFile: jest.fn(),
  isFilterSet: jest.fn(),
}));
jest.mock('../utils', () => ({ handleDownload: jest.fn() }));
beforeEach(() => jest.clearAllMocks());

it('passes project scope, format, and normalized sorting to the supported download API', async () => {
  const data = new Blob(['[]']);
  jest.mocked(downloadLoomFile).mockResolvedValue(data);
  const done = jest.fn();
  await downloadToFileAction(
    {
      selector: {
        recipe: 'meta',
        translationVersion: 'r1',
        output: 'Specimen',
      },
      projectIds: ['HTAN_INT/BForePC'],
      fields: ['identifier'],
      format: 'json',
      sort: [{ identifier: 'desc' }],
      filename: 'specimens.json',
    },
    done,
  );
  expect(downloadLoomFile).toHaveBeenCalledWith(
    expect.objectContaining({
      projectIds: ['HTAN_INT/BForePC'],
      format: 'json',
      sort: { column: 'identifier', desc: true },
    }),
    undefined,
  );
  expect(handleDownload).toHaveBeenCalledWith(data, 'specimens.json');
  expect(done).toHaveBeenCalledTimes(1);
});

it('rejects an unsupported format before issuing a request', async () => {
  const onError = jest.fn();
  await downloadToFileAction({ format: 'xlsx' }, undefined, onError);
  expect(onError).toHaveBeenCalledTimes(1);
  expect(downloadLoomFile).not.toHaveBeenCalled();
});
