import { ContentStore } from './types';

export class ContentDatabase {
  constructor(public store: ContentStore) {}

  public async get<T extends Record<string, any>>(
    filepath: string,
  ): Promise<T> {
    return this.store.get(filepath);
  }

  public async getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
  ): Promise<Array<T>> {
    return this.store.getAll(filepath, filter);
  }
}
