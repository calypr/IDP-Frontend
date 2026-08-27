import type { ExplorerAuthoringApiError } from '@gen3/core';
import { lowerPreviewLimit, previewRecoveryAction } from './previewRecovery';

const failure = (
  code: string,
  retryable = false,
): ExplorerAuthoringApiError => ({
  status: 409,
  code,
  message: code,
  retryable,
});

describe('Builder preview recovery', () => {
  it('recompiles a stale deterministic receipt exactly once', () => {
    const error = failure('RECEIPT_RECOMPILE_REQUIRED');
    expect(
      previewRecoveryAction(error, {
        receiptRefreshes: 0,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('recompile');
    expect(
      previewRecoveryAction(error, {
        receiptRefreshes: 1,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('fail');
  });

  it('refreshes a changed catalog exactly once', () => {
    const error = failure('RECEIPT_STALE');
    expect(
      previewRecoveryAction(error, {
        receiptRefreshes: 0,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('refresh-catalog');
    expect(
      previewRecoveryAction(error, {
        receiptRefreshes: 1,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('fail');
  });

  it('reduces oversized previews down to the minimum without looping', () => {
    const error = failure('PREVIEW_RESPONSE_TOO_LARGE');
    expect(
      previewRecoveryAction(error, {
        receiptRefreshes: 0,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('reduce-limit');
    expect(lowerPreviewLimit(25)).toBe(10);
    expect(
      previewRecoveryAction(error, {
        receiptRefreshes: 0,
        transientRetries: 0,
        limit: 10,
      }),
    ).toBe('fail');
  });

  it('retries transient failures once and leaves semantic failures alone', () => {
    const transient = failure('BACKEND_UNAVAILABLE', true);
    expect(
      previewRecoveryAction(transient, {
        receiptRefreshes: 0,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('retry');
    expect(
      previewRecoveryAction(transient, {
        receiptRefreshes: 0,
        transientRetries: 1,
        limit: 25,
      }),
    ).toBe('fail');
    expect(
      previewRecoveryAction(failure('PLAN_TOO_EXPENSIVE'), {
        receiptRefreshes: 0,
        transientRetries: 0,
        limit: 25,
      }),
    ).toBe('fail');
  });
});
