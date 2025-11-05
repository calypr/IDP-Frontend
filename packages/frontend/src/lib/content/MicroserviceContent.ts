import { ContentStore } from './types';
import { CALYPR_EXPLORER_CONFIG_API } from '@gen3/core';

export class MicroserviceContent implements ContentStore {
  private base = CALYPR_EXPLORER_CONFIG_API;

  private log(msg: string) {
    console.log('[Microservice]', msg);
  }

  private async fetch<T>(url: string): Promise<T> {
    this.log(`GET ${url}`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Microservice fetch failed: ${res.status} ${url}`);
    }
    const data = await res.json();
    this.log('Success');
    return data as T;
  }

  public async get<T extends Record<string, any>>(
    filepath: string,
  ): Promise<T> {
    const clean = filepath.replace(/^\/+/, '');
    const url = `${this.base}/${clean}`;
    return this.fetch<T>(url);
  }

  public async getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
  ): Promise<Array<T>> {
    const data = await this.get<Array<T>>(filepath);
    if (!filter) return data;
    return data.filter((i) =>
      JSON.stringify(i).toLowerCase().includes(filter.toLowerCase()),
    );
  }
}
