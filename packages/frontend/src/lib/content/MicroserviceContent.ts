import { ContentStore } from './types'; // This must be updated to include the headers
import { CALYPR_EXPLORER_CONFIG_API } from '@gen3/core';
import { getCookie } from 'cookies-next'; // Still useful for client-side debugging/fallback
import { ContentError } from './errors';

const ROUTING_HEADERS = new Set([
  'host',
  'x-forwarded-host',
  'x-forwarded-proto',
]);

const hasHeader = (headers: Record<string, string>, name: string): boolean =>
  Object.keys(headers).some((header) => header.toLowerCase() === name);

const forwardRequestHeaders = (
  requestHeaders?: Record<string, string>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(requestHeaders ?? {}).filter(
      ([name]) => !ROUTING_HEADERS.has(name.toLowerCase()),
    ),
  );

const joinOriginAndPath = (origin: string, path: string): string =>
  `${origin.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

export const resolveMicroserviceUrl = (
  url: string,
  requestHeaders: Readonly<Record<string, string>> = {},
  isServer = typeof window === 'undefined',
): string => {
  if (!isServer || /^https?:\/\//i.test(url)) return url;

  const internalOrigin = process.env.GEN3_INTERNAL_API?.trim();
  if (internalOrigin) return joinOriginAndPath(internalOrigin, url);

  // Keep the existing SSR fallback for local development and deployments that
  // have not configured an internal origin yet.
  const hostHeader =
    requestHeaders.Host ||
    requestHeaders.host ||
    process.env.HOSTNAME ||
    'localhost:3000';
  const protocol =
    hostHeader.includes('localhost') ||
    hostHeader.includes('127.0.0.1') ||
    hostHeader.includes('::1')
      ? 'http'
      : 'https';

  return joinOriginAndPath(`${protocol}://${hostHeader}`, url);
};

export class MicroserviceContent implements ContentStore {
  constructor(private readonly isServer = typeof window === 'undefined') {}

  private log(msg: string) {
    console.log('[Microservice]', msg);
  }

  private async fetch<T>(
    url: string,
    requestHeaders?: Record<string, string>,
  ): Promise<T> {
    const targetUrl = resolveMicroserviceUrl(
      url,
      requestHeaders,
      this.isServer,
    );

    this.log(`GET ${targetUrl}`);

    // Forward authentication context, but let the internal hop establish its
    // own routing metadata.
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...forwardRequestHeaders(requestHeaders),
    };

    if (
      !hasHeader(finalHeaders, 'cookie') &&
      !hasHeader(finalHeaders, 'authorization')
    ) {
      const accessToken = getCookie('credentials_token');
      if (accessToken) {
        finalHeaders['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    this.log(
      `Request auth cookie=${hasHeader(finalHeaders, 'cookie')} authorization=${hasHeader(finalHeaders, 'authorization')}`,
    );

    let res: Response;
    try {
      res = await fetch(targetUrl, {
        headers: finalHeaders,
        cache: 'no-store',
      });
    } catch (cause) {
      throw new ContentError(`Unable to reach configuration service`, {
        kind: 'transport',
        status: 502,
        retryable: true,
        path: url,
        cause,
      });
    }

    this.log(
      `Response ${res.status} requestId=${res.headers.get('x-request-id') ?? 'none'}`,
    );

    if (!res.ok) {
      const message =
        res.status === 401
          ? `Unauthorized: ${url}`
          : `Microservice fetch failed: ${res.status} ${url}`;
      throw new ContentError(message, {
        kind: 'http',
        status: res.status,
        requestId: res.headers.get('x-request-id') ?? undefined,
        path: url,
      });
    }

    const responseText = await res.text();
    try {
      const data = JSON.parse(responseText);
      this.log('Success');
      return data as T;
    } catch (cause) {
      throw new ContentError(
        `Microservice fetch failed: Received non-JSON response with status ${res.status} from ${url}`,
        {
          kind: 'parse',
          status: 502,
          requestId: res.headers.get('x-request-id') ?? undefined,
          path: url,
          cause,
        },
      );
    }
  }

  public async get<T extends Record<string, any>>(
    filepath: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const clean = filepath.replace(/^\/+/, '');

    const url = `${CALYPR_EXPLORER_CONFIG_API}/${clean}`;
    console.log('URL: ', url);
    return this.fetch<T>(url, headers);
  }

  public async getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
    headers?: Record<string, string>,
  ): Promise<Array<T>> {
    const data = await this.get<Array<T>>(filepath, headers);
    if (!filter) return data;
    return data.filter((i) =>
      JSON.stringify(i).toLowerCase().includes(filter.toLowerCase()),
    );
  }
}
