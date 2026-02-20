// src/lib/content/index.ts
import { FilesystemContent } from './filesystem';
import { MicroserviceContent } from './MicroserviceContent';
import { ContentDatabase } from './ContentDatabase';
import { GEN3_FRONTEND_CONFIGURATION_ROOT } from './constants';
import { ContentStore } from './types';

export class ContentSourceProvider {
  private static instance: ContentSourceProvider | null = null;
  private db: ContentDatabase;

  private constructor() {
    const microUrl = process.env.CONTENT_MICROSERVICE_URL?.trim();
    let store: ContentStore;

    if (microUrl) {
      try {
        new URL(microUrl);
      } catch {
        throw new Error(`Invalid CONTENT_MICROSERVICE_URL: ${microUrl}`);
      }
      store = new MicroserviceContent();
      console.log('[Provider] Using Microservice →', microUrl);
    } else {
      const root = GEN3_FRONTEND_CONFIGURATION_ROOT || 'config';
      store = new FilesystemContent(root);
      console.log('[Provider] Using Filesystem →', root);
    }

    this.db = new ContentDatabase(store);
  }

  public static getInstance(): ContentSourceProvider {
    if (!ContentSourceProvider.instance) {
      ContentSourceProvider.instance = new ContentSourceProvider();
    }
    return ContentSourceProvider.instance;
  }

  public getContentDatabase(): ContentDatabase {
    return this.db;
  }
}

export const filesystemDb = new ContentDatabase(
  new FilesystemContent(GEN3_FRONTEND_CONFIGURATION_ROOT || 'config'),
);
export const microserviceDb = new ContentDatabase(new MicroserviceContent());
export default ContentSourceProvider.getInstance();
