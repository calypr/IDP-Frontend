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
        readonly selector: { readonly recipe: string; readonly output: string };
      }>;
    };
  };
  readonly error?: unknown;
  readonly isFetching?: boolean;
  readonly isLoading?: boolean;
  readonly isUninitialized?: boolean;
};

let mockEmbedded = false;
let mockViewerProps: { activeTab?: string | null } = {};
let mockViewSettings: { currentData: { canEdit: boolean; settings: { defaultConfigId: string; defaultFrameId: string }; configs?: Array<{ revisionId?: string; config: { id: string; title: string } }> } } = {
  currentData: {
    canEdit: false,
    settings: { defaultConfigId: '', defaultFrameId: '' },
  },
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
        outputs: [
          {
            outputId: 'Specimen',
            title: `${args.explorerId} view`,
            selector: { recipe: 'metadata', output: 'Specimen' },
          },
        ],
      },
    },
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

}));
jest.mock('@gen3/frontend', () => ({
  selectedProjectViewId: (explicitId?: string, defaultId?: string) =>
    explicitId || defaultId || 'default',
  selectedProjectViewTab: (
    runtime: { outputs: ReadonlyArray<{ title: string; selector: { recipe: string; output: string } }> } | null,
    frameId?: string,
  ) => frameId
    ? runtime?.outputs.find((output) => `${output.selector.recipe}/${output.selector.output}` === frameId)?.title ?? null
    : runtime?.outputs[0]?.title ?? null,
  useProjectViewTab: (
    runtime: { outputs: ReadonlyArray<{ title: string; selector: { recipe: string; output: string } }> } | null,
    frameId: string | undefined,
  ) => {
    const activeTab = frameId
      ? runtime?.outputs.find((output) => `${output.selector.recipe}/${output.selector.output}` === frameId)?.title ?? null
      : runtime?.outputs[0]?.title ?? null;
    return {
      activeTab,
      selectTab: jest.fn(),
      unavailableDefault: Boolean(frameId && runtime && activeTab === null),
    };
  },
  useGetProjectViewBuilderQuery: () => mockViewSettings,
  ProjectConfigurationSelect: ({
    value,
    options,
    onChange,
  }: {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: React.ChangeEventHandler<HTMLSelectElement>;
  }) => (
    <select
      aria-label="Project configuration"
      value={value}
      onChange={onChange}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  ExplorerMainContent: ({
    project,
    runtime,
    activeTab,
    toolbarCenter,
  }: {
    activeTab?: string | null;
    toolbarCenter?: React.ReactNode;
    project: string;
    runtime: { outputs: ReadonlyArray<{ title: string }> };
  }) => {
    mockViewerProps = { activeTab };
    return (
      <div>
        {toolbarCenter}
        Published metadata for {project} ({runtime.outputs[0]?.title})
      </div>
    );
  },
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
  useIsEmbedded: () => mockEmbedded,
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
  beforeEach(() => {
    mockEmbedded = false;
    mockViewerProps = {};
    mockViewSettings = {
      currentData: {
        canEdit: false,
        settings: { defaultConfigId: '', defaultFrameId: '' },
        configs: publishedConfigs.map(({ explorerId, title, activeRevisionId }) => ({
          config: { id: explorerId, title },
          revisionId: activeRevisionId,
        })),
      },
    };
    mockRouter.pathname = '/Explorer/[configId]';
    mockRouter.query = {
      configId: project,
      explorerId: 'metadata',
      tab: 'overview',
      facets: ['active', 'recent'],
    };
    mockRouter.replace.mockReset();
    mockGetExplorerState.mockReset();
    mockGetExplorerState.mockImplementation((args: ViewerStateArgs) => ({
      currentData: {
        project: args.project,
        runtime: {
          outputs: [
            {
              outputId: 'Specimen',
              title: `${args.explorerId} view`,
              selector: { recipe: 'metadata', output: 'Specimen' },
            },
          ],
        },
      },
    }));
  });


  it('selects an active project config and requests its Viewer state', () => {
    const { rerender } = render(<Explorer {...props} />);
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

  it('hides the config picker unless at least two configs are published', () => {
    mockViewSettings.currentData.configs![1].revisionId = undefined;
    render(<Explorer {...props} />);
    expect(
      screen.queryByRole('combobox', { name: 'Project configuration' }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'metadata view' }),
    ).toBeInTheDocument();
  });

  it('keeps the valid default Viewer when the config list fails or the query id is absent', () => {
    mockRouter.query = { configId: project, tab: 'overview' };
    mockViewSettings.currentData.configs = undefined;
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

  it('opens the project-selected view and offers only the presentation builder', () => {
    mockRouter.query = { configId: project };
    mockViewSettings = {
      currentData: {
        canEdit: true,
        settings: {
          defaultConfigId: 'files',
          defaultFrameId: 'metadata/Specimen',
        },
      },
    };
    render(<Explorer {...props} />);
    expect(mockGetExplorerState).toHaveBeenLastCalledWith(
      { project, explorerId: 'files' },
      { skip: false, refetchOnMountOrArgChange: true },
    );
    expect(mockViewerProps.activeTab).toBe('files view');
    expect(screen.getByRole('tab', { name: 'View Builder' })).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/explorers/views?explorerId=files',
    );
  });

  it('keeps an unavailable default unselected and visible as a warning when embedded', () => {
    mockRouter.query = { configId: project };
    mockEmbedded = true;
    mockViewSettings = {
      currentData: {
        canEdit: false,
        settings: {
          defaultConfigId: 'files',
          defaultFrameId: 'metadata/Removed',
        },
      },
    };
    mockGetExplorerState.mockReturnValueOnce({
      currentData: {
        project,
        runtime: {
          outputs: [
            {
              outputId: 'Specimen',
              title: 'Other table',
              selector: { recipe: 'metadata', output: 'Specimen' },
            },
          ],
        },
      },
    });
    render(<Explorer {...props} />);
    expect(mockViewerProps.activeTab).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'saved default table needs updating',
    );
  });

  it('links to Dataframe Builder without deployment configuration', () => {
    render(<Explorer {...props} />);
    expect(screen.getByRole('tab', { name: 'Dataframe Builder' })).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/explorers/builder?explorerId=metadata',
    );
  });
});
