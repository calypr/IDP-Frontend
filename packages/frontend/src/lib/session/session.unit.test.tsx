import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { SessionProvider, useSession } from './session';
import { isExpired } from '../../api/auth/sessionToken';

jest.mock('@gen3/core', () => ({
  ...jest.requireActual('../../../../core/src/features/user/userSliceRTK'),
  ...jest.requireActual('../../../../core/src/constants'),
  useCoreSelector: jest.requireActual('react-redux').useSelector,
}));
const mockRouter = {
  pathname: '/',
  query: {} as Record<string, string>,
  events: { on: jest.fn(), off: jest.fn() },
  push: jest.fn(),
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('jose', () => ({}));
jest.mock('../../utils', () => jest.requireActual('../../utils/time'));
jest.mock('../../components/Providers/ResourceMonitor', () => ({
  useWorkspaceResourceMonitor: jest.fn(),
}));

const { userAuthApi } = jest.requireActual(
  '../../../../core/src/features/user/userSliceRTK',
);

const createStore = () =>
  configureStore({
    reducer: { userAuthApi: userAuthApi.reducer },
    middleware: (defaults) => defaults().concat(userAuthApi.middleware),
  });

const SessionConsumer = () => {
  const session = useSession();
  return (
    <>
      <div>Session {session.status}</div>
      <input aria-label="Unsaved work" defaultValue="draft" />
      <button onClick={() => void session.updateSession()}>
        Check session
      </button>
    </>
  );
};

const renderSession = (store: ReturnType<typeof createStore>) =>
  render(
    <Provider store={store}>
      <MantineProvider>
        <SessionProvider
          updateSessionTime={0}
          logoutInactiveUsers={false}
        >
          <SessionConsumer />
        </SessionProvider>
      </MantineProvider>
    </Provider>,
  );

const response = (data: unknown, status = 200): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 401 ? 'Unauthorized' : '',
    url: '',
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as Response;

const timeOut = (init?: RequestInit): Promise<Response> =>
  new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('aborted', 'AbortError'));
    });
  });

const advanceTime = async (ms: number) => {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
};

describe('SessionProvider service failure recovery', () => {
  let store: ReturnType<typeof createStore>;
  let fetchMock: jest.Mock<
    Promise<Response>,
    [RequestInfo | URL, RequestInit?]
  >;
  const originalFetch = global.fetch;
  const originalBroadcastChannel = global.BroadcastChannel;

  beforeEach(() => {
    jest.useFakeTimers();
    mockRouter.pathname = '/';
    mockRouter.query = {};
    mockRouter.events.on.mockClear();
    store = createStore();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    global.BroadcastChannel = class {
      addEventListener() {}
      removeEventListener() {}
      close() {}
    } as unknown as typeof BroadcastChannel;
  });

  afterEach(() => {
    cleanup();
    store.dispatch(userAuthApi.util.resetApiState());
    jest.useRealTimers();
    global.fetch = originalFetch;
    global.BroadcastChannel = originalBroadcastChannel;
  });

  it('does not show account verification during a protected-page redirect to home', async () => {
    mockRouter.query = { referer: '/git' };
    fetchMock.mockImplementation(async (input, init) =>
      String(input).endsWith('/_status')
        ? response({ csrf: 'token' })
        : timeOut(init),
    );

    renderSession(store);
    await advanceTime(1);

    expect(screen.queryByText('Verifying account access...')).toBeNull();
    expect(screen.queryByText('Session issued')).toBeNull();
  });

  it('does not show a full-screen account loader on the public home page', async () => {
    fetchMock.mockImplementation(async (input, init) =>
      String(input).endsWith('/_status')
        ? response({ csrf: 'token' })
        : timeOut(init),
    );

    renderSession(store);
    await advanceTime(1);
    expect(screen.queryByText('Verifying account access...')).toBeNull();
    expect(screen.queryByText('Session issued')).toBeNull();
  });

  it('does not recheck Fence just because navigation targets home', async () => {
    mockRouter.pathname = '/git';
    let userRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/sessionToken'))
        return response({ status: 'not present' });
      userRequests += 1;
      return response({ username: 'active-user' });
    });

    const view = renderSession(store);
    await advanceTime(1);
    expect(screen.getByLabelText('Unsaved work')).toBeVisible();
    expect(userRequests).toBe(1);
    mockRouter.pathname = '/';
    view.rerender(
      <Provider store={store}>
        <MantineProvider>
          <SessionProvider updateSessionTime={0} logoutInactiveUsers={false}>
            <SessionConsumer />
          </SessionProvider>
        </MantineProvider>
      </Provider>,
    );
    await advanceTime(1);
    expect(userRequests).toBe(1);
    expect(screen.getByLabelText('Unsaved work')).toBeVisible();
  });

  it('keeps a verified user in the app when the commons status check times out', async () => {
    fetchMock.mockImplementation(async (input, init) =>
      String(input).endsWith('/_status')
        ? timeOut(init)
        : response({ username: 'active-user' }),
    );

    renderSession(store);
    await advanceTime(12_050);

    expect(screen.getByText('Session issued')).toBeVisible();
    expect(screen.queryByText('We could not verify your session')).toBeNull();
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/logout')),
    ).toBe(false);
  });

  it('does not interrupt a page while the user check outlasts a failed commons status check', async () => {
    mockRouter.pathname = '/org/HTAN_INT/project/BForePC';
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({}, 503);
      return new Promise<Response>((resolve) => {
        setTimeout(() => resolve(response({ username: 'active-user' })), 5_000);
      });
    });

    renderSession(store);
    await advanceTime(1);
    expect(screen.queryByText('The service could not complete this request')).toBeNull();

    await advanceTime(5_000);
    expect(screen.getByText('Session issued')).toBeVisible();
  });

  it('automatically retries a failed commons status check without reloading', async () => {
    let statusRequests = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/_status')) {
        statusRequests += 1;
        return statusRequests === 1
          ? timeOut(init)
          : response({ csrf: 'recovered' });
      }
      return response({ username: 'active-user' });
    });

    renderSession(store);
    await advanceTime(60_000);

    expect(statusRequests).toBeGreaterThan(1);
    expect(
      userAuthApi.endpoints.getCSRF.select()(store.getState()).data?.csrfToken,
    ).toBe('recovered');
    expect(screen.getByText('Session issued')).toBeVisible();
  });

  it('keeps the authenticated app mounted during a failed user refresh and recovers automatically', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/_status'))
        return response({ csrf: 'token' });
      userRequests += 1;
      return userRequests === 2
        ? timeOut(init)
        : response({ username: 'active-user' });
    });

    renderSession(store);
    await advanceTime(1);
    expect(screen.getByText('Session issued')).toBeVisible();

    const draft = screen.getByLabelText('Unsaved work');
    fireEvent.change(draft, { target: { value: 'unsaved changes' } });

    fireEvent.click(screen.getByText('Check session'));
    await advanceTime(50);
    expect(screen.getByText('Session issued')).toBeVisible();
    expect(screen.getByLabelText('Unsaved work')).toBe(draft);
    await advanceTime(12_050);
    expect(screen.getByText('Session issued')).toBeVisible();
    expect(screen.getByLabelText('Unsaved work')).toBe(draft);
    expect(draft).toHaveValue('unsaved changes');
    expect(screen.queryByText('We could not verify your session')).toBeNull();

    await advanceTime(60_000);
    expect(userRequests).toBeGreaterThan(2);
    expect(
      userAuthApi.endpoints.fetchUserDetails.select()(store.getState())
        .isSuccess,
    ).toBe(true);
  });

  it('removes authenticated status when the server returns 401 after a successful check', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status'))
        return response({ csrf: 'token' });
      userRequests += 1;
      return userRequests === 1
        ? response({ username: 'active-user' })
        : response({ error: 'Please login' }, 401);
    });

    renderSession(store);
    await advanceTime(1);
    expect(screen.getByText('Session issued')).toBeVisible();

    fireEvent.click(screen.getByText('Check session'));
    await advanceTime(1);

    expect(screen.getByText('Session invalid')).toBeVisible();
    expect(screen.queryByText('Session issued')).toBeNull();
    expect(screen.queryByText('We could not verify your session')).toBeNull();
  });

  it('does not grant access on an initial user timeout and recovers without restarting sign-in', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/_status'))
        return response({ csrf: 'token' });
      userRequests += 1;
      return userRequests === 1
        ? timeOut(init)
        : response({ username: 'active-user' });
    });

    renderSession(store);
    await advanceTime(12_050);
    expect(screen.queryByText('Session issued')).toBeNull();
    expect(screen.queryByText('Restart sign-in')).toBeNull();

    await advanceTime(60_000);
    expect(screen.getByText('Session issued')).toBeVisible();
    expect(userRequests).toBeGreaterThan(1);
  });

  it.each([
    { status: 401, data: { error: 'Please login' } },
    { status: 200, data: {} },
  ])(
    'allows an anonymous user response with HTTP $status to reach sign-in when commons status is unavailable',
    async ({ status, data }) => {
      fetchMock.mockImplementation(async (input, init) =>
        String(input).endsWith('/_status')
          ? timeOut(init)
          : response(data, status),
      );

      renderSession(store);
      await advanceTime(12_050);

      expect(screen.getByText('Session invalid')).toBeVisible();
      expect(screen.queryByText('We could not verify your session')).toBeNull();
    },
  );

  it('recovers from a temporary commons HTTP failure without sending logout requests', async () => {
    let statusRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) {
        statusRequests += 1;
        return statusRequests === 1
          ? response({}, 503)
          : response({ csrf: 'recovered' });
      }
      return response({ username: 'active-user' });
    });

    renderSession(store);
    await advanceTime(60_000);

    expect(screen.getByText('Session issued')).toBeVisible();
    expect(
      userAuthApi.endpoints.getCSRF.select()(store.getState()).data?.csrfToken,
    ).toBe('recovered');
    expect(
      fetchMock.mock.calls.some(([input]) => String(input).includes('/logout')),
    ).toBe(false);
  });

  it('cancels automatic retries when the provider is unmounted', async () => {
    fetchMock.mockImplementation(async (input) =>
      String(input).endsWith('/_status')
        ? Promise.reject(new TypeError('Network unavailable'))
        : response({ username: 'active-user' }),
    );

    const view = renderSession(store);
    await advanceTime(100);
    view.unmount();
    const requestsBeforeUnmount = fetchMock.mock.calls.length;

    await advanceTime(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(requestsBeforeUnmount);
  });

  it('renews from token expiry even while the user is on the home page', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/sessionToken')) {
        return response({
          status: 'issued',
          expires: 2_000,
          expiresInMs: 180_000,
          fenceStatus: 'issued',
          fenceExpires: 3_000,
          fenceExpiresInMs: 900_000,
        });
      }
      userRequests += 1;
      return response({ username: 'active-user' });
    });

    renderSession(store);
    await advanceTime(1);
    expect(userRequests).toBe(1);
    await advanceTime(59_000);
    expect(userRequests).toBe(1);
    await advanceTime(2_000);
    expect(userRequests).toBe(2);
  });

  it('verifies a service 401 with Fence before logging out', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/sessionToken'))
        return response({ status: 'not present' });
      if (String(input).includes('/logout')) return response({});
      userRequests += 1;
      return response({ username: 'active-user' });
    });

    renderSession(store);
    await advanceTime(1);
    act(() => window.dispatchEvent(new CustomEvent('gen3-verify-session')));
    await advanceTime(50);

    expect(userRequests).toBe(2);
    expect(screen.getByText('Session issued')).toBeVisible();
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/logout'))).toBe(false);
  });

  it('shows sign-in after Fence confirms a service 401 without calling logout', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/sessionToken'))
        return response({ status: 'not present' });
      if (String(input).includes('/logout')) return response({});
      userRequests += 1;
      return userRequests === 1
        ? response({ username: 'active-user' })
        : response({ error: 'Please login' }, 401);
    });

    renderSession(store);
    await advanceTime(1);
    act(() => window.dispatchEvent(new CustomEvent('gen3-verify-session')));
    await advanceTime(50);

    expect(userRequests).toBe(2);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/logout'))).toBe(false);
    expect(screen.getByText('Session invalid')).toBeVisible();
  });

  it('clears a rejected credentials token after a service 401 before the next login', async () => {
    document.cookie = 'credentials_token=stale; path=/';
    let userRequests = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/sessionToken'))
        return response({ status: 'not present' });
      if (String(input).endsWith('/api/auth/credentialsLogout')) {
        document.cookie = 'credentials_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
        return response({}, 204);
      }
      userRequests += 1;
      if (userRequests === 2) return response({ error: 'Please login' }, 401);
      if (userRequests === 3) {
        expect(init?.headers).not.toHaveProperty('Authorization');
      }
      return response({ username: 'active-user' });
    });

    try {
      renderSession(store);
      await advanceTime(1);
      expect(screen.getByText('Session issued')).toBeVisible();

      act(() => window.dispatchEvent(new CustomEvent('gen3-verify-session')));
      await advanceTime(50);
      expect(screen.getByText('Session invalid')).toBeVisible();
      expect(document.cookie).not.toContain('credentials_token=stale');
      expect(fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/api/auth/credentialsLogout'),
      )).toBe(true);

      await act(async () => {
        await store.dispatch(
          userAuthApi.endpoints.fetchUserDetails.initiate(undefined, {
            forceRefetch: true,
          }),
        );
      });
      expect(userRequests).toBe(3);
    } finally {
      document.cookie = 'credentials_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
  });

  it('does not recheck or log out an anonymous visitor after a service 401', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).includes('/logout')) return response({});
      userRequests += 1;
      return response({ error: 'Please login' }, 401);
    });

    renderSession(store);
    act(() => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        window.dispatchEvent(new CustomEvent('gen3-verify-session'));
      }
    });
    await advanceTime(1);
    expect(screen.getByText('Session invalid')).toBeVisible();

    act(() => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        window.dispatchEvent(new CustomEvent('gen3-verify-session'));
      }
    });
    await advanceTime(50);

    expect(userRequests).toBe(1);
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/logout'))).toBe(false);
    expect(screen.getByText('Session invalid')).toBeVisible();
  });

  it('clears a rejected bearer cookie without calling Fence logout', async () => {
    document.cookie = 'credentials_token=stale; path=/';
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/credentialsLogout')) return response({}, 204);
      return response({ error: 'Please login' }, 401);
    });

    try {
      renderSession(store);
      await advanceTime(50);

      expect(screen.getByText('Session invalid')).toBeVisible();
      expect(fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/api/auth/credentialsLogout'),
      )).toBe(true);
      expect(fetchMock.mock.calls.some(([input]) =>
        String(input).includes('/logout'),
      )).toBe(false);
    } finally {
      document.cookie = 'credentials_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    }
  });

  it('never restores cached authentication after a 401 followed by a network failure', async () => {
    let userRequests = 0;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/_status'))
        return response({ csrf: 'token' });
      if (String(input).endsWith('/api/auth/sessionToken'))
        return response({ status: 'not present' });
      userRequests += 1;
      if (userRequests === 1) return response({ username: 'active-user' });
      if (userRequests === 2) return response({ error: 'Please login' }, 401);
      return timeOut(init);
    });

    renderSession(store);
    await advanceTime(1);
    fireEvent.click(screen.getByText('Check session'));
    await advanceTime(50);
    expect(screen.getByText('Session invalid')).toBeVisible();
    const rejectedUser = userAuthApi.endpoints.fetchUserDetails.select()(
      store.getState(),
    );
    expect(rejectedUser.data?.loginStatus).not.toBe('authenticated');
    expect(rejectedUser.data?.data?.username).toBeUndefined();

    act(() => {
      void store.dispatch(
        userAuthApi.endpoints.fetchUserDetails.initiate(undefined, {
          forceRefetch: true,
        }),
      );
    });
    await advanceTime(50);
    expect(screen.queryByText('Session issued')).toBeNull();
    await advanceTime(12_050);
    expect(screen.queryByText('Session issued')).toBeNull();
  });

  it('backs off repeated commons network failures while keeping the app available', async () => {
    let statusRequests = 0;
    fetchMock.mockImplementation(async (input) => {
      if (String(input).endsWith('/_status')) {
        statusRequests += 1;
        throw new TypeError('Network unavailable');
      }
      return response({ username: 'active-user' });
    });

    renderSession(store);
    for (let seconds = 0; seconds < 60; seconds += 1) {
      await advanceTime(1_000);
      expect(screen.getByText('Session issued')).toBeVisible();
    }

    expect(statusRequests).toBeGreaterThan(2);
    expect(statusRequests).toBeLessThanOrEqual(8);
  });
});

describe('JWT expiration units', () => {
  it('compares JWT seconds with the current time in milliseconds', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(isExpired(nowSeconds - 1)).toBe(true);
    expect(isExpired(nowSeconds + 60)).toBe(false);
  });
});
