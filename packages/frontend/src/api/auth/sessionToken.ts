import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteCookie, getCookie } from 'cookies-next';
import { decodeJwt, errors, importSPKI, jwtVerify } from 'jose';
import type { CryptoKey, JWTPayload } from 'jose';
import { fetchJWTKey } from './utils';

export const isExpired = (expires: number): boolean =>
  expires * 1000 <= Date.now();

export interface JWTPayloadAndUser extends JWTPayload {
  context: Record<string, string>;
}

interface SessionTokenClaims extends JWTPayload {
  context?: { user?: Record<string, string> };
}

const readToken = async (token: string, publicKey: CryptoKey) => {
  let status: 'issued' | 'expired' | 'invalid' = 'issued';
  try {
    await jwtVerify(token, publicKey);
  } catch (error) {
    if (!(error instanceof errors.JWTExpired)) {
      return { status: 'invalid' as const };
    }
    status = 'expired';
  }

  const claims = decodeJwt(token) as SessionTokenClaims;
  if (typeof claims.exp !== 'number') {
    return { status: 'invalid' as const };
  }

  return {
    status,
    issued: claims.iat,
    expires: claims.exp,
    expiresInMs: claims.exp * 1000 - Date.now(),
    userContext: claims.context?.user,
  };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  const accessToken = getCookie('access_token', { req, res });
  const fenceToken = getCookie('fence', { req, res });

  if (!accessToken && !fenceToken) {
    res.status(200).json({ status: 'not present' });
    return;
  }

  try {
    const jwtKey = await fetchJWTKey();
    if (!jwtKey) {
      res.status(503).json({ message: 'Unable to retrieve Fence signing key' });
      return;
    }

    const publicKey = await importSPKI(jwtKey, 'RS256');
    const access =
      typeof accessToken === 'string'
        ? await readToken(accessToken, publicKey)
        : { status: 'not present' as const };
    const fence =
      typeof fenceToken === 'string'
        ? await readToken(fenceToken, publicKey)
        : undefined;

    if (access.status === 'issued' && getCookie('credentials_token', { req, res })) {
      deleteCookie('credentials_token', {
        req,
        res,
        sameSite: 'lax',
        httpOnly: process.env.NODE_ENV === 'production',
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.status(200).json({
      ...access,
      ...(fence
        ? {
            fenceStatus: fence.status,
            fenceIssued: 'issued' in fence ? fence.issued : undefined,
            fenceExpires: 'expires' in fence ? fence.expires : undefined,
            fenceExpiresInMs:
              'expiresInMs' in fence ? fence.expiresInMs : undefined,
          }
        : {}),
    });
  } catch {
    res.status(503).json({ message: 'Unable to determine session state' });
  }
}
