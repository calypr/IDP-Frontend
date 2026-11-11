import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Explorer from '../pages/Explorer/[configId]';

type ExplorerSummary = {
  readonly project: string;
  readonly explorerId: string;
  readonly title: string;
  readonly management: string;
  readonly activeRevisionId?: string;
  readonly updatedAt: string;
};

type ViewerStateArgs = {
  readonly project: string;
  readonly explorerId: string;
};
type QueryOptions = {
  readonly skip?: boolean;
  readonly refetchOnMountOrArgChange?: boolean;
};
type ViewerStateResult = {
  readonly currentData?: {
    readonly project: string;
    readonly runtime: {
      readonly outputs: ReadonlyArray<{
        readonly outputId: string;
        readonly title: string;
      }>;
    };
  };
  readonly error?: unknown;
  readonly isFetching?: boolean;
  readonly isLoading?: boolean;
  readonly isUninitialized?: boolean;
};

const mockRouterReplace = jest.fn();
const mockRouter: {
  pathname: string;
  query: Record<string, string | string[]>;
  replace: typeof mockRouterReplace;
} = {
  pathname: '/Explorer/[configId]',
  query: {},
  replace: mockRouterReplace,
};
const mockGetExplorerState = jest.fn(
  (args: ViewerStateArgs, _options: QueryOptions): ViewerStateResult => ({
    currentData: {
      project: args.project,
      runtime: {
        outputs: [{ outputId: 'Specimen', title: `${args.explorerId} view` }],
      },
    },
  }),
);
const mockGetExplorerSummaries = jest.fn(
  (
    _args: { readonly project: string },
    _options: QueryOptions,
  ): { data?: ReadonlyArray<ExplorerSummary>; error?: { status: number } } => ({
    data: [],
  }),
);

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}));
jest.mock('@gen3/core', () => ({
  canonicalLoomProjectId: (project: string) => project,
  useGetGeckoProjectsQuery: () => ({
    data: [{ resourcePath: '/programs/HTAN_INT/projects/BForePC' }],
  }),
  useGetExplorerStateV1Query: (args: ViewerStateArgs, options: QueryOptions) =>
    mockGetExplorerState(args, options),
  useGetExplorerAuthoringExplorersQuery: (
    args: { readonly project: string },
    options: QueryOptions,
  ) => mockGetExplorerSummaries(args, options),
}));
jest.mock('@gen3/frontend', () => ({
  isExplorerBuilderEnabled: () =>
    process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED === 'true',
  ExplorerMainContent: ({
    project,
    runtime,
  }: {
    project: string;
    runtime: { outputs: ReadonlyArray<{ title: string }> };
  }) => (
    <div>
      Published metadata for {project} ({runtime.outputs[0]?.title})
    </div>
  ),
  ExplorerPageGetServerSideProps: jest.fn(),
  NavPageLayout: ({ children }: { children: React.ReactNode }) => children,
  ProjectWorkspaceTabs: ({
    children,
    toolbarContent,
  }: {
    children: React.ReactNode;
    toolbarContent: React.ReactNode;
  }) => (
    <>
      {toolbarContent}
      {children}
    </>
  ),
  useIsEmbedded: () => false,
}));

const props = {
  headerProps: {
    topBar: { items: [] },
    navigation: { items: [] },
    leftnav: [],
    basePage: false,
  },
  footerProps: { basePage: false },
  headerMetadata: { title: 'Explorer', content: '', key: 'explorer' },
  pageProblems: [],
  runtime: null,
  explorerId: 'default',
  sharedFiltersMap: null,
};

const project = 'HTAN_INT/BForePC';
const publishedConfigs: ReadonlyArray<ExplorerSummary> = [
  {
    project,
    explorerId: 'metadata',
    title: 'Metadata',
    management: 'REPOSITORY',
    activeRevisionId: 'metadata-revision',
    updatedAt: '2026-11-01T00:00:00Z',
  },
  {
    project,
    explorerId: 'files',
    title: 'Files',
    management: 'REPOSITORY',
    activeRevisionId: 'files-revision',
    updatedAt: '2026-11-02T00:00:00Z',
  },
];

describe('published Explorer route', () => {
  const original = process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;

  beforeEach(() => {
    mockRouter.pathname = '/Explorer/[configId]';
    mockRouter.query = {
      configId: project,
      explorerId: 'metadata',
      tab: 'overview',
      facets: ['active', 'recent'],
    };
    mockRouter.replace.mockReset();
    mockGetExplorerState.mockClear();
    mockGetExplorerSummaries.mockReset();
    mockGetExplorerSummaries.mockReturnValue({ data: publishedConfigs });
    delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
  });

  afterEach(() => {
    if (original === undefined)
      delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    else process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = original;
  });

  it('selects an active project config and requests its Viewer state', () => {
    const { rerender } = render(<Explorer {...props} />);
    expect(mockGetExplorerSummaries).toHaveBeenLastCalledWith(
      { project },
      { skip: false, refetchOnMountOrArgChange: true },
    );
    expect(mockGetExplorerState).toHaveBeenLastCalledWith(
      { project, explorerId: 'metadata' },
      { skip: false, refetchOnMountOrArgChange: true },
    );
    expect(
      screen.getByRole('combobox', { name: 'Project configuration' }),
    ).toHaveValue('metadata');
    expect(
      screen.getByRole('tab', { name: 'metadata view' }),
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole('combobox', { name: 'Project configuration' }),
      { target: { value: 'files' } },
    );
    expect(mockRouter.replace).toHaveBeenCalledWith(
      {
        pathname: '/Explorer/[configId]',
        query: {
          configId: project,
          explorerId: 'files',
          tab: 'overview',
          facets: ['active', 'recent'],
        },
      },
      undefined,
      { shallow: true },
    );

    mockRouter.query = { ...mockRouter.query, explorerId: 'files' };
    rerender(<Explorer {...props} />);
    expect(mockGetExplorerState).toHaveBeenLastCalledWith(
      { project, explorerId: 'files' },
      { skip: false, refetchOnMountOrArgChange: true },
    );
    expect(
      screen.getByText(`Published metadata for ${project} (files view)`),
    ).toBeInTheDocument();
  });

  it('hides the config picker unless at least two configs are published and keeps Builder hidden by default', () => {
    mockGetExplorerSummaries.mockReturnValue({
      data: [
        publishedConfigs[0],
        { ...publishedConfigs[1], activeRevisionId: undefined },
      ],
    });
    render(<Explorer {...props} />);
    expect(
      screen.queryByRole('combobox', { name: 'Project configuration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'metadata view' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Builder' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Builder' }),
    ).not.toBeInTheDocument();
  });

  it('keeps the valid default Viewer when the config list fails or the query id is absent', () => {
    mockRouter.query = { configId: project, tab: 'overview' };
    mockGetExplorerSummaries.mockReturnValue({ error: { status: 503 } });
    render(<Explorer {...props} />);
    expect(
      screen.queryByRole('combobox', { name: 'Project configuration' }),
    ).not.toBeInTheDocument();
    expect(mockGetExplorerState).toHaveBeenLastCalledWith(
      { project, explorerId: 'default' },
      { skip: false, refetchOnMountOrArgChange: true },
    );
    expect(
      screen.getByText(`Published metadata for ${project} (default view)`),
    ).toBeInTheDocument();
  });

  it('uses SSR runtime only for its project and Explorer identity', () => {
    mockGetExplorerState.mockReturnValue({
      currentData: undefined,
      isFetching: true,
    });
    mockRouter.query = { configId: project, explorerId: 'metadata' };
    const ssrRuntime = {
      outputs: [
        {
          outputId: 'SsrMetadata',
          name: 'metadata',
          title: 'SSR Metadata',
          rowLabel: 'Item',
          selector: {
            recipe: 'metadata',
            translationVersion: '1',
            output: 'metadata',
          },
          columns: [],
          table: { columns: [] },
          filters: [],
          charts: [],
          fixedFilters: {},
        },
      ],
      sharedFilters: {},
      diagnostics: [],
    };
    const ssrProps = {
      ...props,
      runtime: ssrRuntime,
      project,
      explorerId: 'metadata',
    };

    const { rerender } = render(<Explorer {...ssrProps} />);
    expect(
      screen.getByText(`Published metadata for ${project} (SSR Metadata)`),
    ).toBeInTheDocument();

    mockRouter.query = { configId: project, explorerId: 'default' };
    rerender(<Explorer {...ssrProps} />);
    expect(mockGetExplorerState).toHaveBeenLastCalledWith(
      { project, explorerId: 'default' },
      { skip: false, refetchOnMountOrArgChange: true },
    );
    expect(screen.queryByText(/SSR Metadata/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading Explorer…');
  });

  it('exposes the preserved Builder link only after explicit opt-in', () => {
    process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = 'true';
    render(<Explorer {...props} />);
    expect(screen.getByRole('tab', { name: 'Builder' })).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/explorers/builder?explorerId=metadata',
    );
  });
});
