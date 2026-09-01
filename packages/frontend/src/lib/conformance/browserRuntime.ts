export interface BrowserRuntimeErrorRecord {
  readonly kind: 'error' | 'unhandledrejection';
  readonly message: string;
  readonly stack?: string;
  readonly source?: string;
  readonly timestamp: string;
}

type BrowserWindow = Window & {
  /** Development conformance harness can inspect uncaught browser failures. */
  __GEN3_BROWSER_RUNTIME_ERRORS__?: BrowserRuntimeErrorRecord[];
};

const browserWindow = (): BrowserWindow | undefined =>
  typeof window === 'undefined' ? undefined : (window as BrowserWindow);

const messageFor = (value: unknown): { message: string; stack?: string } => {
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  if (typeof value === 'string') return { message: value };
  try {
    return { message: JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
};

export const recordBrowserRuntimeError = (
  entry: BrowserRuntimeErrorRecord,
): void => {
  const target = browserWindow();
  if (!target) return;
  const existing = target.__GEN3_BROWSER_RUNTIME_ERRORS__ ?? [];
  target.__GEN3_BROWSER_RUNTIME_ERRORS__ = [...existing, entry].slice(-50);
};

/**
 * Install a small browser-side conformance harness. It does not suppress the
 * browser/Next error; it retains a bounded, inspectable record so automated
 * checks can fail on page exceptions instead of relying on a screenshot.
 */
export const installBrowserRuntimeErrorCapture = (): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const onError = (event: ErrorEvent) => {
    const details = messageFor(event.error ?? event.message);
    recordBrowserRuntimeError({
      kind: 'error',
      ...details,
      source: event.filename || undefined,
      timestamp: new Date().toISOString(),
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const details = messageFor(event.reason);
    recordBrowserRuntimeError({
      kind: 'unhandledrejection',
      ...details,
      timestamp: new Date().toISOString(),
    });
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
};

export const getBrowserRuntimeErrors =
  (): ReadonlyArray<BrowserRuntimeErrorRecord> => [
    ...(browserWindow()?.__GEN3_BROWSER_RUNTIME_ERRORS__ ?? []),
  ];

export const clearBrowserRuntimeErrors = (): void => {
  const target = browserWindow();
  if (target) target.__GEN3_BROWSER_RUNTIME_ERRORS__ = [];
};
