import {
  downloadFromLoomToBlob,
  LoomDatasetSelector,
} from '@gen3/core';
import { handleDownload } from './utils';

export const downloadToFileAction = async (
  params: Record<string, any>,
  done?: () => void,
  onError?: (error: Error) => void,
  onAbort?: () => void,
  signal?: AbortSignal,
): Promise<void> => {
  const selector = params.selector as LoomDatasetSelector | undefined;
  if (!selector) {
    onError?.(
      new Error('This download has no published Loom dataset selector.'),
    );
    return;
  }
  // Call the principal-scoped Loom export endpoint.
  await downloadFromLoomToBlob({
    parameters: {
      fields: params.fields ?? [],
      filter: params.filter,
      sort: params.sort,
      format: params.format ?? 'json',
      filename: params.filename,
      selector,
    },
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
