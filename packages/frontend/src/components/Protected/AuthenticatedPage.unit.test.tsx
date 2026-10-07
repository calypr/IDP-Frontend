import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AuthenticatedPage } from './AuthenticatedPage';
import { useInitialPageReady } from './InitialPageReady';

const replace = jest.fn().mockResolvedValue(true);
const router = {
  pathname: '/git',
  asPath: '/git?tab=mine',
  isReady: true,
  query: { org: 'alpha', project: 'secret' } as Record<string, string>,
  replace,
};
const useSession = jest.fn();
const hasFenceAccess = jest.fn();
const useGetAuthzMappingsQuery = jest.fn();
const useGetGeckoProjectsQuery = jest.fn();
const useGetGeckoProjectSummaryQuery = jest.fn();

const page = (content: string) => (
  <MantineProvider>
    <AuthenticatedPage>{content}</AuthenticatedPage>
  </MantineProvider>
);

jest.mock('@gen3/core', () => ({
  useGetAuthzMappingsQuery: () => useGetAuthzMappingsQuery(),
  useGetGeckoProjectsQuery: () => useGetGeckoProjectsQuery(),
  useGetGeckoProjectSummaryQuery: () => useGetGeckoProjectSummaryQuery(),
}));
jest.mock('../Modals/LoginModal', () => ({
  LoginView: () => <div>Login prompt</div>,
}));
jest.mock('./NoAccessOverlay', () => ({
  hasFenceAccess: () => hasFenceAccess(),
  NoAccessOverlay: () => <div>No project access</div>,
}));
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('../../lib/session/session', () => ({
  useSession: () => useSession(),
}));
jest.mock('./VerifyingAccessLoader', () => ({
  VerifyingAccessLoader: ({
    message = 'Verifying account access',
  }: {
    message?: string;
  }) => <div>{message}</div>,
}));

describe('AuthenticatedPage', () => {
  beforeEach(() => {
    replace.mockClear();
    useGetAuthzMappingsQuery.mockClear();
    useGetGeckoProjectsQuery.mockClear();
    useGetGeckoProjectSummaryQuery.mockClear();
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {},
      isLoading: false,
      isError: false,
    });
    useGetGeckoProjectsQuery.mockReturnValue({ isLoading: false });
    useGetGeckoProjectSummaryQuery.mockReturnValue({ isLoading: false });
    hasFenceAccess.mockReturnValue(true);
    router.pathname = '/git';
    router.asPath = '/git?tab=mine';
    router.isReady = true;
    router.query = { org: 'alpha', project: 'secret' };
  });

  it('never mounts a protected page for a logged-out visitor and returns to home', () => {
    useSession.mockReturnValue({ status: 'not present', pending: true });
    const view = render(page('Private page'));
    expect(screen.queryByText('Private page')).toBeNull();
    expect(screen.queryByText('Verifying account access')).toBeNull();
    expect(replace).not.toHaveBeenCalled();

    useSession.mockReturnValue({ status: 'invalid', pending: false });
    view.rerender(page('Private page'));
    expect(screen.queryByText('Private page')).toBeNull();
    expect(screen.queryByText('Verifying account access')).toBeNull();
    expect(replace).toHaveBeenCalledWith({
      pathname: '/',
      query: { referer: '/git?tab=mine' },
    });
  });

  it('mounts protected pages only for an issued session', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    render(page('Private page'));
    expect(screen.getByText('Private page')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows one access loader while the signed-in access mapping loads', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    render(page('Private page'));
    expect(screen.queryByText('Private page')).toBeNull();
    expect(screen.getByText('Verifying account access')).toBeVisible();
  });

  it('does not mount any page for an issued session without project access', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    hasFenceAccess.mockReturnValue(false);
    render(page('Private page'));
    expect(screen.queryByText('Private page')).toBeNull();
    expect(screen.getByText('No project access')).toBeVisible();
  });

  it('opens Profile for a signed-in user without requiring project access', () => {
    router.pathname = '/Profile';
    router.asPath = '/Profile';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    hasFenceAccess.mockReturnValue(false);
    render(page('Profile content'));
    expect(screen.getByText('Profile content')).toBeVisible();
  });

  it('keeps one loader through a Query page initial load', () => {
    router.pathname = '/Query';
    router.asPath = '/Query';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    const QueryContent = ({ ready }: { ready: boolean }) => {
      useInitialPageReady(ready);
      return <div>Query editor</div>;
    };
    const renderQuery = (ready: boolean) => (
      <MantineProvider>
        <AuthenticatedPage>
          <QueryContent ready={ready} />
        </AuthenticatedPage>
      </MantineProvider>
    );

    const view = render(renderQuery(false));
    expect(screen.getByText('Loading query editor...')).toBeVisible();
    expect(screen.getByText('Query editor')).not.toBeVisible();
    view.rerender(renderQuery(true));
    expect(screen.queryByText('Loading query editor...')).toBeNull();
    expect(screen.getByText('Query editor')).toBeVisible();
  });

  it('keeps the same loader mounted from session verification through page loading', () => {
    router.pathname = '/Query';
    router.asPath = '/Query';
    useSession.mockReturnValue({ status: 'issued', pending: true });
    const view = render(page('Query editor'));
    const loader = screen.getByText('Loading query editor...');

    useSession.mockReturnValue({ status: 'issued', pending: false });
    view.rerender(page('Query editor'));
    expect(screen.getByText('Loading query editor...')).toBe(loader);
  });

  it('releases the page loader when access is denied', () => {
    router.pathname = '/Query';
    router.asPath = '/Query';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    hasFenceAccess.mockReturnValue(false);
    render(page('Query editor'));
    expect(screen.queryByText('Loading query editor...')).toBeNull();
    expect(screen.getByText('No project access')).toBeVisible();
    expect(screen.queryByText('Query editor')).toBeNull();
  });

  it('does not show the page loader to a logged-out Query visitor', () => {
    router.pathname = '/Query';
    router.asPath = '/Query';
    useSession.mockReturnValue({ status: 'invalid', pending: false });
    render(page('Query editor'));
    expect(screen.queryByText('Loading query editor...')).toBeNull();
    expect(screen.queryByText('Query editor')).toBeNull();
    expect(replace).toHaveBeenCalledWith({
      pathname: '/',
      query: { referer: '/Query' },
    });
  });

  it.each<{
    pathname: string;
    asPath: string;
    query: Record<string, string>;
    message: string;
  }>([
    {
      pathname: '/app/[appName]',
      asPath: '/app/CohortDiscovery',
      query: { appName: 'CohortDiscovery' },
      message: 'Loading cohort discovery...',
    },
  ])(
    'holds one loader for $asPath until the page is ready',
    ({ pathname, asPath, query, message }) => {
      router.pathname = pathname;
      router.asPath = asPath;
      router.query = query;
      useSession.mockReturnValue({ status: 'issued', pending: false });
      useGetAuthzMappingsQuery.mockReturnValue({
        data: {
          '/programs/alpha/projects/secret': [
            { method: 'read', service: 'arborist' },
          ],
        },
        isLoading: false,
        isError: false,
      });
      const Content = ({ ready }: { ready: boolean }) => {
        useInitialPageReady(ready);
        return <div>Page content</div>;
      };
      const renderPage = (ready: boolean) => (
        <MantineProvider>
          <AuthenticatedPage>
            <Content ready={ready} />
          </AuthenticatedPage>
        </MantineProvider>
      );
      const view = render(renderPage(false));
      expect(screen.getByText(message)).toBeVisible();
      expect(screen.getByText('Page content')).not.toBeVisible();
      view.rerender(renderPage(true));
      expect(screen.queryByText(message)).toBeNull();
      expect(screen.getByText('Page content')).toBeVisible();
    },
  );

  it('mounts the project Home frame while its data is loading', () => {
    router.pathname = '/org/[org]/project/[project]/presentation';
    router.asPath = '/org/alpha/project/secret/presentation';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/alpha/projects/secret': [
          { method: 'read', service: 'arborist' },
        ],
      },
      isLoading: false,
      isError: false,
    });
    const Content = () => {
      useInitialPageReady(false);
      return <div>Project tabs</div>;
    };

    render(
      <MantineProvider>
        <AuthenticatedPage>
          <Content />
        </AuthenticatedPage>
      </MantineProvider>,
    );

    expect(screen.getByText('Project tabs')).toBeVisible();
    expect(screen.queryByText('Loading project page...')).toBeNull();
  });

  it('denies a different project before mounting its page', () => {
    router.pathname = '/org/[org]/project/[project]/storage';
    router.asPath = '/org/alpha/project/secret/storage';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/alpha/projects/other': [
          { method: 'read', service: 'arborist' },
        ],
      },
      isLoading: false,
      isError: false,
    });
    render(page('Secret project data'));
    expect(screen.queryByText('Secret project data')).toBeNull();
    expect(screen.getByText('Not Authorized')).toBeVisible();
  });

  it('does not treat organization create permission as project read access', () => {
    router.pathname = '/org/[org]/project/[project]/storage';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/alpha/projects': [
          { method: 'create-descendant', service: 'arborist' },
        ],
      },
      isLoading: false,
      isError: false,
    });
    render(page('Secret project data'));
    expect(screen.queryByText('Secret project data')).toBeNull();
    expect(screen.getByText('Not Authorized')).toBeVisible();
  });

  it('allows a project when Fence grants read access to that project', () => {
    router.pathname = '/org/[org]/project/[project]/storage';
    router.asPath = '/org/alpha/project/secret/storage';
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/alpha/projects/secret': [
          { method: 'read', service: 'arborist' },
        ],
      },
      isLoading: false,
      isError: false,
    });
    render(page('Secret project data'));
    expect(screen.getByText('Secret project data')).toBeVisible();
  });

  it('waits for the home session check before mounting public content', () => {
    router.pathname = '/';
    router.asPath = '/';
    useSession.mockReturnValue({ status: 'not present', pending: true });
    render(page('Public home'));
    expect(screen.queryByText('Public home')).toBeNull();
    expect(screen.queryByText('Verifying account access')).toBeNull();
  });

  it('keeps the home redirect from a protected page visually quiet while checking the session', () => {
    router.pathname = '/';
    router.asPath = '/?referer=%2Fgit';
    router.query = { referer: '/git' };
    useSession.mockReturnValue({ status: 'not present', pending: true });
    render(page('Public home'));
    expect(screen.queryByText('Public home')).toBeNull();
    expect(screen.queryByText('Verifying account access')).toBeNull();
  });

  it('allows the public home page for a logged-out visitor', () => {
    router.pathname = '/';
    router.asPath = '/';
    useSession.mockReturnValue({ status: 'invalid', pending: false });
    render(page('Public home'));
    expect(screen.getByText('Public home')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows signed-in home content after access and catalog checks finish', () => {
    router.pathname = '/';
    router.asPath = '/';
    router.query = {};
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });
    const renderHome = () => (
      <MantineProvider>
        <AuthenticatedPage>Public home</AuthenticatedPage>
      </MantineProvider>
    );

    const view = render(renderHome());
    expect(screen.queryByText('Public home')).toBeNull();

    useGetAuthzMappingsQuery.mockReturnValue({
      data: {
        '/programs/alpha/projects/secret': [
          { method: 'read', service: 'arborist' },
        ],
      },
      isLoading: false,
      isError: false,
    });
    useGetGeckoProjectsQuery.mockReturnValue({ isLoading: true });
    view.rerender(renderHome());
    expect(screen.queryByText('Public home')).toBeNull();

    useGetGeckoProjectsQuery.mockReturnValue({ isLoading: false });
    useGetGeckoProjectSummaryQuery.mockReturnValue({ isLoading: true });
    view.rerender(renderHome());
    expect(screen.queryByText('Public home')).toBeNull();

    useGetGeckoProjectSummaryQuery.mockReturnValue({ isLoading: false });
    view.rerender(renderHome());
    expect(screen.getByText('Public home')).toBeVisible();
  });

  it('shows access denial without loading the catalog', () => {
    router.pathname = '/';
    router.asPath = '/';
    router.query = {};
    useSession.mockReturnValue({ status: 'issued', pending: false });
    hasFenceAccess.mockReturnValue(false);
    render(
      <MantineProvider>
        <AuthenticatedPage>Public home</AuthenticatedPage>
      </MantineProvider>,
    );

    expect(screen.getByText('No project access')).toBeVisible();
    expect(screen.queryByText('Public home')).toBeNull();
    expect(useGetGeckoProjectsQuery).not.toHaveBeenCalled();
  });
});
