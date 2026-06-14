import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ProjectPresentationEditPage } from '../../pages/ProjectPresentation/ProjectPresentationEdit';

const useGetGeckoProjectsQueryMock = jest.fn();
const useGetGeckoProjectSummaryQueryMock = jest.fn();
const useGetGeckoGitProjectPresentationConfigQueryMock = jest.fn();
const useUpdateGeckoGitProjectPresentationConfigMutationMock = jest.fn();

jest.mock('@gen3/core', () => ({
  useGetGeckoProjectsQuery: () => useGetGeckoProjectsQueryMock(),
  useGetGeckoProjectSummaryQuery: () => useGetGeckoProjectSummaryQueryMock(),
  useGetGeckoGitProjectPresentationConfigQuery: () =>
    useGetGeckoGitProjectPresentationConfigQueryMock(),
  useUpdateGeckoGitProjectPresentationConfigMutation: () => [
    useUpdateGeckoGitProjectPresentationConfigMutationMock,
    { isLoading: false },
  ],
}));

jest.mock('@gen3/frontend', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProjectWorkspaceTabs: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
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
    title: 'Test Editor',
    content: 'Test Editor',
    key: 'test-editor',
  },
};

describe('ProjectPresentationEditPage', () => {
  beforeEach(() => {
    useGetGeckoProjectsQueryMock.mockReset();
    useGetGeckoProjectSummaryQueryMock.mockReset();
    useGetGeckoGitProjectPresentationConfigQueryMock.mockReset();
    useUpdateGeckoGitProjectPresentationConfigMutationMock.mockReset();

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
    useGetGeckoGitProjectPresentationConfigQueryMock.mockReturnValue({
      data: { presentationConfig: '' },
      isLoading: false,
    });
    useUpdateGeckoGitProjectPresentationConfigMutationMock.mockReturnValue({
      unwrap: async () => ({
        presentationConfig: '<section><p>saved</p></section>',
      }),
    });
  });

  it('renders simplified top-section fields and updates preview content', () => {
    render(
      <MantineProvider>
        <ProjectPresentationEditPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getByLabelText('Hero title')).toBeInTheDocument();
    expect(screen.getByLabelText('Hero summary')).toBeInTheDocument();
    expect(screen.getByLabelText('Thumbnail URL')).toBeInTheDocument();
    expect(screen.getByLabelText('HTML content')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Hero title'), {
      target: { value: 'Analyst Authored Title' },
    });

    expect(screen.getByDisplayValue('Analyst Authored Title')).toBeInTheDocument();
  });

  it('supports editing freeform html and shows the route-backed preview link', () => {
    render(
      <MantineProvider>
        <ProjectPresentationEditPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('HTML content'), {
      target: { value: '<section><h2>Methods</h2><p>Study details</p></section>' },
    });

    expect(
      screen.getByRole('link', { name: /open route-backed presentation page/i }),
    ).toHaveAttribute(
      'href',
      '/org/HTAN_INT/project/BForePC/presentation',
    );
  });

  it('saves the freeform html via the presentation config route', async () => {
    render(
      <MantineProvider>
        <ProjectPresentationEditPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText('HTML content'), {
      target: { value: '<section><p>saved</p></section>' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(useUpdateGeckoGitProjectPresentationConfigMutationMock).toHaveBeenCalledWith({
        organization: 'HTAN_INT',
        project: 'BForePC',
        presentationConfig: '<section><p>saved</p></section>',
      });
    });
  });
});
