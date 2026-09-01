jest.mock('@gen3/core', () => ({
  GEN3_GECKO_API: '/gecko',
}));

import {
  MicroserviceContent,
  resolveMicroserviceUrl,
} from './MicroserviceContent';

describe('resolveMicroserviceUrl', () => {
  const originalInternalApi = process.env.GEN3_INTERNAL_API;
  const originalHostname = process.env.HOSTNAME;

  afterEach(() => {
    if (originalInternalApi === undefined) {
      delete process.env.GEN3_INTERNAL_API;
    } else {
      process.env.GEN3_INTERNAL_API = originalInternalApi;
    }

    if (originalHostname === undefined) {
      delete process.env.HOSTNAME;
    } else {
      process.env.HOSTNAME = originalHostname;
    }
  });

  it('uses the internal origin for relative SSR requests', () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service/';

    expect(
      resolveMicroserviceUrl(
        '/gecko/nav/1',
        { Host: 'public.example.org' },
        true,
      ),
    ).toBe('http://revproxy-service/gecko/nav/1');
  });

  it('normalizes extra origin and path slashes', () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service///';

    expect(resolveMicroserviceUrl('///gecko/nav/1', {}, true)).toBe(
      'http://revproxy-service/gecko/nav/1',
    );
  });

  it('leaves browser-relative URLs relative', () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service';

    expect(resolveMicroserviceUrl('/gecko/nav/1', {}, false)).toBe(
      '/gecko/nav/1',
    );
  });

  it('leaves absolute URLs unchanged', () => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service';
    const url = 'https://config.example.org/gecko/nav/1';

    expect(resolveMicroserviceUrl(url, {}, true)).toBe(url);
    expect(resolveMicroserviceUrl(url, {}, false)).toBe(url);
  });

  it('retains the existing request-origin fallback when no internal origin is set', () => {
    delete process.env.GEN3_INTERNAL_API;

    expect(
      resolveMicroserviceUrl('/gecko/nav/1', { Host: 'localhost:3010' }, true),
    ).toBe('http://localhost:3010/gecko/nav/1');
  });

  it('falls back to localhost when no host metadata is available', () => {
    delete process.env.GEN3_INTERNAL_API;
    process.env.HOSTNAME = '';

    expect(resolveMicroserviceUrl('/gecko/nav/1', {}, true)).toBe(
      'http://localhost:3000/gecko/nav/1',
    );
  });
});

describe('MicroserviceContent', () => {
  const originalInternalApi = process.env.GEN3_INTERNAL_API;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GEN3_INTERNAL_API = 'http://revproxy-service';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: jest.fn().mockResolvedValue('{}'),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    if (originalInternalApi === undefined) {
      delete process.env.GEN3_INTERNAL_API;
    } else {
      process.env.GEN3_INTERNAL_API = originalInternalApi;
    }
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('forwards auth headers without replaying routing headers', async () => {
    await new MicroserviceContent(true).get('nav/1', {
      Cookie: 'session=abc',
      Authorization: 'Bearer secret',
      Host: 'public.example.org',
      'x-forwarded-host': 'public.example.org',
      'x-forwarded-proto': 'https',
      'x-request-id': 'request-123',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://revproxy-service/gecko/nav/1',
      {
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'session=abc',
          Authorization: 'Bearer secret',
          'x-request-id': 'request-123',
        },
        cache: 'no-store',
      },
    );
  });
});
