import { ContentStore } from './types';
import fs from 'fs';
import path from 'path';
import { ContentError } from './errors';

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
    } catch (cause) {
      this.log(`ERROR ${full}`);
      const code =
        typeof cause === 'object' && cause !== null && 'code' in cause
          ? String(cause.code)
          : undefined;
      throw new ContentError(
        code === 'ENOENT'
          ? `Configuration file not found: ${filepath}`
          : `Cannot process configuration file: ${filepath}`,
        {
          kind: code === 'ENOENT' ? 'filesystem' : 'parse',
          status: code === 'ENOENT' ? 404 : 500,
          retryable: false,
          path: filepath,
          cause,
        },
      );
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
