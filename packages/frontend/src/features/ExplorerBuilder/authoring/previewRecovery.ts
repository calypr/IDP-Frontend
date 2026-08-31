import type { ExplorerAuthoringApiError } from '@gen3/core';

export type PreviewLimit = 25 | 50 | 100 | 500 | 1000;
export type PreviewRecoveryAction =
  | 'recompile'
  | 'refresh-catalog'
  | 'retry'
  | 'fail';

const receiptRefreshCodes = new Set([
  'RECEIPT_RECOMPILE_REQUIRED',
  'COMPILE_RECEIPT_NOT_FOUND',
]);

const catalogRefreshCodes = new Set([
  'STALE_CATALOG_SNAPSHOT',
  'STALE_SNAPSHOT',
  'SNAPSHOT_STALE',
  'STALE_RECEIPT',
  'RECEIPT_STALE',
]);

const responseSizeCodes = new Set([
  'PREVIEW_TOO_LARGE',
  'PREVIEW_RESPONSE_TOO_LARGE',
  'RESPONSE_TOO_LARGE',
]);

export const isPreviewResponseSizeError = (code: string | undefined): boolean =>
  responseSizeCodes.has(code ?? '');

export const previewRecoveryAction = (
  error: ExplorerAuthoringApiError,
  options: {
    readonly receiptRefreshes: number;
    readonly transientRetries: number;
    readonly limit: PreviewLimit;
  },
): PreviewRecoveryAction => {
  if (receiptRefreshCodes.has(error.code ?? '') && options.receiptRefreshes < 1)
    return 'recompile';
  if (catalogRefreshCodes.has(error.code ?? '') && options.receiptRefreshes < 1)
    return 'refresh-catalog';
  if (error.retryable && options.transientRetries < 1) return 'retry';
  return 'fail';
};
