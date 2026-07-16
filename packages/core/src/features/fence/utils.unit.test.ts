import { fetchFence } from './utils';

describe('fetchFence request guardrails', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('aborts and classifies a request that exceeds its deadline', async () => {
    jest.useFakeTimers();
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const request = fetchFence({ endpoint: '/user', timeoutMs: 25 });
    await jest.advanceTimersByTimeAsync(25);

    await expect(request).rejects.toMatchObject({
      kind: 'timeout',
      status: 408,
      statusText: 'Fence request timed out',
    });
  });

  it('returns structured HTTP failures', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response('Please login', {
        status: 401,
        statusText: 'Unauthorized',
      }),
    );

    await expect(fetchFence({ endpoint: '/user' })).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      statusText: 'Unauthorized',
      text: 'Please login',
    });
  });

  it('forwards caller cancellation without reporting a timeout', async () => {
    const caller = new AbortController();
    jest.spyOn(global, 'fetch').mockImplementation((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const request = fetchFence({ endpoint: '/user', signal: caller.signal });
    caller.abort();

    await expect(request).rejects.toMatchObject({
      kind: 'aborted',
      status: 0,
    });
  });
});
