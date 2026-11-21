import { act, renderHook } from '@testing-library/react';
import { createLoomClient } from '@calypr/loom-ui';
import { useAuthenticatedLoomClient } from './authenticatedLoomClient';

let mockCsrfToken: string | undefined;
const mockFetchLoomResponse = jest.fn(
  async (_endpoint: string, init?: RequestInit) => {
    mockRequestHeaders.push(new Headers(init?.headers));
    return { status: 200 } as Response;
  },
);
const mockRequestHeaders: Headers[] = [];

jest.mock('@gen3/core', () => ({
  GEN3_LOOM_API: '/api/loom',
  fetchLoomResponse: (...args: Parameters<typeof mockFetchLoomResponse>) =>
    mockFetchLoomResponse(...args),
  handleUnauthorizedStatus: jest.fn(),
  selectCSRFToken: jest.fn(),
  useCoreSelector: () => mockCsrfToken,
}));

jest.mock('@calypr/loom-ui', () => ({
  createLoomClient: jest.fn((options: { fetch: typeof globalThis.fetch }) => ({
    fetch: options.fetch,
  })),
}));

describe('authenticated Loom client', () => {
  beforeEach(() => {
    mockCsrfToken = 'csrf-first';
    mockRequestHeaders.length = 0;
    (createLoomClient as jest.Mock).mockClear();
    mockFetchLoomResponse.mockClear();
  });

  it('keeps the client instance across CSRF rotation and sends only the current token', async () => {
    const { result, rerender } = renderHook(() => useAuthenticatedLoomClient());
    const initialClient = result.current;
    const createOptions = (createLoomClient as jest.Mock).mock.calls[0]?.[0] as
      | { readonly fetch: typeof globalThis.fetch }
      | undefined;
    expect(createOptions).toBeDefined();

    await act(async () => {
      await createOptions?.fetch('/request', {
        headers: { 'X-CSRF-Token': 'stale-token' },
      });
    });
    expect(mockRequestHeaders[0]?.get('X-CSRF-Token')).toBe('csrf-first');

    mockCsrfToken = 'csrf-rotated';
    rerender();
    expect(result.current).toBe(initialClient);
    expect(createLoomClient).toHaveBeenCalledTimes(1);

    await act(async () => {
      await createOptions?.fetch('/request', {
        headers: { 'X-CSRF-Token': 'stale-token' },
      });
    });
    expect(mockRequestHeaders[1]?.get('X-CSRF-Token')).toBe('csrf-rotated');
  });
});
