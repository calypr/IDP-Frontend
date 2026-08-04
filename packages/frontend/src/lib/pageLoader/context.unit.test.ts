jest.mock('@gen3/core', () => ({ fetchGraphQL: jest.fn() }));

import { getServerRequestHeaders, resolveServerOrigin } from './context';

describe('server page request context', () => {
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
});
