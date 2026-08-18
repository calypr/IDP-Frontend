import type {
  GetServerSidePropsContext,
  Redirect,
} from 'next';
import type { ZodType } from 'zod';
import type { NavPageLayoutProps } from '../../features/Navigation';

export type PageProblemSeverity = 'warning' | 'error';

export type PageProblemSource =
  | 'navigation'
  | 'content'
  | 'gecko'
  | 'filesystem'
  | 'loom'
  | 'fence'
  | 'config'
  | 'internal';

export interface ConfigValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface PageLoadProblem {
  readonly severity: PageProblemSeverity;
  readonly source: PageProblemSource;
  readonly status: number;
  readonly message: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly configPath?: string;
  readonly issues?: readonly ConfigValidationIssue[];
}

export interface RequestBoundContentClient {
  get<T extends Record<string, any>>(filepath: string): Promise<T>;
  getAll<T extends Record<string, any>>(
    filepath: string,
    filter: string,
  ): Promise<readonly T[]>;
}

export interface RequestBoundLoomClient {
  graphql<T>(args: {
    query: string;
    variables?: Record<string, unknown>;
    endpoint?: string;
    signal?: AbortSignal;
  }): Promise<T>;
  get<T>(path: string): Promise<T>;
}

export interface ConfigDescriptor<T> {
  readonly id: string;
  readonly source: 'content' | 'gecko' | 'filesystem';
  readonly resolvePath: (context: ServerPageContext) => string;
  readonly schema: ZodType<T>;
}

export interface RequestConfigLoader {
  load<T>(descriptor: ConfigDescriptor<T>): Promise<T>;
  optional<T>(descriptor: ConfigDescriptor<T>): Promise<T | null>;
  withFallback<T>(descriptor: ConfigDescriptor<T>, fallback: T): Promise<T>;
}

export interface PageProblemCollector {
  readonly all: readonly PageLoadProblem[];
  add(problem: PageLoadProblem): void;
}

export interface ServerPageContext {
  readonly next: GetServerSidePropsContext;
  readonly headers: Readonly<Record<string, string>>;
  readonly content: RequestBoundContentClient;
  readonly gecko: RequestBoundContentClient;
  readonly loom: RequestBoundLoomClient;
  readonly config: RequestConfigLoader;
  readonly problems: PageProblemCollector;
  loadNavigation(): Promise<NavPageLayoutProps>;
}

export type PageLoadResult<T extends object> =
  | { readonly kind: 'props'; readonly props: T }
  | { readonly kind: 'redirect'; readonly redirect: Redirect }
  | { readonly kind: 'notFound' };

export type PageProps<TExtra extends object = Record<never, never>> =
    NavPageLayoutProps &
    TExtra & {
      readonly pageProblems?: readonly PageLoadProblem[];
    };

export type ConfigPageProps<
  TConfiguration,
  TExtra extends object = Record<never, never>,
> = PageProps<TExtra> & {
  readonly configuration: TConfiguration | null;
};
