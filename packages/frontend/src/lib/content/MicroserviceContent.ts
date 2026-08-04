import { ContentStore } from './types'; // This must be updated to include the headers
import { CALYPR_EXPLORER_CONFIG_API } from '@gen3/core';
import { getCookie } from 'cookies-next'; // Still useful for client-side debugging/fallback
import { ContentError } from './errors';

export class MicroserviceContent implements ContentStore {
  private log(msg: string) {
    console.log('[Microservice]', msg);
  }

  private async fetch<T>(
    url: string,
    requestHeaders?: Record<string, string>,
  ): Promise<T> {
    let targetUrl = url;

    if (
      typeof window === 'undefined' &&
      !targetUrl.startsWith('http://') &&
      !targetUrl.startsWith('https://')
    ) {
      // We are in Node.js (SSR) and the URL is relative. Prepend origin to prevent ERR_INVALID_URL.
      const hostHeader =
        requestHeaders?.['Host'] ||
        requestHeaders?.['host'] ||
        process.env.HOSTNAME ||
        'localhost:3000';

      const protocol =
        hostHeader.includes('localhost') ||
        hostHeader.includes('127.0.0.1') ||
        hostHeader.includes('::1')
          ? 'http'
          : 'https';

      targetUrl = `${protocol}://${hostHeader}${targetUrl.startsWith('/') ? '' : '/'}${targetUrl}`;
    }

    this.log(`GET ${targetUrl}`);

    // Default headers, including those passed from ContentDatabase
    const finalHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...requestHeaders, // Merge the headers passed from ContentDatabase (including 'Cookie')
    };

    if (!finalHeaders['Cookie'] && !finalHeaders['Authorization']) {
      const accessToken = getCookie('credentials_token');
      if (accessToken) {
        finalHeaders['Authorization'] = `Bearer ${accessToken}`;
      }
    }

    this.log(
      `Request auth cookie=${Boolean(finalHeaders.Cookie)} authorization=${Boolean(finalHeaders.Authorization)}`,
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
