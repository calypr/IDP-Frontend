import React from 'react';
import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import ProtectedContent from './ProtectedContent';

jest.mock('next/router', () => ({
  useRouter: () => ({ pathname: '/git', asPath: '/git' }),
}));
jest.mock('../../lib/session/session', () => ({ useSession: jest.fn() }));
jest.mock('@gen3/core', () => ({ useGetAuthzMappingsQuery: jest.fn() }));
jest.mock('../Modals/LoginModal', () => ({
  LoginView: () => <div>Login prompt</div>,
}));
jest.mock('./NoAccessOverlay', () => ({
  hasFenceAccess: jest.fn(),
  NoAccessOverlay: () => <div>No access</div>,
}));

const useSession = jest.requireMock('../../lib/session/session')
  .useSession as jest.Mock;
const hasFenceAccess = jest.requireMock('./NoAccessOverlay')
  .hasFenceAccess as jest.Mock;
const useGetAuthzMappingsQuery = jest.requireMock('@gen3/core')
  .useGetAuthzMappingsQuery as jest.Mock;

describe('ProtectedContent session transitions', () => {
  beforeEach(() => {
    hasFenceAccess.mockReturnValue(true);
    useGetAuthzMappingsQuery.mockClear();
    useGetAuthzMappingsQuery.mockReturnValue({
      data: { '/programs/example': [{ method: 'read', service: 'arborist' }] },
      isLoading: false,
      isError: false,
    });
  });

  it('waits for the initial check and shows one stable login prompt for a guest', () => {
    useSession.mockReturnValue({ status: 'not present', pending: true });
    const view = render(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.queryByText('Login prompt')).toBeNull();
    expect(useGetAuthzMappingsQuery).not.toHaveBeenCalled();

    useSession.mockReturnValue({ status: 'invalid', pending: false });
    view.rerender(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.getByText('Login prompt')).toBeVisible();
    expect(screen.queryByText('Private Git data')).toBeNull();
    expect(useGetAuthzMappingsQuery).not.toHaveBeenCalled();
  });

  it('shows access denial directly and recovers when the mapping changes', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    hasFenceAccess.mockReturnValue(false);
    const view = render(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.getByText('No access')).toBeVisible();
    expect(screen.queryByText('Private Git data')).toBeNull();

    hasFenceAccess.mockReturnValue(true);
    view.rerender(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.getByText('Private Git data')).toBeVisible();
  });

  it('keeps protected content hidden while the access mapping loads', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    useGetAuthzMappingsQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.queryByText('Private Git data')).toBeNull();
    expect(screen.queryByText('Verifying account access...')).toBeNull();
  });

  it('removes protected content immediately when an issued session becomes invalid', () => {
    useSession.mockReturnValue({ status: 'issued', pending: false });
    const view = render(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.getByText('Private Git data')).toBeVisible();

    useSession.mockReturnValue({ status: 'invalid', pending: false });
    view.rerender(
      <MantineProvider>
        <ProtectedContent>Private Git data</ProtectedContent>
      </MantineProvider>,
    );
    expect(screen.queryByText('Private Git data')).toBeNull();
    expect(screen.getByText('Login prompt')).toBeVisible();
  });
});
