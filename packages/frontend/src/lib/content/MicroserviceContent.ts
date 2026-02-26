import { ContentStore } from './types'; // This must be updated to include the headers
import { CALYPR_EXPLORER_CONFIG_API } from '@gen3/core';
import { getCookie } from 'cookies-next'; // Still useful for client-side debugging/fallback

export class MicroserviceContent implements ContentStore {
  private log(msg: string) {
    console.log('[Microservice]', msg);
  }

  private async fetch<T>(
    url: string,
    requestHeaders?: Record<string, string>,
  ): Promise<T> {
    this.log(`GET ${url}`);

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

    const res = await fetch(url, {
      headers: finalHeaders, // Use the merged headers
    });

    if (!res.ok) {
      const message =
        res.status === 401
          ? `Unauthorized: ${url}`
          : `Microservice fetch failed: ${res.status} ${url}`;
      const error = new Error(message);
      (error as any).status = res.status;
      throw error;
    }

    const responseText = await res.text();
    try {
      const data = JSON.parse(responseText);
      this.log('Success');
      return data as T;
    } catch (e) {
      const error = new Error(
        `Microservice fetch failed: Received non-JSON response with status ${res.status} from ${url}`,
      );
      (error as any).status = res.status;
      throw error;
    }
  }

  public async get<T extends Record<string, any>>(
    filepath: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const clean = filepath.replace(/^\/+/, '');

    if (CALYPR_EXPLORER_CONFIG_API?.trim() === '/ExplorerConfig') {
      console.log(`API base missing – returning empty object for ${clean}`);
      return {} as T; // ← build continues
    }

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
