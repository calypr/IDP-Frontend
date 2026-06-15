import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ProjectPresentationEditPage } from '../../pages/ProjectPresentation/ProjectPresentationEdit';

const useGetGeckoProjectsQueryMock = jest.fn();
const useGetGeckoProjectSummaryQueryMock = jest.fn();
const useGetGeckoGitProjectPresentationConfigQueryMock = jest.fn();
const useGetAuthzMappingsQueryMock = jest.fn();
const useGetGeckoGitOrganizationsStatusQueryMock = jest.fn();
const useUpdateGeckoGitProjectPresentationConfigMutationMock = jest.fn();

jest.mock('@gen3/core', () => ({
  useGetAuthzMappingsQuery: () => useGetAuthzMappingsQueryMock(),
  useGetGeckoGitOrganizationsStatusQuery: () =>
    useGetGeckoGitOrganizationsStatusQueryMock(),
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
    title: 'Test Editor',
    content: 'Test Editor',
    key: 'test-editor',
  },
};

describe('ProjectPresentationEditPage', () => {
  beforeEach(() => {
    useGetAuthzMappingsQueryMock.mockReset();
    useGetGeckoGitOrganizationsStatusQueryMock.mockReset();
    useGetGeckoProjectsQueryMock.mockReset();
    useGetGeckoProjectSummaryQueryMock.mockReset();
    useGetGeckoGitProjectPresentationConfigQueryMock.mockReset();
    useUpdateGeckoGitProjectPresentationConfigMutationMock.mockReset();
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
    useGetGeckoGitOrganizationsStatusQueryMock.mockReturnValue({
      data: { organizations: [] },
      isLoading: false,
    });

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

  it('blocks users without org membership, project membership, or write access', () => {
    useGetAuthzMappingsQueryMock.mockReturnValue({
      data: {},
      isLoading: false,
    });
    useGetGeckoGitOrganizationsStatusQueryMock.mockReturnValue({
      data: {
        organizations: [
          {
            organization: 'HTAN_INT',
            projects: [
              {
                can_manage_settings: false,
                project: 'BForePC',
              },
            ],
          },
        ],
      },
      isLoading: false,
    });

    render(
      <MantineProvider>
        <ProjectPresentationEditPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.getByText(
        /you must be a member of this organization or project, or have write access/i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Hero title')).not.toBeInTheDocument();
  });
});
