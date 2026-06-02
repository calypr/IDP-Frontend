import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
  useCreateAuthzOwnedDescendantMutation: jest.fn(),
  useConnectGeckoGitOrganizationMutation: jest.fn(),
  useCreateGeckoProjectMutation: jest.fn(),
  useGetAuthzMappingsQuery: jest.fn(),
  useGetGeckoGitOrganizationsStatusQuery: jest.fn(),
  useGetGeckoProjectsQuery: jest.fn(),
  useLazyGetGeckoGitPendingRepositoriesQuery: jest.fn(),
  useReconcileGeckoGitPendingRepositoriesMutation: jest.fn(),
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

const {
  useCreateAuthzOwnedDescendantMutation,
  useConnectGeckoGitOrganizationMutation,
  useCreateGeckoProjectMutation,
  useGetAuthzMappingsQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectsQuery,
  useLazyGetGeckoGitPendingRepositoriesQuery,
  useReconcileGeckoGitPendingRepositoriesMutation,
  useUpsertSyfonBucketCredentialMutation,
} = jest.requireMock('@gen3/core') as {
  useCreateAuthzOwnedDescendantMutation: jest.Mock;
  useConnectGeckoGitOrganizationMutation: jest.Mock;
  useCreateGeckoProjectMutation: jest.Mock;
  useGetAuthzMappingsQuery: jest.Mock;
  useGetGeckoGitOrganizationsStatusQuery: jest.Mock;
  useGetGeckoProjectsQuery: jest.Mock;
  useLazyGetGeckoGitPendingRepositoriesQuery: jest.Mock;
  useReconcileGeckoGitPendingRepositoriesMutation: jest.Mock;
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
    useConnectGeckoGitOrganizationMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
    useCreateAuthzOwnedDescendantMutation.mockReturnValue([
      jest.fn(),
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
    useGetAuthzMappingsQuery.mockReturnValue({ data: {} });
    useLazyGetGeckoGitPendingRepositoriesQuery.mockReturnValue([
      jest.fn().mockResolvedValue({}),
      { data: undefined, isLoading: false },
    ]);
    useReconcileGeckoGitPendingRepositoriesMutation.mockReturnValue([
      jest.fn(() => ({
        unwrap: jest.fn().mockResolvedValue({ pending: [] }),
      })),
      { isLoading: false },
    ]);
    useUpsertSyfonBucketCredentialMutation.mockReturnValue([
      jest.fn(),
      { isLoading: false },
    ]);
  });

  it('renders Gecko projects grouped by organization', () => {
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [
        { resourcePath: '/programs/org-b/projects/proj-z' },
        { resourcePath: '/programs/org-a/projects/proj-a' },
      ],
      isLoading: false,
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

    expect(
      screen.getByRole('button', { name: /connect github app/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/0 of 2 tracked repos configured/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText('org-a').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /org-a/i }));

    expect(screen.getByText('proj-a').closest('a')).toHaveAttribute(
      'href',
      '/git/org-a/project/proj-a',
    );
  });

  it('filters to a single organization and searches project names', () => {
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [
        { resourcePath: '/programs/org-b/projects/proj-z' },
        { resourcePath: '/programs/org-a/projects/proj-alpha' },
      ],
      isLoading: false,
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
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/org-a': [{ method: 'manage-owners', service: 'arborist' }],
      },
    });
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [{ resourcePath: '/programs/org-a/projects/proj-alpha' }],
      isLoading: false,
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

  it('shows a new project action on a scoped organization page', () => {
    useGetGeckoProjectsQuery.mockReturnValue({
      data: [{ resourcePath: '/programs/org-a/projects/proj-alpha' }],
      isLoading: false,
      refetch: jest.fn(),
    });
    render(
      <MantineProvider>
        <GitLandingPage {...layoutProps} selectedOrganization="org-a" />
      </MantineProvider>,
    );

    expect(
      screen.getByRole('button', { name: /new project/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/github app installed/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /configure github/i }),
    ).not.toBeInTheDocument();
  });
});
