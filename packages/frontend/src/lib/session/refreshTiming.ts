import type { AuthTokenData } from './types';

const MIN_DELAY_MS = 5_000;
const EXPIRY_BUFFER_MS = 2_000;

const remainingMs = (relative: number | undefined, expires: number | undefined) =>
  relative ?? (expires === undefined ? undefined : expires * 1000 - Date.now());

/**
 * Schedule from the earlier of Fence's session and access-token expirations.
 * If a request did not rotate a token already inside the renewal window,
 * wait until its expiry instead of polling Fence every five seconds.
 */
export const nextRefreshDelay = (
  session: AuthTokenData,
  earlyMs: number,
  previous?: AuthTokenData,
): number | null => {
  if (session.status !== 'issued' && session.fenceStatus === 'issued') {
    return MIN_DELAY_MS;
  }

  const deadlines: number[] = [];
  const accessRemaining = remainingMs(session.expiresInMs, session.expires);
  if (session.status === 'issued' && accessRemaining !== undefined) {
    const unchanged =
      previous?.expires === session.expires && accessRemaining <= earlyMs;
    deadlines.push(
      unchanged
        ? accessRemaining + EXPIRY_BUFFER_MS
        : accessRemaining - earlyMs,
    );
  }

  const fenceRemaining = remainingMs(
    session.fenceExpiresInMs,
    session.fenceExpires,
  );
  if (session.fenceStatus === 'issued' && fenceRemaining !== undefined) {
    const unchanged =
      previous?.fenceExpires === session.fenceExpires &&
      fenceRemaining <= earlyMs;
    deadlines.push(
      unchanged
        ? fenceRemaining + EXPIRY_BUFFER_MS
        : fenceRemaining - earlyMs,
    );
  }

  if (deadlines.length > 0) {
    return Math.max(MIN_DELAY_MS, Math.min(...deadlines));
  }
  if (session.fenceStatus === 'issued') {
    return MIN_DELAY_MS;
  }
  return null;
};
