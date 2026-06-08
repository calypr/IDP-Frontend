import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ProjectPresentationPage from '../../pages/org/[org]/project/[project]/presentation';

const useGetGeckoProjectsQueryMock = jest.fn();
const useGetGeckoProjectSummaryQueryMock = jest.fn();

jest.mock('@gen3/core', () => ({
  useGetGeckoProjectsQuery: () => useGetGeckoProjectsQueryMock(),
  useGetGeckoProjectSummaryQuery: () => useGetGeckoProjectSummaryQueryMock(),
}));

jest.mock('@gen3/frontend', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProtectedContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  getNavPageLayoutPropsFromConfig: jest.fn(),
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
    basePage: false,
    rightSection: {
      columns: [],
      basePage: false,
    },
  },
  headerProps: {
    banners: [],
    basePage: false,
    leftnav: [],
    navigation: { items: [] },
    topBar: {
      items: [],
      loginButtonVisibility: undefined,
      onToggle: jest.fn(),
    },
  },
};

describe('ProjectPresentationPage', () => {
  beforeEach(() => {
    useGetGeckoProjectsQueryMock.mockReset();
    useGetGeckoProjectSummaryQueryMock.mockReset();
  });

  it('renders seeded metadata and visualization placeholders', () => {
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
    expect(
      screen.getByText('Visualizations and Data Storytelling'),
    ).toBeInTheDocument();
    expect(screen.getByText('Request Access or Learn More')).toBeInTheDocument();
    expect(screen.getAllByText('summary@example.org').length).toBeGreaterThan(0);
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
    expect(
      screen.getByText(/add a contact email in the editor/i),
    ).toBeInTheDocument();
  });
});
