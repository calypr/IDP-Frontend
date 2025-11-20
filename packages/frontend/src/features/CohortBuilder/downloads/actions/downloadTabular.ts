import {
  downloadJSONDataFromGuppy,
  GuppyDownloadDataParams,
} from '@gen3/core';
import { handleDownload } from './utils';
import { jsonToCsv } from '../utils/jsonToCsv';

export interface DownloadTabularParams {
  resourceIndexType: string;
  fileFields: string[];
  type: string;
  filter?: any;
  filename?: string;
  accessibility?: any;
  sort?: any;
}

export const downloadTabularAction = async (
  params: DownloadTabularParams,
  done?: () => void,
  onError?: (error: Error) => void,
  onAbort?: () => void,
  signal?: AbortSignal,
): Promise<void> => {
  const { resourceIndexType, fileFields, type, filter, accessibility, sort, filename } = params;
  const downloadFilename = filename ?? `${type}_export.csv`;

  const cohortFilterParams: GuppyDownloadDataParams = {
    filter,
    type: resourceIndexType || type,
    fields: fileFields,
    accessibility,
    sort,
    format: 'json',
  };

  try {
    const data = await downloadJSONDataFromGuppy({
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
    const resultErr = err instanceof Error 
      ? err 
      : typeof err === 'string' 
        ? new Error(err)
        : new Error('unknown error in download tabular data');
    
    if (onError) onError(resultErr);
  }
};