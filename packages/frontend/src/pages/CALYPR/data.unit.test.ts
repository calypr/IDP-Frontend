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

import { sessionRequestHeaders, verifyAuthenticatedSession } from './data';

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

    await expect(
      verifyAuthenticatedSession(context, {
        Authorization: 'Bearer credentials-token',
      }),
    ).resolves.toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://commons.example/user/user',
      expect.objectContaining({
        cache: 'no-store',
        headers: { Authorization: 'Bearer credentials-token' },
      }),
    );
  });

  it('does not call Fence when the request has no Fence credential', async () => {
    global.fetch = jest.fn();

    await expect(verifyAuthenticatedSession(context, {})).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('leaves the result unresolved when Fence is unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
    });

    await expect(
      verifyAuthenticatedSession(context, { Cookie: 'access_token=current' }),
    ).resolves.toBeNull();
  });
});

describe('sessionRequestHeaders', () => {
  it('converts a credentials login cookie to the Bearer header Fence expects', () => {
    const credentialsContext = {
      req: {
        headers: {
          cookie: 'theme=dark; credentials_token=header.payload.signature',
        },
      },
    } as unknown as GetServerSidePropsContext;

    expect(sessionRequestHeaders(credentialsContext)).toEqual({
      Cookie: 'theme=dark; credentials_token=header.payload.signature',
      Authorization: 'Bearer header.payload.signature',
    });
  });

  it('does not replace an explicit Authorization header', () => {
    const authorizedContext = {
      req: {
        headers: {
          authorization: 'Bearer explicit',
          cookie: 'credentials_token=cookie-token',
        },
      },
    } as unknown as GetServerSidePropsContext;

    expect(sessionRequestHeaders(authorizedContext).Authorization).toBe(
      'Bearer explicit',
    );
  });

  it('prefers a Fence access token over a credentials login cookie', () => {
    const fenceContext = {
      req: {
        headers: {
          cookie:
            'access_token=fence-session; credentials_token=stale-credential',
        },
      },
    } as unknown as GetServerSidePropsContext;

    expect(sessionRequestHeaders(fenceContext)).toEqual({
      Cookie: 'access_token=fence-session; credentials_token=stale-credential',
    });
  });
});
