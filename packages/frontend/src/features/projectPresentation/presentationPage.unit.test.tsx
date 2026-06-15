import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ProjectPresentationPage } from '../../pages/ProjectPresentation/ProjectPresentation';

const useGetGeckoProjectsQueryMock = jest.fn();
const useGetGeckoProjectSummaryQueryMock = jest.fn();
const useGetConfigContentQueryMock = jest.fn();
const useGetAuthzMappingsQueryMock = jest.fn();
const useGetGeckoGitProjectPresentationConfigQueryMock = jest.fn();

jest.mock('@gen3/core', () => ({
  useGetAuthzMappingsQuery: () => useGetAuthzMappingsQueryMock(),
  useGetGeckoProjectsQuery: () => useGetGeckoProjectsQueryMock(),
  useGetGeckoProjectSummaryQuery: () => useGetGeckoProjectSummaryQueryMock(),
  useGetConfigContentQuery: () => useGetConfigContentQueryMock(),
  useGetGeckoGitProjectPresentationConfigQuery: () =>
    useGetGeckoGitProjectPresentationConfigQueryMock(),
}));

jest.mock('@gen3/frontend', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProjectWorkspaceTabs: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  ProtectedContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getNavPageLayoutPropsFromConfig: jest.fn(),
}));

const useSessionMock = jest.fn();

jest.mock('../../lib/session/session', () => ({
  useSession: () => useSessionMock(),
}));

const routerQuery = {
  org: 'HTAN_INT',
  project: 'BForePC',
};

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: routerQuery,
  }),
}));

const layoutProps = {
  footerProps: {
    basePage: false as const,
    rightSection: {
      columns: [],
      basePage: false as const,
    },
  },
  headerProps: {
    banners: [],
    basePage: false as const,
    leftnav: [],
    navigation: { items: [] },
    topBar: {
      items: [],
      loginButtonVisibility: undefined,
      onToggle: jest.fn(),
    },
  },
  headerMetadata: {
    title: 'Test Presentation',
    content: 'Test Presentation',
    key: 'test-presentation',
  },
};

describe('ProjectPresentationPage', () => {
  beforeEach(() => {
    useGetAuthzMappingsQueryMock.mockReset();
    useGetGeckoProjectsQueryMock.mockReset();
    useGetGeckoProjectSummaryQueryMock.mockReset();
    useGetConfigContentQueryMock.mockReset();
    useGetGeckoGitProjectPresentationConfigQueryMock.mockReset();
    useSessionMock.mockReset();

    useSessionMock.mockReturnValue({
      pending: false,
      status: 'issued',
      user: undefined,
    });
    useGetAuthzMappingsQueryMock.mockReturnValue({
      data: {
        '/programs/HTAN_INT/projects/BForePC': [
          { method: 'read', service: 'arborist' },
        ],
      },
      isLoading: false,
    });

    useGetConfigContentQueryMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    useGetGeckoGitProjectPresentationConfigQueryMock.mockReturnValue({
      data: { presentationConfig: '' },
      isLoading: false,
    });
  });

  it('renders seeded metadata and the simplified home page shell', () => {
    useGetGeckoProjectsQueryMock.mockReturnValue({
      data: [
        {
          configData: {
            contact_email: 'config@example.org',
            description: 'Config description',
            org_title: 'HTAN',
            project_title: 'Project config title',
            src_repo: 'https://example.org/repo.git',
            title: 'Config title',
          },
          organization: 'HTAN_INT',
          project: 'BForePC',
          resourcePath: '/programs/HTAN_INT/projects/BForePC',
          thumbnail_url: 'https://example.org/thumb.png',
        },
      ],
      isLoading: false,
    });
    useGetGeckoProjectSummaryQueryMock.mockReturnValue({
      data: [
        {
          contact_email: 'summary@example.org',
          description: 'Summary description',
          organization: 'HTAN_INT',
          project: 'BForePC',
          thumbnail_url: 'https://example.org/thumb.png',
          title: 'Summary title',
        },
      ],
      isLoading: false,
    });

    render(
      <MantineProvider>
        <ProjectPresentationPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getByText('Summary title')).toBeInTheDocument();
    expect(screen.getByText('Summary description')).toBeInTheDocument();
    expect(screen.getByText('Home')).toBeInTheDocument();
  });

  it('renders fallback copy when project metadata is missing', () => {
    useGetGeckoProjectsQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useGetGeckoProjectSummaryQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <MantineProvider>
        <ProjectPresentationPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getAllByText('BForePC').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/project presentation workspace/i),
    ).toBeInTheDocument();
  });

  it('skips project-scoped explorer and presentation fetches when authz suggests they will 403', () => {
    useGetAuthzMappingsQueryMock.mockReturnValue({
      data: {},
      isLoading: false,
    });
    useGetGeckoProjectsQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
    });
    useGetGeckoProjectSummaryQueryMock.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(
      <MantineProvider>
        <ProjectPresentationPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(useGetConfigContentQueryMock).toHaveBeenCalledWith(
      'HTAN_INT-BForePC',
      expect.objectContaining({ skip: true }),
    );
    expect(
      useGetGeckoGitProjectPresentationConfigQueryMock,
    ).toHaveBeenCalledWith(
      { organization: 'HTAN_INT', project: 'BForePC' },
      expect.objectContaining({ skip: true }),
    );
  });

});
