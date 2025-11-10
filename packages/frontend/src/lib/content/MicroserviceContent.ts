import { ContentStore } from './types'; // This must be updated to include the headers
import { CALYPR_EXPLORER_CONFIG_API } from '@gen3/core';
import { getCookie } from 'cookies-next'; // Still useful for client-side debugging/fallback

export class MicroserviceContent implements ContentStore {
  private base = CALYPR_EXPLORER_CONFIG_API;

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
      throw new Error(`Microservice fetch failed: ${res.status} ${url}`);
    }

    try {
      const data = await res.json();
      this.log('Success');
      return data as T;
    } catch (e) {
      console.error(
        'Explorer config cannot be read: Failed to parse JSON response. Status:',
        res.status,
        e,
      );
      throw new Error(
        `Microservice fetch failed: Received non-JSON response with status ${res.status}`,
      );
    }
  }

  public async get<T extends Record<string, any>>(
    filepath: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    const clean = filepath.replace(/^\/+/, '');
    const url = `${this.base}/${clean}`;
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
