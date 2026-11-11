import React from 'react';
import { render, screen } from '@testing-library/react';
import Explorer from '../pages/Explorer/[configId]';

jest.mock('next/router', () => ({
  useRouter: () => ({ query: { configId: 'HTAN_INT/BForePC' } }),
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
  useGetExplorerStateV1Query: () => ({
    data: {
      project: 'HTAN_INT/BForePC',
      runtime: { outputs: [{ outputId: 'Specimen', title: 'Specimens' }] },
    },
  }),
}));
jest.mock('@gen3/frontend', () => ({
  isExplorerBuilderEnabled: () =>
    process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED === 'true',
  ExplorerMainContent: ({ project }: { project: string }) => (
    <div>Published metadata for {project}</div>
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
  sharedFiltersMap: null,
};

describe('published Explorer route', () => {
  const original = process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
  afterEach(() => {
    if (original === undefined)
      delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    else process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = original;
  });
  it('renders client-loaded published metadata without exposing Builder by default', () => {
    delete process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED;
    render(<Explorer {...props} />);
    expect(
      screen.getByText('Published metadata for HTAN_INT/BForePC'),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Specimens' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Builder' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tab', { name: 'Builder' }),
    ).not.toBeInTheDocument();
  });
  it('exposes the preserved Builder link only after explicit opt-in', () => {
    process.env.NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED = 'true';
    render(<Explorer {...props} />);
    expect(screen.getByRole('tab', { name: 'Builder' })).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/explorers/builder?explorerId=default',
    );
  });
});
