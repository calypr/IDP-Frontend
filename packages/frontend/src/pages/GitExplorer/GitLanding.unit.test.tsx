import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import GitLandingPage from './GitLanding';

jest.mock('next/router', () => ({
  useRouter: () => ({
    query: {},
    reload: jest.fn(),
  }),
}));

jest.mock('@gen3/core', () => ({
  normalizeSyfonResourcePath: (resourcePath: string) => {
    const normalized = resourcePath.replace(/^https?:\/\/[^/]+/i, '');
    const segments = normalized.replace(/^\/+/, '').split('/').filter(Boolean);

    if (
      segments[0] === 'programs' &&
      segments[1] &&
      segments[2] === 'projects' &&
      segments[3]
    ) {
      return `/programs/${segments[1]}/projects/${segments[3]}`;
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  },
  useCreateGeckoProjectMutation: jest.fn(),
  useConnectGeckoGitOrganizationMutation: jest.fn(),
  useGetAuthzMappingsQuery: jest.fn(),
  useGetGeckoGitOrganizationsStatusQuery: jest.fn(),
  useGetGeckoProjectsQuery: jest.fn(),
  useInitConnectGeckoGitOrganizationMutation: jest.fn(),
  useReconcileGeckoGitOrganizationMutation: jest.fn(),
  useReconcileGeckoGitOrganizationsMutation: jest.fn(),
  useUpdateGeckoProjectStorageMutation: jest.fn(),
  useUpsertSyfonBucketCredentialMutation: jest.fn(),
}));

jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../lib/session/session', () => ({
  useSession: () => ({ user: { is_admin: false } }),
}));

const {
  useCreateGeckoProjectMutation,
  useConnectGeckoGitOrganizationMutation,
  useGetAuthzMappingsQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectsQuery,
  useInitConnectGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationMutation,
  useReconcileGeckoGitOrganizationsMutation,
  useUpdateGeckoProjectStorageMutation,
  useUpsertSyfonBucketCredentialMutation,
} = jest.requireMock('@gen3/core') as {
  useCreateGeckoProjectMutation: jest.Mock;
  useConnectGeckoGitOrganizationMutation: jest.Mock;
  useGetAuthzMappingsQuery: jest.Mock;
  useGetGeckoGitOrganizationsStatusQuery: jest.Mock;
  useGetGeckoProjectsQuery: jest.Mock;
  useInitConnectGeckoGitOrganizationMutation: jest.Mock;
  useReconcileGeckoGitOrganizationMutation: jest.Mock;
  useReconcileGeckoGitOrganizationsMutation: jest.Mock;
  useUpdateGeckoProjectStorageMutation: jest.Mock;
  useUpsertSyfonBucketCredentialMutation: jest.Mock;
};

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
  headerMetadata: {
    content: 'test',
    key: 'test',
    title: 'test',
  },
};

describe('GitLandingPage', () => {
  beforeEach(() => {
    useInitConnectGeckoGitOrganizationMutation.mockReturnValue([
      jest.fn(() => ({
        unwrap: jest.fn().mockResolvedValue({ redirect_url: '/git' }),
      })),
      { isLoading: false },
    ]);
    useGetGeckoGitOrganizationsStatusQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      refetch: jest.fn(),
    });
    useCreateGeckoProjectMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
    useConnectGeckoGitOrganizationMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
    useGetAuthzMappingsQuery.mockReturnValue({ data: {}, refetch: jest.fn() });
    useReconcileGeckoGitOrganizationsMutation.mockReturnValue([
      jest.fn(() => ({
        unwrap: jest.fn().mockResolvedValue({ organizations: [] }),
      })),
      { isLoading: false },
    ]);
    useReconcileGeckoGitOrganizationMutation.mockReturnValue([
      jest.fn(() => ({
        unwrap: jest.fn().mockResolvedValue({ organization: 'org-a' }),
      })),
      { isLoading: false },
    ]);
    useUpdateGeckoProjectStorageMutation.mockReturnValue([
      jest.fn(() => ({
        unwrap: jest.fn().mockResolvedValue({ success: true }),
      })),
      { isLoading: false },
    ]);
    useUpsertSyfonBucketCredentialMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
  });

  it('renders Gecko projects grouped by organization', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/org-a/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
        '/programs/org-b/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
      },
      refetch: jest.fn(),
    });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [
        { resourcePath: '/programs/org-b/projects/proj-z' },
        { resourcePath: '/programs/org-a/projects/proj-a' },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    useGetGeckoGitOrganizationsStatusQuery.mockReturnValue({
      data: {
        connected: false,
        app_installed: false,
        connected_organizations: 0,
        installed_organizations: 0,
        total_organizations: 2,
        connected_projects: 0,
        configured_projects: 0,
        total_projects: 2,
        configuration_state: 'not_connected',
        organizations: [],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getAllByText('org-a').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /org-a/i }));

    expect(screen.getByText('proj-a').closest('a')).toHaveAttribute(
      'href',
      '/git/org-a/project/proj-a',
    );
  });

  it('filters to a single organization and searches project names', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/org-a/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
      },
      refetch: jest.fn(),
    });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [
        { resourcePath: '/programs/org-b/projects/proj-z' },
        { resourcePath: '/programs/org-a/projects/proj-alpha' },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} selectedOrganization="org-a" />
      </MantineProvider>,
    );

    expect(screen.queryByText('org-b')).not.toBeInTheDocument();
    expect(screen.getByText('proj-alpha')).toBeInTheDocument();

    fireEvent.change(
      screen.getByPlaceholderText('Search organizations or projects'),
      { target: { value: 'alpha' } },
    );

    expect(screen.getByText('proj-alpha').closest('a')).toHaveAttribute(
      'href',
      '/git/org-a/project/proj-alpha',
    );
  });

  it('shows organization settings for manageable organizations', () => {
    useGetAuthzMappingsQuery.mockReturnValue({ data: {}, refetch: jest.fn() });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [{ resourcePath: '/programs/org-a/projects/proj-alpha' }],
      isLoading: false,
      refetch: jest.fn(),
    });
    useGetGeckoGitOrganizationsStatusQuery.mockReturnValue({
      data: {
        organizations: [
          {
            organization: 'org-a',
            can_access_settings: true,
            can_create_projects: false,
            projects: [],
          },
        ],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute(
      'href',
      '/git/org-a/settings',
    );
  });

  it('renders an organization card from org membership without org settings access', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/Ellrott_Lab/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
      },
      refetch: jest.fn(),
    });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [],
      isLoading: false,
      refetch: jest.fn(),
    });
    useGetGeckoGitOrganizationsStatusQuery.mockReturnValue({
      data: {
        organizations: [
          {
            organization: 'Ellrott_Lab',
            can_access_settings: false,
            can_create_projects: true,
            projects: [],
          },
        ],
      },
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Ellrott_Lab/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /You can create projects in this organization, but no project-level access is currently visible here./i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /settings/i }),
    ).not.toBeInTheDocument();
  });

  it('renders organization cards for project-level permissions if project exists in gecko projects list', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/aced/projects/not-visible': [
          { method: 'manage-owners', service: 'arborist' },
        ],
        '/programs/Ellrott_Lab/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
      },
      refetch: jest.fn(),
    });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [
        { resourcePath: '/programs/aced/projects/not-visible' },
        { resourcePath: '/programs/Ellrott_Lab/projects/visible-project' },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });

    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(
      screen.getByRole('button', { name: /Ellrott_Lab/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aced/i })).toBeInTheDocument();
  });

  it('hides global GitHub actions on a scoped organization page', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/org-a/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
      },
      refetch: jest.fn(),
    });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [
        {
          resourcePath: '/programs/org-a/projects/proj-alpha',
          configData: {
            src_repo: 'github.com/existing/current_repo',
          },
        },
      ],
      isLoading: false,
      refetch: jest.fn(),
    });
    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} selectedOrganization="org-a" />
      </MantineProvider>,
    );

    expect(screen.queryByText(/github app installed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /configure github/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /github connections/i }),
    ).not.toBeInTheDocument();
  });
});
