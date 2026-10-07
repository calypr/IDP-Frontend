import { downloadFromGuppyToBlob } from '../utils';
import { Accessibility } from '../../../constants';
import { DownloadFromGuppyParams, GuppyDownloadDataParams } from '../types';

describe('Test for downloadFromGuppy function', () => {
  const onDoneMock = jest.fn();
  const onStartMock = jest.fn();
  const onErrorMock = jest.fn();
  const mockParameters: GuppyDownloadDataParams = {
    type: 'file',
    filter: { mode: 'and', root: {} },
    accessibility: Accessibility.ALL,
    fields: ['file.mdSum'],
    sort: ['asc:file'],
    format: 'json',
  };

  const downloadOptions: DownloadFromGuppyParams = {
    parameters: mockParameters,
    onStart: onStartMock,
    onDone: onDoneMock,
    onError: onErrorMock,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
  });

  it('should call the function correctly', async () => {
    await downloadFromGuppyToBlob(downloadOptions);
    expect(onStartMock).toHaveBeenCalledTimes(1);
  });

  it('test for onDone function', async () => {
    await downloadFromGuppyToBlob(downloadOptions);
    expect(onDoneMock).toHaveBeenCalledTimes(1);
  });

  it('test for onError function', async () => {
    await downloadFromGuppyToBlob(downloadOptions);
    expect(onErrorMock).toHaveBeenCalledTimes(0);
  });
});
