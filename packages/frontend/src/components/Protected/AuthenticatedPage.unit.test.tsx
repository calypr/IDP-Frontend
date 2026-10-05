import React from 'react';
import { render, screen } from '@testing-library/react';
import { AuthenticatedPage } from './AuthenticatedPage';

const replace = jest.fn().mockResolvedValue(true);
const router = {
  pathname: '/git',
  asPath: '/git?tab=mine',
  isReady: true,
  replace,
};
const useSession = jest.fn();

jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('../../lib/session/session', () => ({ useSession: () => useSession() }));
jest.mock('./VerifyingAccessLoader', () => ({
  VerifyingAccessLoader: () => <div>Verifying account access</div>,
}));

describe('AuthenticatedPage', () => {
  beforeEach(() => {
    replace.mockClear();
    router.pathname = '/git';
    router.asPath = '/git?tab=mine';
    router.isReady = true;
  });

  it('never mounts a protected page for a logged-out visitor and returns to home', () => {
    useSession.mockReturnValue({ status: 'not present', pending: true });
    const view = render(<AuthenticatedPage>Private page</AuthenticatedPage>);
    expect(screen.queryByText('Private page')).toBeNull();
    expect(replace).not.toHaveBeenCalled();

    useSession.mockReturnValue({ status: 'invalid', pending: false });
    view.rerender(<AuthenticatedPage>Private page</AuthenticatedPage>);
    expect(screen.queryByText('Private page')).toBeNull();
    expect(replace).toHaveBeenCalledWith({
      pathname: '/',
      query: { referer: '/git?tab=mine' },
    });
  });

  it('mounts protected pages only for an issued session', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    render(<AuthenticatedPage>Private page</AuthenticatedPage>);
    expect(screen.getByText('Private page')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it('allows the public home page for a logged-out visitor', () => {
    router.pathname = '/';
    router.asPath = '/';
    useSession.mockReturnValue({ status: 'invalid', pending: false });
    render(<AuthenticatedPage>Public home</AuthenticatedPage>);
    expect(screen.getByText('Public home')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });
});
