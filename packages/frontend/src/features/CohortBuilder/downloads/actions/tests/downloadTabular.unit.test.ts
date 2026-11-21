import { downloadTabularAction } from '../downloadTabular';
import { downloadLoomFile } from '@gen3/core';
import { handleDownload } from '../utils';

jest.mock('@gen3/core', () => ({
  downloadLoomFile: jest.fn(),
  isFilterSet: jest.fn(),
}));
jest.mock('../utils', () => ({ handleDownload: jest.fn() }));
const exportCsv = jest.mocked(downloadLoomFile);
const params = {
  type: 'ResearchSubject',
  fileFields: ['identifier'],
  filename: 'patients.csv',
  selector: {
    recipe: 'meta',
    translationVersion: 'r1',
    output: 'ResearchSubject',
  },
  projectIds: ['HTAN_INT/BForePC'],
  exportHeaders: { identifier: 'Participant' },
};
beforeEach(() => jest.resetAllMocks());

it('downloads the complete CSV with the configured filename and calls done', async () => {
  const blob = new Blob(['Participant\r\nP1\r\n']);
  exportCsv.mockResolvedValue(blob);
  const done = jest.fn();
  const error = jest.fn();
  await downloadTabularAction(params, done, error);
  expect(exportCsv).toHaveBeenCalledWith(
    expect.objectContaining({
      selector: params.selector,
      fields: params.fileFields,
      projectIds: params.projectIds,
      exportHeaders: params.exportHeaders,
    }),
    undefined,
  );
  expect(handleDownload).toHaveBeenCalledWith(blob, 'patients.csv');
  expect(done).toHaveBeenCalledTimes(1);
  expect(error).not.toHaveBeenCalled();
});

it('reports an export failure without creating a download', async () => {
  exportCsv.mockRejectedValue(new Error('Dataset changed'));
  const error = jest.fn();
  await downloadTabularAction(params, undefined, error);
  expect(error).toHaveBeenCalledWith(
    expect.objectContaining({ message: 'Dataset changed' }),
  );
  expect(handleDownload).not.toHaveBeenCalled();
});

it('reports cancellation separately from errors and never downloads a partial result', async () => {
  const controller = new AbortController();
  controller.abort();
  exportCsv.mockRejectedValue(new DOMException('Cancelled', 'AbortError'));
  const abort = jest.fn();
  const error = jest.fn();
  await downloadTabularAction(
    params,
    undefined,
    error,
    abort,
    controller.signal,
  );
  expect(abort).toHaveBeenCalledTimes(1);
  expect(error).not.toHaveBeenCalled();
  expect(handleDownload).not.toHaveBeenCalled();
});
