import {
  clearBrowserRuntimeErrors,
  getBrowserRuntimeErrors,
  installBrowserRuntimeErrorCapture,
} from './browserRuntime';

describe('browser runtime conformance harness', () => {
  afterEach(() => {
    clearBrowserRuntimeErrors();
  });

  it('retains uncaught errors for automated page checks', () => {
    const uninstall = installBrowserRuntimeErrorCapture();
    window.dispatchEvent(
      new ErrorEvent('error', {
        message: 'node.position is undefined',
        filename: '/ExplorerBuilder',
      }),
    );

    expect(getBrowserRuntimeErrors()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'error',
          message: 'node.position is undefined',
          source: '/ExplorerBuilder',
        }),
      ]),
    );
    uninstall();
  });

  it('keeps the browser page from accumulating unbounded failures', () => {
    const uninstall = installBrowserRuntimeErrorCapture();
    for (let index = 0; index < 75; index += 1) {
      window.dispatchEvent(
        new ErrorEvent('error', { message: `error-${index}` }),
      );
    }
    expect(getBrowserRuntimeErrors()).toHaveLength(50);
    expect(getBrowserRuntimeErrors()[0]?.message).toBe('error-25');
    uninstall();
  });
});
