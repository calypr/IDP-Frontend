import { fetchGraphQL, fetchLoomGraphQL, loomBaseQuery } from '../loomApi';
import { isLoomGraphQLRequestError, LoomGraphQLRequestError } from '../types';

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  });

describe('Loom GraphQL transport', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof global.fetch;
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('fetches generic GraphQL from the configured endpoint and forwards the signal', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue(
      jsonResponse({ data: { viewer: { id: 'user-1' } } }),
    );

    await expect(
      fetchGraphQL<{ viewer: { id: string } }>(
        { query: 'query Viewer { viewer { id } }' },
        {
          endpoint: 'https://loom.example/graphql',
          signal: controller.signal,
        },
      ),
    ).resolves.toEqual({ viewer: { id: 'user-1' } });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://loom.example/graphql',
      expect.objectContaining({
        method: 'POST',
        signal: controller.signal,
        credentials: 'include',
      }),
    );
  });

  it('keeps fetchLoomGraphQL as a compatible wrapper', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { ok: true } }));

    await expect(
      fetchLoomGraphQL<{ ok: boolean }>(
        { query: 'query Health { ok }' },
        { endpoint: 'https://loom.example/graphql/flat' },
      ),
    ).resolves.toEqual({ ok: true });
  });

  it('exposes HTTP GraphQL errors with response and extension metadata', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          errors: [
            {
              message: 'the dataframe backend is temporarily unavailable',
              path: ['a6'],
              extensions: {
                code: 'BACKEND_UNAVAILABLE',
                requestId: 'graphql-request-1',
                retryable: true,
                fieldPath: 'Patient.project_id',
              },
            },
          ],
        },
        {
          status: 503,
          headers: { 'x-request-id': 'response-request-1' },
        },
      ),
    );

    const result = fetchGraphQL({ query: 'query Broken { a6 }' });
    await expect(result).rejects.toBeInstanceOf(LoomGraphQLRequestError);
    await expect(result).rejects.toMatchObject({
      status: 503,
      httpStatus: 503,
      code: 'BACKEND_UNAVAILABLE',
      requestId: 'graphql-request-1',
      retryable: true,
      fieldPath: 'Patient.project_id',
    });

    try {
      await result;
    } catch (error: unknown) {
      expect(isLoomGraphQLRequestError(error)).toBe(true);
      expect((error as LoomGraphQLRequestError).data).toEqual(
        expect.objectContaining({ errors: expect.any(Array) }),
      );
      expect((error as LoomGraphQLRequestError).meta).toEqual({
        endpoint: 'https://gen3.localhost.io/loom/graphql/flat',
        status: 503,
        requestId: 'graphql-request-1',
      });
    }
  });

  it('treats HTTP-200 GraphQL errors as custom errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          data: null,
          errors: [
            {
              message: 'the dataframe backend is temporarily unavailable',
              path: ['a6'],
              extensions: {
                code: 'BACKEND_UNAVAILABLE',
                retryable: true,
              },
            },
          ],
        },
        { headers: { 'x-request-id': 'header-request-1' } },
      ),
    );

    await expect(
      fetchGraphQL({ query: 'query Broken { a6 }' }),
    ).rejects.toMatchObject({
      status: 'CUSTOM_ERROR',
      httpStatus: 200,
      code: 'BACKEND_UNAVAILABLE',
      requestId: 'header-request-1',
      retryable: true,
      fieldPath: 'a6',
    });
  });

  it('reports non-JSON responses with HTTP metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response('upstream gateway failure', {
        status: 502,
        headers: { 'x-request-id': 'non-json-request-1' },
      }),
    );

    await expect(
      fetchGraphQL({ query: 'query Broken { a0 }' }),
    ).rejects.toMatchObject({
      status: 502,
      httpStatus: 502,
      requestId: 'non-json-request-1',
      retryable: true,
      data: 'upstream gateway failure',
    });
  });

  it('reports a successful response that is missing data', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {},
        { headers: { 'x-request-id': 'missing-data-request-1' } },
      ),
    );

    await expect(
      fetchGraphQL({ query: 'query Missing { a0 }' }),
    ).rejects.toMatchObject({
      status: 'CUSTOM_ERROR',
      httpStatus: 200,
      requestId: 'missing-data-request-1',
      retryable: false,
      message: 'Loom GraphQL response did not contain data',
    });
  });

  it('preserves AbortSignal cancellation instead of converting it to a GraphQL error', async () => {
    const controller = new AbortController();
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    await expect(
      fetchGraphQL(
        { query: 'query Cancelled { a0 }' },
        { signal: controller.signal },
      ),
    ).rejects.toBe(abortError);
  });

  it('reports transport failures without logging request authentication', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      fetchGraphQL(
        { query: 'query Broken { a0 }' },
        {
          endpoint: 'http://revproxy-service/loom/graphql/flat',
          headers: {
            Authorization: 'Bearer secret-token',
            Cookie: 'access_token=secret-token',
          },
        },
      ),
    ).rejects.toMatchObject({
      status: 'FETCH_ERROR',
      retryable: true,
    });
    expect(console.error).toHaveBeenCalledWith('[Loom] Transport failed', {
      endpoint: 'http://revproxy-service/loom/graphql/flat',
      error: 'fetch failed',
    });
    expect(
      JSON.stringify((console.error as jest.Mock).mock.calls),
    ).not.toContain('secret-token');
  });

  it('returns request metadata from the RTK base query on success and failure', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { data: { ok: true } },
        { headers: { 'x-request-id': 'success-1' } },
      ),
    );

    const baseQueryApi = {
      signal: new AbortController().signal,
      getState: () => ({}),
    } as never;

    await expect(
      loomBaseQuery({ query: 'query Health { ok }' }, baseQueryApi, {}),
    ).resolves.toMatchObject({
      data: { ok: true },
      meta: {
        status: 200,
        requestId: 'success-1',
      },
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { errors: [{ message: 'unavailable' }] },
        { status: 503, headers: { 'x-request-id': 'failure-1' } },
      ),
    );

    await expect(
      loomBaseQuery({ query: 'query Broken { ok }' }, baseQueryApi, {}),
    ).resolves.toMatchObject({
      error: {
        status: 503,
        httpStatus: 503,
        requestId: 'failure-1',
      },
      meta: {
        status: 503,
        requestId: 'failure-1',
      },
    });
  });
});
