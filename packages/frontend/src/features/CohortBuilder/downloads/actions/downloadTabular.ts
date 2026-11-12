import { downloadLoomFile } from '@gen3/core';
import { handleDownload } from './utils';
import { downloadParameters } from './downloadParameters';
import type { ActionButtonWithArgsFunction } from '../../types';

export const downloadTabularAction: ActionButtonWithArgsFunction = async (
  params,
  done,
  onError,
  onAbort,
  signal,
): Promise<void> => {
  try {
    const {
      fileFields,
      fields,
      type,
      filter,
      sort,
      filename,
      selector,
      projectIds,
      exportHeaders,
    } = downloadParameters.parse(params);
    const blob = await downloadLoomFile(
      {
        selector,
        projectIds,
        fields: fileFields ?? fields,
        sort,
        filter,
        format: 'csv',
        exportHeaders,
      },
      signal,
    );
    signal?.throwIfAborted();
    handleDownload(blob, filename ?? `${type}_export.csv`);
    done?.();
  } catch (error: unknown) {
    if (
      signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      onAbort?.();
      return;
    }
    onError?.(error instanceof Error ? error : new Error(String(error)));
  }
};
