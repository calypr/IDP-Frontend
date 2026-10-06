import type { GetServerSidePropsContext } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';

jest.mock('@gen3/core', () => ({
  GEN3_COMMONS_NAME: 'cbds',
  GEN3_FENCE_API: '/user',
}));
jest.mock('../../lib/common/staticProps', () => ({
  getNavPageLayoutPropsFromConfig: jest.fn(),
}));
jest.mock('../../lib/content', () => ({
  __esModule: true,
  default: {
    getContentDatabase: () => ({ get: async () => null }),
  },
}));

import { CalyprPageGetServerSideProps, verifyAuthenticatedSession } from './data';

const context = {
  req: {
    headers: {
      host: 'commons.example',
      'x-forwarded-proto': 'https',
    },
  },
} as unknown as GetServerSidePropsContext;

describe('verifyAuthenticatedSession', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('uses the Fence user response rather than cookie presence', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    await expect(
      verifyAuthenticatedSession(context, { Cookie: 'access_token=stale' }),
    ).resolves.toBe(false);
  });

  it('accepts a user response with a username', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ username: 'researcher@example.org' }),
    });

    await expect(verifyAuthenticatedSession(context, {})).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commons.example/user/user',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('leaves the result unresolved when Fence is unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    await expect(verifyAuthenticatedSession(context, {})).resolves.toBeNull();
  });
});


describe('CALYPR login result', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('passes a rejected login to the public root page', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    jest.mocked(getNavPageLayoutPropsFromConfig).mockResolvedValue({
      headerProps: { topBar: { items: [] } },
      footerProps: {},
    } as Awaited<ReturnType<typeof getNavPageLayoutPropsFromConfig>>);

    const result = await CalyprPageGetServerSideProps({
      ...context,
      query: { login_error: 'no_project_access' },
    });

    expect(result).toHaveProperty('props.loginError', 'no_project_access');
    expect(result).toHaveProperty('props.hasAuthenticatedSession', false);
  });

  it('omits the login error on a normal home request', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    jest.mocked(getNavPageLayoutPropsFromConfig).mockResolvedValue({
      headerProps: { topBar: { items: [] } },
      footerProps: {},
    } as Awaited<ReturnType<typeof getNavPageLayoutPropsFromConfig>>);

    const result = await CalyprPageGetServerSideProps({
      ...context,
      query: {},
    });

    expect(result).not.toHaveProperty('props.loginError');
    expect(result).toHaveProperty('props.hasAuthenticatedSession', false);
  });
});
