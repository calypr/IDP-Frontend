jest.mock('@gen3/core', () => ({
  fetchGraphQL: jest.fn(),
  GEN3_LOOM_API: '/loom',
}));
jest.mock('../content', () => {
  const database = {
    get: jest.fn(),
    getAll: jest.fn(),
  };
  return {
    __esModule: true,
    default: { getContentDatabase: () => database },
    filesystemDb: database,
    microserviceDb: database,
  };
});

import { fetchGraphQL } from '@gen3/core';
import type { GetServerSidePropsContext } from 'next';
import {
  createServerPageContext,
  getServerRequestHeaders,
  getServerServiceHeaders,
  resolveServerOrigin,
  resolveServerServiceUrl,
} from './context';

describe('server page request context', () => {
  const originalInternalApi = process.env.GEN3_INTERNAL_API;

  afterEach(() => {
    jest.resetAllMocks();
    if (originalInternalApi === undefined) {
      delete process.env.GEN3_INTERNAL_API;
    } else {
      process.env.GEN3_INTERNAL_API = originalInternalApi;
    }
  });

  it('copies only the request metadata used by server clients', () => {
    expect(
      getServerRequestHeaders({
        cookie: 'session=abc',
        authorization: 'Bearer secret',
        host: 'commons.example.org',
        'x-forwarded-host': 'public.example.org',
        'x-forwarded-proto': 'https',
        'x-ignore-me': 'ignored',
      }),
    ).toEqual({
      Cookie: 'session=abc',
      Authorization: 'Bearer secret',
      Host: 'commons.example.org',
      'x-forwarded-host': 'public.example.org',
      'x-forwarded-proto': 'https',
    });
  });

  it('uses forwarded origin metadata', () => {
    expect(
      resolveServerOrigin({
        Host: 'internal:3010',
        'x-forwarded-host': 'commons.example.org',
        'x-forwarded-proto': 'https',
      }),
    ).toBe('https://commons.example.org');
  });

  it('uses http for localhost', () => {
    expect(resolveServerOrigin({ Host: 'localhost:3010' })).toBe(
      'http://localhost:3010',
    );
  });

  it('resolves relative service URLs through the internal runtime origin', () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service///';

    expect(
      resolveServerServiceUrl('/loom/graphql/flat', {
        Host: 'commons.example.org',
      }),
    ).toBe('http://revproxy-service/loom/graphql/flat');
  });

  it('retains absolute service URLs', () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service';

    expect(
      resolveServerServiceUrl('https://loom.example/graphql/flat', {}),
    ).toBe('https://loom.example/graphql/flat');
  });

  it('falls back to the forwarded request origin without an internal origin', () => {
    delete process.env.GEN3_INTERNAL_API;

    expect(
      resolveServerServiceUrl('/loom/graphql/flat', {
        Host: 'internal:3000',
        'x-forwarded-host': 'commons.example.org',
        'x-forwarded-proto': 'https',
      }),
    ).toBe('https://commons.example.org/loom/graphql/flat');
  });

  it('forwards authentication without forwarding routing headers', () => {
    expect(
      getServerServiceHeaders({
        Cookie: 'access_token=token',
        Authorization: 'Bearer token',
        Host: 'commons.example.org',
        'x-forwarded-host': 'commons.example.org',
        'x-forwarded-proto': 'https',
      }),
    ).toEqual({
      Cookie: 'access_token=token',
      Authorization: 'Bearer token',
    });
  });

  it('binds Loom GraphQL to the internal origin with request authentication', async () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service';
    const signal = new AbortController().signal;
    (fetchGraphQL as jest.Mock).mockResolvedValue({ ok: true });
    const context = createServerPageContext(
      {
        req: {
          headers: {
            cookie: 'access_token=token',
            authorization: 'Bearer token',
            host: 'commons.example.org',
            'x-forwarded-host': 'commons.example.org',
            'x-forwarded-proto': 'https',
          },
        },
      } as unknown as GetServerSidePropsContext,
      jest.fn(),
    );

    await expect(
      context.loom.graphql({
        query: 'query Health { ok }',
        variables: { project: 'example' },
        signal,
      }),
    ).resolves.toEqual({ ok: true });
    expect(fetchGraphQL).toHaveBeenCalledWith(
      {
        query: 'query Health { ok }',
        variables: { project: 'example' },
      },
      {
        endpoint: 'http://revproxy-service/loom/graphql/graph',
        signal,
        headers: {
          Cookie: 'access_token=token',
          Authorization: 'Bearer token',
        },
      },
    );
  });

  it('supports client-side app contexts without a Node request', async () => {
    (fetchGraphQL as jest.Mock).mockResolvedValue({ ok: true });
    const context = createServerPageContext(
      {} as GetServerSidePropsContext,
      jest.fn(),
    );

    await expect(
      context.loom.graphql({ query: 'query Health { ok }' }),
    ).resolves.toEqual({ ok: true });
    expect(fetchGraphQL).toHaveBeenCalledWith(
      { query: 'query Health { ok }' },
      expect.objectContaining({
        endpoint: 'http://localhost:3000/loom/graphql/graph',
        headers: {},
      }),
    );
  });
});
