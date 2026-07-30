import {
  downloadJSONDataFromLoom,
  isLoomDataType,
  LoomDownloadParams,
} from '@gen3/core';
import { handleDownload } from './utils';
import { jsonToCsv } from '../utils/jsonToCsv';
import { ActionButtonWithArgsFunction } from '../../types';

export interface DownloadTabularParams {
  resourceIndexType: string;
  fileFields: string[];
  type: string;
  filter?: any;
  filename?: string;
  accessibility?: any;
  sort?: any;
}

export const downloadTabularAction: ActionButtonWithArgsFunction = async (
  params: Record<string, any>, // Change from DownloadTabularParams to Record<string, any>
  done?: () => void,
  onError?: (error: Error) => void,
  onAbort?: () => void,
  signal?: AbortSignal,
): Promise<void> => {
  // Cast the generic record to your specific interface for internal use
  const {
    resourceIndexType,
    fileFields,
    type,
    filter,
    sort,
    filename,
  } = params as DownloadTabularParams;
  const downloadFilename = filename ?? `${type}_export.csv`;
  const dataType = resourceIndexType || type;
  if (!isLoomDataType(dataType)) {
    onError?.(new Error(`Unsupported Loom data type: ${dataType}`));
    return;
  }

  const cohortFilterParams: LoomDownloadParams = {
    filter,
    type: dataType,
    fields: fileFields,
    sort,
    format: 'json',
  };

  try {
    const data = await downloadJSONDataFromLoom({
      parameters: cohortFilterParams,
      onAbort,
      signal,
    });

    if (!data?.length) {
      throw new Error('no data found for the current filters');
    }

    const csv = jsonToCsv(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    handleDownload(blob, downloadFilename);

    if (done) done();
  } catch (err) {
    const resultErr =
      err instanceof Error
        ? err
        : typeof err === 'string'
          ? new Error(err)
          : new Error('unknown error in download tabular data');

    if (onError) onError(resultErr);
  }
};
