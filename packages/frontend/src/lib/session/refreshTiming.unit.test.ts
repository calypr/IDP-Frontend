import { nextRefreshDelay } from './refreshTiming';
import type { AuthTokenData } from './types';

const token = (overrides: Partial<AuthTokenData> = {}): AuthTokenData => ({
  status: 'issued',
  expires: 2_000,
  expiresInMs: 20 * 60_000,
  fenceStatus: 'issued',
  fenceExpires: 1_000,
  fenceExpiresInMs: 15 * 60_000,
  ...overrides,
});

describe('nextRefreshDelay', () => {
  it('refreshes before the earlier Fence session expiry', () => {
    expect(nextRefreshDelay(token(), 120_000)).toBe(13 * 60_000);
  });

  it('refreshes before the access token when it expires first', () => {
    expect(
      nextRefreshDelay(
        token({ expiresInMs: 4 * 60_000, fenceExpiresInMs: 15 * 60_000 }),
        120_000,
      ),
    ).toBe(2 * 60_000);
  });

  it('waits for expiry if Fence did not renew a token in the early window', () => {
    const unchanged = token({
      expiresInMs: 60_000,
      fenceExpiresInMs: 15 * 60_000,
    });
    expect(nextRefreshDelay(unchanged, 120_000, unchanged)).toBe(62_000);
  });

  it('tries to recover a missing access token while the Fence session lives', () => {
    expect(
      nextRefreshDelay(
        token({ status: 'not present', expires: undefined, expiresInMs: undefined }),
        120_000,
      ),
    ).toBe(5_000);
  });

  it('stops when neither token can support a session', () => {
    expect(
      nextRefreshDelay(
        token({
          status: 'expired',
          fenceStatus: 'expired',
          expiresInMs: -1,
          fenceExpiresInMs: -1,
        }),
        120_000,
      ),
    ).toBeNull();
  });
});
