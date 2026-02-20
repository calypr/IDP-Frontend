import { ContentStore } from './types';

export class ContentDatabase {
  constructor(public store: ContentStore) {}

  public async get<T extends Record<string, any>>(
    filepath: string,
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.store.get(filepath, headers);
  }

  public async getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
    headers?: Record<string, string>,
  ): Promise<Array<T>> {
    return this.store.getAll(filepath, filter, headers);
  }
}
