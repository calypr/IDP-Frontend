import type { GetServerSidePropsContext } from 'next';
import { fetchGraphQL } from '@gen3/core';
import ContentSource, { filesystemDb, microserviceDb } from '../content';
import type { ContentDatabase } from '../content/ContentDatabase';
import { isContentError } from '../content/errors';
import { normalizePageProblem } from './errors';
import type {
  ConfigDescriptor,
  PageLoadProblem,
  PageProblemCollector,
  RequestBoundContentClient,
  RequestBoundLoomClient,
  RequestConfigLoader,
  ServerPageContext,
} from './types';

type IncomingHeaders = Record<string, string | string[] | undefined>;

const copyHeader = (
  target: Record<string, string>,
  headers: IncomingHeaders,
  source: string,
  destination = source,
) => {
  const value = headers[source];
  if (typeof value === 'string') target[destination] = value;
};

export const getServerRequestHeaders = (
  headers: IncomingHeaders,
): Readonly<Record<string, string>> => {
  const result: Record<string, string> = {};
  copyHeader(result, headers, 'cookie', 'Cookie');
  copyHeader(result, headers, 'authorization', 'Authorization');
  copyHeader(result, headers, 'host', 'Host');
  copyHeader(result, headers, 'x-forwarded-host');
  copyHeader(result, headers, 'x-forwarded-proto');
  return Object.freeze(result);
};

export const resolveServerOrigin = (
  headers: Readonly<Record<string, string>>,
): string => {
  const host = headers['x-forwarded-host'] ?? headers.Host ?? 'localhost:3000';
  const protocol =
    headers['x-forwarded-proto'] ??
    (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  return `${protocol.split(',')[0]}://${host.split(',')[0]}`;
};

class BoundContentClient implements RequestBoundContentClient {
  constructor(
    private readonly database: ContentDatabase,
    private readonly headers: Readonly<Record<string, string>>,
  ) {}

  get<T extends Record<string, any>>(filepath: string): Promise<T> {
    return this.database.get<T>(filepath, { ...this.headers });
  }

  getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
  ): Promise<readonly T[]> {
    return this.database.getAll<T>(filepath, filter, { ...this.headers });
  }
}

class ProblemCollector implements PageProblemCollector {
  private readonly problems: PageLoadProblem[] = [];

  get all(): readonly PageLoadProblem[] {
    return this.problems;
  }

  add(problem: PageLoadProblem) {
    this.problems.push(problem);
  }
}

export const createServerPageContext = (
  next: GetServerSidePropsContext,
  loadNavigation: (context: ServerPageContext) => Promise<any>,
): ServerPageContext => {
  const headers = getServerRequestHeaders(next.req.headers);
  const content = new BoundContentClient(
    ContentSource.getContentDatabase(),
    headers,
  );
  const gecko = new BoundContentClient(microserviceDb, headers);
  const filesystem = new BoundContentClient(filesystemDb, headers);
  const problems = new ProblemCollector();
  const context = {} as ServerPageContext;

  const config: RequestConfigLoader = {
    async load<T>(descriptor: ConfigDescriptor<T>) {
      const path = descriptor.resolvePath(context);
      const client =
        descriptor.source === 'gecko'
          ? gecko
          : descriptor.source === 'filesystem'
            ? filesystem
            : content;
      const value = await client.get<Record<string, any>>(path);
      return descriptor.schema.parse(value);
    },
    async optional<T>(descriptor: ConfigDescriptor<T>) {
      try {
        return await config.load(descriptor);
      } catch (error) {
        if (isContentError(error) && error.status === 404) return null;
        throw error;
      }
    },
    async withFallback<T>(descriptor: ConfigDescriptor<T>, fallback: T) {
      try {
        return await config.load(descriptor);
      } catch (error) {
        problems.add(
          normalizePageProblem(error, {
            source: descriptor.source,
            severity: 'warning',
            configPath: descriptor.resolvePath(context),
          }),
        );
        return fallback;
      }
    },
  };

  Object.assign(context, {
    next,
    headers,
    content,
    gecko,
    config,
    problems,
    loom: {
      graphql: ({ query, variables, endpoint, signal }: Parameters<
        RequestBoundLoomClient['graphql']
      >[0]) =>
        fetchGraphQL(
          { query, variables },
          { endpoint, signal, headers: { ...headers } },
        ),
    },
    loadNavigation: () => loadNavigation(context),
  });
  return context;
};
