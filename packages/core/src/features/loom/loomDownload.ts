import { getCookie } from 'cookies-next';
import { GEN3_LOOM_API } from '../../constants';
import { coreStore } from '../../store';
import { selectCSRFToken } from '../user';
import { isJSONObject, JSONObject } from '../../types';
import { convertFilterSetToLoomFilters } from './filters';
import { toLoomDataType } from './mapping';
import type { FilterSet } from '../filters';
import type { LoomSort } from './types';

export interface LoomDownloadParams {
  readonly type: string;
  readonly fields: ReadonlyArray<string>;
  readonly filter?: FilterSet;
  readonly sort?: unknown;
  readonly format: 'json' | 'csv' | 'tsv' | 'jsonl';
  readonly filename?: string;
}

export interface DownloadFromLoomParams {
  readonly parameters: LoomDownloadParams;
  readonly onStart?: () => void;
  readonly onDone?: (blob: Blob) => void;
  readonly onError?: (error: Error) => void;
  readonly onAbort?: () => void;
  readonly signal?: AbortSignal;
}

const normalizeSort = (sort: unknown): LoomSort | undefined => {
  if (!sort) return undefined;
  if (Array.isArray(sort)) {
    const first = sort[0];
    if (typeof first === 'object' && first !== null) {
      const [column, direction] = Object.entries(first as Record<string, unknown>)[0] ?? [];
      if (column) return { column, desc: direction === 'desc' };
    }
    return undefined;
  }
  if (typeof sort === 'object') {
    const candidate = sort as Partial<LoomSort>;
    if (typeof candidate.column === 'string') return candidate as LoomSort;
  }
  return undefined;
};

const buildRequest = (parameters: LoomDownloadParams) => ({
  dataType: toLoomDataType(parameters.type),
  columns: [...parameters.fields],
  filters: convertFilterSetToLoomFilters(parameters.filter),
  sort: normalizeSort(parameters.sort),
  format: parameters.format.toUpperCase(),
  filename: parameters.filename,
});

const fetchLoomExport = async (
  parameters: LoomDownloadParams,
  signal?: AbortSignal,
): Promise<Response> => {
  const csrfToken = selectCSRFToken(coreStore.getState());
  const headers: Record<string, string> = {
    Accept: 'application/octet-stream',
    'Content-Type': 'application/json',
    ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
  };
  if (process.env.NODE_ENV === 'development') {
    const accessToken = getCookie('credentials_token');
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }
  return fetch(`${GEN3_LOOM_API}/api/v1/dataframe/export`, {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(buildRequest(parameters)),
    signal,
  });
};

export const downloadFromLoomToBlob = async ({
  parameters,
  onStart = () => null,
  onDone = (_: Blob) => null,
  onError = (_: Error) => null,
  onAbort = () => null,
  signal,
}: DownloadFromLoomParams) => {
  onStart();
  try {
    const response = await fetchLoomExport(parameters, signal);
    if (!response.ok) {
      throw new Error((await response.text()) || response.statusText);
    }
    onDone(await response.blob());
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      onAbort();
      return;
    }
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

export const downloadJSONDataFromLoom = async ({
  parameters,
  onAbort = () => null,
  signal,
}: Omit<DownloadFromLoomParams, 'onDone' | 'onError'>): Promise<JSONObject[]> => {
  try {
    const response = await fetchLoomExport(
      { ...parameters, format: 'json' },
      signal,
    );
    if (!response.ok) {
      throw new Error((await response.text()) || response.statusText);
    }
    const value = await response.json();
    return Array.isArray(value) ? value.filter(isJSONObject) : [];
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') onAbort();
    throw error instanceof Error ? error : new Error(String(error));
  }
};
