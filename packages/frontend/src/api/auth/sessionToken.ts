import type { NextApiRequest, NextApiResponse } from 'next';
import { deleteCookie, getCookie } from 'cookies-next';
import { decodeProtectedHeader, importSPKI, JWTPayload, jwtVerify } from 'jose';
import { fetchJWTKey } from './utils';
import { getWebTokenErrorResponse } from './errorHandler';

export const isExpired = (expirationSeconds: number) =>
  expirationSeconds * 1000 <= Date.now();

export interface JWTPayloadAndUser extends JWTPayload {
  context: Record<string, string>;
}

/**
 * returns the access_token expiration, user, and status
 * @param req
 * @param res
 */
export default async function (req: NextApiRequest, res: NextApiResponse) {
  try {
    const access_token = await getCookie('access_token', { req, res });
    if (access_token) {
      const token = access_token as string;
      const jwtKey = await fetchJWTKey(decodeProtectedHeader(token).kid);
      if (!jwtKey) {
        res.status(500).json({
          message: 'No JWT Key to verify token',
        });
        return res;
      }
      // validate the token
      const publicKey = await importSPKI(jwtKey, 'RS256');
      const { payload } = await jwtVerify(token, publicKey);
      const decodedAccessToken = payload as JWTPayloadAndUser;

      // A credentials login token is useful only when there is no valid Fence
      // browser session. Leaving both cookies in place makes client requests
      // prefer the Bearer credential, which can override a newer access_token.
      if (await getCookie('credentials_token', { req, res })) {
        await deleteCookie('credentials_token', {
          req,
          res,
          sameSite: 'lax',
          httpOnly: process.env.NODE_ENV === 'production',
          secure: process.env.NODE_ENV === 'production',
        });
      }

      return res.status(200).json({
        issued: decodedAccessToken.iat,
        expires: decodedAccessToken.exp,
        userContext: decodedAccessToken.context.user,
        status: decodedAccessToken.exp
          ? isExpired(decodedAccessToken.exp)
            ? 'expired'
            : 'issued'
          : 'invalid',
      });
    }

    return res.status(200).json({
      status: 'not present',
    });
  } catch (error: unknown) {
    getWebTokenErrorResponse(error, res); // will update the res object with error
  }
}
