import { ContentSource } from './types';
import fs from 'fs';
import path from 'path';

const myGlob = (dir: string, filter: string) => {
  try {
    const files = fs.readdirSync(dir);
    return files.filter((file) => file.search(filter) !== -1);
  } catch (error: any) {
    console.log('myGlow error', error, dir);
  }
  return [];
};

export class FilesystemContent implements ContentSource {
  rootPath: string;
  constructor({ rootPath }: { rootPath?: string }) {
    this.rootPath = rootPath || '';
  }

  public async get<T extends Record<string, any>>(
    filepath: string,
  ): Promise<T> {
    try {
      return await JSON.parse(
        fs.readFileSync(path.join(this.rootPath, filepath)).toString('utf-8'),
      );
    } catch (err) {
      throw new Error(`Cannot process ${filepath}: ${err}`);
    }
  }

  public async getRemote<T>(index: string): Promise<T> {
    try {
      const response = await fetch(`http://10.42.0.84:9200/${index}/_search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: { match_all: {} } }),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch data from Elasticsearch: ${response.statusText}`,
        );
      }
      const jsonResponse = await response.json();
      console.log('VALUES: ', jsonResponse);

      const values = jsonResponse?.hits?.hits?.[0]?.values;

      if (values === undefined) {
        throw new Error('The response does not contain hits or values.');
      }
      return values as T;
    } catch (err) {
      throw new Error(`Cannot process request to Elasticsearch: ${err}`);
    }
  }
  public async getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
  ): Promise<Array<T>> {
    try {
      const files = myGlob(path.join(this.rootPath, filepath), filter);
      return Promise.all(
        files.map((file) =>
          this.get<T>(path.join(this.rootPath, filepath, file)),
        ),
      );
    } catch (err) {
      throw new Error(`getAllCannot process ${filepath}/${filter}`);
    }
  }
}
