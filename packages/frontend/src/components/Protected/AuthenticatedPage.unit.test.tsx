import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AuthenticatedPage } from './AuthenticatedPage';

const replace = jest.fn().mockResolvedValue(true);
const router = {
  pathname: '/git',
  asPath: '/git?tab=mine',
  isReady: true,
  query: { org: 'alpha', project: 'secret' },
  replace,
};
const useSession = jest.fn();
const hasFenceAccess = jest.fn();
const useGetAuthzMappingsQuery = jest.fn();

const page = (content: string) => (
  <MantineProvider>
    <AuthenticatedPage>{content}</AuthenticatedPage>
  </MantineProvider>
);

jest.mock('@gen3/core', () => ({
  useGetAuthzMappingsQuery: () => useGetAuthzMappingsQuery(),
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
  VerifyingAccessLoader: () => <div>Verifying account access</div>,
}));

describe('AuthenticatedPage', () => {
  beforeEach(() => {
    replace.mockClear();
    useGetAuthzMappingsQuery.mockClear();
    useGetAuthzMappingsQuery.mockReturnValue({
      data: {},
      isLoading: false,
      isError: false,
    });
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
    expect(replace).not.toHaveBeenCalled();

    useSession.mockReturnValue({ status: 'invalid', pending: false });
    view.rerender(page('Private page'));
    expect(screen.queryByText('Private page')).toBeNull();
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

  it('does not mount any page for an issued session without project access', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    hasFenceAccess.mockReturnValue(false);
    render(page('Private page'));
    expect(screen.queryByText('Private page')).toBeNull();
    expect(screen.getByText('No project access')).toBeVisible();
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
    expect(screen.getByText('No project access')).toBeVisible();
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
    expect(screen.getByText('No project access')).toBeVisible();
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
  });

  it('allows the public home page for a logged-out visitor', () => {
    router.pathname = '/';
    router.asPath = '/';
    useSession.mockReturnValue({ status: 'invalid', pending: false });
    render(page('Public home'));
    expect(screen.getByText('Public home')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
