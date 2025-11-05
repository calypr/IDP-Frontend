import { ContentStore } from './types';
import fs from 'fs';
import path from 'path';

export class FilesystemContent implements ContentStore {
  constructor(public rootPath: string = '') {}

  private log(msg: string) {
    console.log('[Filesystem]', msg);
  }

  public async get<T extends Record<string, any>>(
    filepath: string,
  ): Promise<T> {
    const clean = filepath.replace(/^\/+/, '');
    const full = path.join(this.rootPath, clean);
    this.log(`Reading ${full}`);

    try {
      const txt = fs.readFileSync(full, 'utf8');
      return JSON.parse(txt) as T;
    } catch (e) {
      this.log(`ERROR ${full}`);
      throw new Error(`Cannot process ${full}`);
    }
  }

  public async getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
  ): Promise<Array<T>> {
    const dir = path.join(this.rootPath, filepath.replace(/^\/+/, ''));
    const files = fs.readdirSync(dir).filter((f) => f.includes(filter));
    return Promise.all(files.map((f) => this.get<T>(path.join(filepath, f))));
  }
}
