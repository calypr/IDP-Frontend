import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ProjectEditPage from '../../pages/org/[org]/project/[project]/edit';

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

describe('ProjectEditPage', () => {
  beforeEach(() => {
    useGetGeckoProjectsQueryMock.mockReset();
    useGetGeckoProjectSummaryQueryMock.mockReset();

    useGetGeckoProjectsQueryMock.mockReturnValue({
      data: [
        {
          configData: {
            contact_email: 'config@example.org',
            description: 'Config description',
            org_title: 'HTAN',
            project_title: 'Config title',
            src_repo: 'https://example.org/repo.git',
            title: 'Config title',
          },
          organization: 'HTAN_INT',
          project: 'BForePC',
          resourcePath: '/programs/HTAN_INT/projects/BForePC',
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
          title: 'Summary title',
        },
      ],
      isLoading: false,
    });
  });

  it('renders fixed editor fields and updates preview content', () => {
    render(
      <MantineProvider>
        <ProjectEditPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getByLabelText('Hero title')).toBeInTheDocument();
    expect(screen.getByLabelText('Overview body')).toBeInTheDocument();
    expect(screen.getByLabelText('CTA title')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Hero title'), {
      target: { value: 'Analyst Authored Title' },
    });

    expect(screen.getAllByText('Analyst Authored Title').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /add highlight/i }));
    const newHighlight = screen.getByLabelText('Highlight 4');
    fireEvent.change(newHighlight, {
      target: { value: 'Fresh funding narrative' },
    });
    expect(screen.getByDisplayValue('Fresh funding narrative')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Remove highlight 4'));
    expect(
      screen.queryByDisplayValue('Fresh funding narrative'),
    ).not.toBeInTheDocument();
  });

  it('supports editing visualization placeholders and shows route-backed preview link', () => {
    render(
      <MantineProvider>
        <ProjectEditPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.change(screen.getAllByLabelText('Title')[0], {
      target: { value: 'Cohort Overview Figure' },
    });
    fireEvent.change(screen.getAllByLabelText('Supporting link')[0], {
      target: { value: 'https://example.org/figure' },
    });

    expect(screen.getAllByText('Cohort Overview Figure').length).toBeGreaterThan(0);
    expect(
      screen.getByRole('link', { name: /open route-backed presentation page/i }),
    ).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/presentation',
    );
  });
});
