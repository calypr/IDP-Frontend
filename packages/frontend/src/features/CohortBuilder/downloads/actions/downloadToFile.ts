import { downloadLoomFile } from '@gen3/core';
import { fileDownloadParameters } from './downloadParameters';
import { handleDownload } from './utils';
import type { ActionButtonWithArgsFunction } from '../../types';

export const downloadToFileAction: ActionButtonWithArgsFunction = async (
  params,
  done,
  onError,
  onAbort,
  signal,
) => {
  try {
    const parameters = fileDownloadParameters.parse(params);
    const data = await downloadLoomFile(parameters, signal);
    signal?.throwIfAborted();
    handleDownload(data, parameters.filename ?? `export.${parameters.format}`);
    done?.();
  } catch (error: unknown) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    )
      onAbort?.();
    else onError?.(error instanceof Error ? error : new Error(String(error)));
  }
};
