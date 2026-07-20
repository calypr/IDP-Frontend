import type { GetServerSidePropsContext } from 'next';

jest.mock('@gen3/core', () => ({
  GEN3_COMMONS_NAME: 'cbds',
  GEN3_FENCE_API: '/user',
}));
jest.mock('../../lib/common/staticProps', () => ({
  getNavPageLayoutPropsFromConfig: jest.fn(),
}));
jest.mock('../../lib/content', () => ({
  __esModule: true,
  default: {},
}));

import { verifyAuthenticatedSession } from './data';

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
