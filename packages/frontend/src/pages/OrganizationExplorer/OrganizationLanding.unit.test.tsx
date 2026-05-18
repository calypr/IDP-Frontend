import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import OrganizationLandingPage from './OrganizationLanding';

jest.mock('@gen3/core', () => ({
  SYFON_API: '/data',
  normalizeSyfonResourcePath: (resourcePath: string) => {
    const normalized = resourcePath.replace(/^https?:\/\/[^/]+/i, '');
    const segments = normalized.replace(/^\/+/, '').split('/').filter(Boolean);

    if (segments[0] === 'programs' && segments[1] && segments[2] === 'projects' && segments[3]) {
      return `/organization/${segments[1]}/project/${segments[3]}`;
    }

    if (segments[0] === 'organization' && segments[1] && segments[2] === 'project' && segments[3]) {
      return `/organization/${segments[1]}/project/${segments[3]}`;
    }

    if (segments[0] === 'organization' && segments[1]) {
      return `/organization/${segments[1]}`;
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  },
  useGetAuthzMappingsQuery: jest.fn(),
}));

jest.mock('../../features/Navigation', () => ({
  NavPageLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('../../components/Protected/ProtectedContent', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { useGetAuthzMappingsQuery } = jest.requireMock('@gen3/core') as {
  useGetAuthzMappingsQuery: jest.Mock;
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

describe('OrganizationLandingPage', () => {
  it('renders accessible project links grouped by organization', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/organization/org-b/project/proj-z': ['read'],
        '/organization/org-a': ['read'],
        '/organization/org-a/project/proj-a': ['read'],
      },
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationLandingPage {...layoutProps} />
      </MantineProvider>,
    );

    expect(screen.getByText('org-a')).toBeInTheDocument();
    expect(screen.getAllByText('1 project')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /org-a/i }));

    expect(screen.getByText('proj-a').closest('a')).toHaveAttribute(
      'href',
      '/organization/org-a/project/proj-a',
    );

    fireEvent.click(screen.getByRole('button', { name: /org-b/i }));

    expect(screen.getByText('proj-z').closest('a')).toHaveAttribute(
      'href',
      '/organization/org-b/project/proj-z',
    );
  });

  it('filters to a single organization and opens it by default', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/organization/org-b/project/proj-z': ['read'],
        '/organization/org-a/project/proj-a': ['read'],
      },
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationLandingPage
          {...layoutProps}
          selectedOrganization="org-b"
        />
      </MantineProvider>,
    );

    expect(screen.queryByText('org-a')).not.toBeInTheDocument();
    expect(screen.getAllByText('org-b')).toHaveLength(2);
    expect(screen.getByText('proj-z').closest('a')).toHaveAttribute(
      'href',
      '/organization/org-b/project/proj-z',
    );
  });

  it('shows both organization and project search results from the search bar', () => {
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/organization/alpha-org/project/unrelated': ['read'],
        '/organization/org-b/project/proj-z': ['read'],
        '/organization/org-a/project/proj-alpha': ['read'],
      },
      isLoading: false,
    });

    render(
      <MantineProvider>
        <OrganizationLandingPage {...layoutProps} />
      </MantineProvider>,
    );

    fireEvent.change(
      screen.getByPlaceholderText('Search organizations or projects'),
      { target: { value: 'alp' } },
    );

    expect(screen.getByText('alpha-org')).toBeInTheDocument();
    expect(screen.getByText('proj-alpha')).toBeInTheDocument();
    expect(screen.getByText('proj-alpha').closest('a')).toHaveAttribute(
      'href',
      '/organization/org-a/project/proj-alpha',
    );
    expect(screen.queryByText('proj-z')).not.toBeInTheDocument();
  });
});
