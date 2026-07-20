import { downloadFromLoomToBlob, LoomDownloadParams } from '@gen3/core';
import { handleDownload } from './utils';

export const downloadToFileAction = async (
  params: Record<string, any>,
  done?: () => void,
  onError?: (error: Error) => void,
  onAbort?: () => void,
  signal?: AbortSignal,
): Promise<void> => {
  // Call the principal-scoped Loom export endpoint.
  await downloadFromLoomToBlob({
    parameters: params as LoomDownloadParams,
    onDone: (data: Blob) => {
      handleDownload(data, params.filename);
      if (done) done();
    },
    onError: (error: Error) => {
      if (onError) onError(error);
    },
    onAbort: () => {
      if (onAbort) onAbort();
    },
    signal,
  });
};
