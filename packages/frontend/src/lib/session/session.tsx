import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'next/router';
import { getCookie } from 'cookies-next';
import { useDeepCompareMemo } from 'use-deep-compare';
import { useManageSession } from './hooks';
import { nextRefreshDelay } from './refreshTiming';
import { showNotification } from '@mantine/notifications';
import { AuthTokenData, Session, SessionProviderProps } from './types';
import { isUserOnPage } from './utils';
import {
  type CoreState,
  GEN3_FENCE_API,
  GEN3_REDIRECT_URL,
  selectUserAuthStatus,
  useCoreSelector,
  useGetCSRFQuery,
  useLazyFetchUserDetailsQuery,
} from '@gen3/core';

import { Center } from '@mantine/core';

import { MinutesToMilliseconds } from '../../utils';
import { useWorkspaceResourceMonitor } from '../../components/Providers/ResourceMonitor';
import { VerifyingAccessLoader } from '../../components/Protected/VerifyingAccessLoader';
import SessionFailureView from '../../components/Protected/SessionFailureView';
import { WORKSPACES_ENABLED } from '../../features/Workspace/config';

const ACTIVITY_CHANNEL = 'gen3-user-activity';
const FORCE_LOGOUT_EVENT = 'gen3-force-logout';
const VERIFY_SESSION_EVENT = 'gen3-verify-session';
const RETRY_BASE_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 30_000;
const isAppHomePath = (path?: string): boolean =>
  path === '/' || Boolean(path?.startsWith('/Apps'));

const getRetryDelay = (attempt: number): number =>
  Math.min(RETRY_MAX_DELAY_MS, RETRY_BASE_DELAY_MS * 2 ** Math.min(attempt, 4));

const getRequestErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return undefined;
};

const isRetryableRequestError = (error: unknown): boolean => {
  const status = getRequestErrorStatus(error);
  return (
    status === undefined ||
    status === 0 ||
    status === 408 ||
    status === 429 ||
    (status >= 500 && status < 600)
  );
};

const getRequestErrorDetail = (error: unknown): string => {
  if (!error || typeof error !== 'object') return 'The request failed.';
  if ('data' in error && typeof error.data === 'string') return error.data;
  if ('error' in error && typeof error.error === 'string') return error.error;
  const status = getRequestErrorStatus(error);
  return status ? `Fence returned HTTP ${status}.` : 'The request failed.';
};

export const requestSessionVerification = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VERIFY_SESSION_EVENT));
  }
};

export const requestSessionLogout = ({
  showLoginModal = false,
}: {
  showLoginModal?: boolean;
} = {}) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(FORCE_LOGOUT_EVENT, {
      detail: {
        showLoginModal,
      },
    }),
  );
};

const fetchWithDeadline = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 12_000,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

export const logoutSession = async () => {
  // logged in using credentials then execute credentials logout first
  const accessToken = getCookie('credentials_token');
  if (accessToken) {
    await fetchWithDeadline('/api/auth/credentialsLogout');
  }

  await fetchWithDeadline(
    `${GEN3_FENCE_API}/logout?next=${GEN3_REDIRECT_URL}/`,
    {
      cache: 'no-store',
      redirect: 'manual',
    },
  );
};

function useOnline() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : false,
  );

  const setOnline = () => setIsOnline(true);
  const setOffline = () => setIsOnline(false);

  useEffect(() => {
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);

    return () => {
      window.removeEventListener('online', setOnline);
      window.removeEventListener('offline', setOffline);
    };
  }, []);

  return isOnline;
}

export const SessionContext = React.createContext<Session | undefined>(
  undefined,
);

/**
 *  Wwe eventually want to use the session token to determine if the user is logged in
 *  as opposed to the user status since that check will happen on the server using httpOnly cookies
 *  and verification of the session token
 */
export const getSession = async () => {
  try {
    const res = await fetch('/api/auth/sessionToken', { cache: 'no-store' });
    if (res.status === 200) {
      return (await res.json()) as AuthTokenData;
    }
  } catch {
    return { status: 'error' } as AuthTokenData;
  }
  return { status: 'error' } as AuthTokenData;
};

export const useSession = (
  required = false,
  onUnauthenticated?: () => void,
) => {
  const router = useRouter();
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error(
      '[gen3]: `useSession` must be wrapped in a <SessionProvider />',
    );
  }

  if (required && !session.pending && session.status !== 'issued') {
    if (onUnauthenticated) {
      onUnauthenticated();
    } else {
      if (typeof window === 'undefined')
        // route not available on SSR
        return session;
      router.push('/');
    }
  }
  return session;
};

export const useIsAuthenticated = () => {
  const session = useSession();
  return {
    isAuthenticated: session.status === 'issued',
    user: session.userContext,
  };
};

type IntervalFunction = () => unknown | void;

const useInterval = (callback: IntervalFunction, delay: number | null) => {
  const savedCallback = useRef<IntervalFunction | null>(null);

  useEffect(() => {
    if (delay === null) return;
    savedCallback.current = callback;
  });

  useEffect(() => {
    if (delay === null) return;
    function tick() {
      if (savedCallback.current !== null) {
        savedCallback.current();
      }
    }
    const id = setInterval(tick, delay);
    return () => clearInterval(id);
  }, [delay]);
};

/**
 * SessionProvider creates a React context which keeps track of wether the user is authenticated
 * and if their session is stale and logs them out if they do not preform an action in an alotted amount of time
 * @param children - Pass in a child session if one exists
 * @param session - Pass in a cached session if one exists
 * @param updateSessionTime - Interval of time between fetching session token
 * @param inactiveTimeLimit - Amount of time user is allowed to be inactive before getting logged out if user is tabbed away from page
 * @param workspaceInactivityTimeLimit - Amount of time user is allowed to be inactive if user is tabbed into the site
 * @param logoutInactiveUsers - Whether to log out users that are determined to be inactive or not
 * @returns a Session context that can be used to keep track of user session activity
 */
export const SessionProvider = ({
  children,
  updateSessionTime = 1440,
  renewAccessTokenEarlyMilliseconds = 120_000,
  inactiveTimeLimit = 1440,
  workspaceInactivityTimeLimit = 0,
  logoutInactiveUsers = true,
  monitorWorkspace = false,
}: SessionProviderProps) => {
  const router = useRouter();

  const {
    isSuccess: isGetCSRFSuccess,
    isError: isGetCSRFError,
    isLoading: isGetCSRFLoading,
    isFetching: isGetCSRFFetching,
    error: getCSRFError,
    refetch: refetchCSRF,
  } = useGetCSRFQuery();
  useWorkspaceResourceMonitor(monitorWorkspace && WORKSPACES_ENABLED); // monitor workspaces if explicitly enabled

  const [
    getUserDetails,
    {
      isLoading: isUserDetailsLoading,
      isFetching: isUserDetailsFetching,
      isError: isUserDetailsError,
      error: userDetailsError,
    },
  ] = useLazyFetchUserDetailsQuery(); // Fetch user details
  const userStatus = useCoreSelector((state: CoreState) =>
    selectUserAuthStatus(state),
  );
  const csrfRetryAttemptRef = useRef(0);
  const userRetryAttemptRef = useRef(0);

  const [mostRecentActivityTimestamp, setMostRecentActivityTimestamp] =
    useState(Date.now());
  const forcedLogoutInFlightRef = useRef(false);
  const userVerificationPromiseRef = useRef<Promise<void> | null>(null);
  const homeUnauthorizedRef = useRef(false);
  const [isUserVerificationPending, setIsUserVerificationPending] =
    useState(true);
  const [isHomeRouteTransitionPending, setIsHomeRouteTransitionPending] =
    useState(false);
  const [isLogoutTransitionPending, setIsLogoutTransitionPending] =
    useState(false);
  const homeNavigationVerificationRef = useRef<Promise<void> | null>(null);

  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  // Initialize BroadcastChannel for cross-tab communication
  // any user event on one tab or window will update mostRecentActivityTimestamp
  useEffect(() => {
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined')
      return;

    let channel: BroadcastChannel;
    try {
      channel = new BroadcastChannel(ACTIVITY_CHANNEL);
    } catch {
      return;
    }
    broadcastChannelRef.current = channel;

    const handleActivityMessage = (event: MessageEvent) => {
      const data = event.data as
        | { type?: unknown; timestamp?: unknown }
        | null
        | undefined;
      if (data?.type !== 'activity-update') return;
      if (typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp))
        return;
      setMostRecentActivityTimestamp(Math.min(data.timestamp, Date.now()));
    };

    channel.addEventListener('message', handleActivityMessage);
    return () => {
      channel.removeEventListener('message', handleActivityMessage);
      channel.close();
      if (broadcastChannelRef.current === channel) {
        broadcastChannelRef.current = null;
      }
    };
  }, []);

  const inactiveTimeLimitMilliseconds =
    MinutesToMilliseconds(inactiveTimeLimit);

  const workspaceInactivityTimeLimitMilliseconds = MinutesToMilliseconds(
    workspaceInactivityTimeLimit,
  );
  const updateSessionIntervalMilliseconds =
    MinutesToMilliseconds(updateSessionTime);

  // update session status using the user status

  const sessionInfo = useManageSession(userStatus);

  useEffect(() => {
    if (isGetCSRFLoading || isGetCSRFFetching) return;
    if (isGetCSRFSuccess) {
      csrfRetryAttemptRef.current = 0;
      return;
    }
    if (!isGetCSRFError) return;
    if (!isRetryableRequestError(getCSRFError)) {
      csrfRetryAttemptRef.current = 0;
      return;
    }

    const timeout = setTimeout(() => {
      csrfRetryAttemptRef.current += 1;
      void refetchCSRF();
    }, getRetryDelay(csrfRetryAttemptRef.current));

    return () => clearTimeout(timeout);
  }, [
    isGetCSRFError,
    isGetCSRFLoading,
    isGetCSRFSuccess,
    isGetCSRFFetching,
    getCSRFError,
    refetchCSRF,
  ]);

  useEffect(() => {
    if (isUserDetailsLoading || isUserDetailsFetching) return;
    if (!isUserDetailsError) {
      userRetryAttemptRef.current = 0;
      return;
    }
    if (getRequestErrorStatus(userDetailsError) === 401) {
      userRetryAttemptRef.current = 0;
      return;
    }
    if (!isRetryableRequestError(userDetailsError)) {
      userRetryAttemptRef.current = 0;
      return;
    }

    const timeout = setTimeout(() => {
      userRetryAttemptRef.current += 1;
      void getUserDetails();
    }, getRetryDelay(userRetryAttemptRef.current));

    return () => clearTimeout(timeout);
  }, [
    getUserDetails,
    isUserDetailsError,
    isUserDetailsFetching,
    isUserDetailsLoading,
    userDetailsError,
  ]);

  // for now, we are using the user status to determine if the user is logged in
  const endSession = useCallback(
    async (shouldRedirect = true) => {
      if (shouldRedirect && typeof window !== 'undefined') {
        setIsLogoutTransitionPending(true);
        const accessToken = getCookie('credentials_token');
        if (accessToken) {
          try {
            await fetchWithDeadline('/api/auth/credentialsLogout');
          } catch (e: unknown) {
            showNotification({
              title: 'Logout Error',
              message: `error logging out ${e instanceof Error ? e.message : String(e)}`,
            });
          }
        }

        const next = `${GEN3_REDIRECT_URL}/`;
        window.location.assign(
          `${GEN3_FENCE_API}/logout?next=${encodeURIComponent(next)}`,
        );
        return;
      }

      try {
        await logoutSession();
      } catch (e: unknown) {
        showNotification({
          title: 'Logout Error',
          message: `error logging out ${e instanceof Error ? e.message : String(e)}`,
        });
      } finally {
        try {
          await getUserDetails().unwrap();
        } catch {
          // The post-logout user request is expected to be unauthorized.
        }
      }
    },
    [getUserDetails],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handleForcedLogout = () => {
      if (forcedLogoutInFlightRef.current) {
        return;
      }

      forcedLogoutInFlightRef.current = true;
      setIsUserVerificationPending(true);

      void endSession(false).finally(() => {
        forcedLogoutInFlightRef.current = false;
        setIsUserVerificationPending(false);
      });
    };

    window.addEventListener(FORCE_LOGOUT_EVENT, handleForcedLogout);

    return () => {
      window.removeEventListener(FORCE_LOGOUT_EVENT, handleForcedLogout);
    };
  }, [endSession]);

  const updateSession = useCallback((): Promise<void> => {
    if (isAppHomePath(router.pathname) && homeUnauthorizedRef.current) {
      setIsUserVerificationPending(false);
      return Promise.resolve();
    }

    if (userVerificationPromiseRef.current) {
      return userVerificationPromiseRef.current;
    }

    setIsUserVerificationPending(true);

    const verification = (async () => {
      const hasBearerCredential = Boolean(getCookie('credentials_token'));

      try {
        await getUserDetails().unwrap();
        homeUnauthorizedRef.current = false;
      } catch (error: unknown) {
        const isUnauthorized = getRequestErrorStatus(error) === 401;
        if (isUnauthorized && isAppHomePath(router.pathname)) {
          homeUnauthorizedRef.current = true;
        }

        if (
          hasBearerCredential &&
          isUnauthorized &&
          !forcedLogoutInFlightRef.current
        ) {
          // The 401 has already resolved authentication as logged out. Clear
          // the rejected bearer cookie without redirecting through Fence logout.
          forcedLogoutInFlightRef.current = true;
          await fetchWithDeadline('/api/auth/credentialsLogout')
            .catch((logoutError: unknown) => {
              showNotification({
                title: 'Logout Error',
                message: `error logging out ${
                  logoutError instanceof Error
                    ? logoutError.message
                    : String(logoutError)
                }`,
              });
            })
            .finally(() => {
              forcedLogoutInFlightRef.current = false;
            });
        }
      }
    })();

    userVerificationPromiseRef.current = verification;
    void verification.finally(() => {
      if (userVerificationPromiseRef.current === verification) {
        userVerificationPromiseRef.current = null;
        setIsUserVerificationPending(false);
      }
    });
    return verification;
  }, [getUserDetails, router.pathname]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshActiveRef = useRef(false);
  const refreshInFlightRef = useRef(false);
  const previousTokenRef = useRef<AuthTokenData | undefined>(undefined);
  const retryDelayRef = useRef(5_000);
  const runRefreshRef = useRef<() => Promise<void>>(async () => undefined);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = null;
  }, []);

  const armRefresh = useCallback((delay: number) => {
    if (!refreshActiveRef.current) return;
    clearRefreshTimer();
    refreshTimerRef.current = setTimeout(() => {
      void runRefreshRef.current();
    }, delay);
  }, [clearRefreshTimer]);

  const runRefresh = useCallback(async (): Promise<void> => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    try {
      // A real Fence request renews the HttpOnly cookies when allowed.
      await getUserDetails().unwrap();
      const token = await getSession();
      if (token.status === 'error') throw new Error('Session status unavailable');

      const delay = nextRefreshDelay(
        token,
        renewAccessTokenEarlyMilliseconds,
        previousTokenRef.current,
      );
      previousTokenRef.current = token;
      retryDelayRef.current = 5_000;
      if (delay !== null) armRefresh(delay);
    } catch (error: unknown) {
      if (getRequestErrorStatus(error) === 401) {
        clearRefreshTimer();
        return;
      }
      armRefresh(retryDelayRef.current);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, 300_000);
    } finally {
      refreshInFlightRef.current = false;
    }
  }, [
    armRefresh,
    clearRefreshTimer,
    getUserDetails,
    renewAccessTokenEarlyMilliseconds,
  ]);

  useEffect(() => {
    runRefreshRef.current = runRefresh;
  }, [runRefresh]);

  useEffect(() => {
    if (sessionInfo.status !== 'issued') {
      refreshActiveRef.current = false;
      clearRefreshTimer();
      previousTokenRef.current = undefined;
      retryDelayRef.current = 5_000;
      return;
    }

    refreshActiveRef.current = true;
    // The provider already requested /user on mount. Read the resulting
    // cookies without issuing a second Fence request.
    void getSession().then((token) => {
      if (!refreshActiveRef.current) return;
      const delay =
        token.status === 'error'
          ? 5_000
          : nextRefreshDelay(token, renewAccessTokenEarlyMilliseconds);
      previousTokenRef.current = token;
      if (delay !== null) armRefresh(delay);
    });
    let lastCatchUp = 0;
    const catchUp = () => {
      if (Date.now() - lastCatchUp < 10_000) return;
      lastCatchUp = Date.now();
      void runRefresh();
    };
    const catchUpIfVisible = () => {
      if (document.visibilityState === 'visible') catchUp();
    };
    document.addEventListener('visibilitychange', catchUpIfVisible);
    window.addEventListener('focus', catchUp);
    window.addEventListener('online', catchUp);
    return () => {
      refreshActiveRef.current = false;
      clearRefreshTimer();
      document.removeEventListener('visibilitychange', catchUpIfVisible);
      window.removeEventListener('focus', catchUp);
      window.removeEventListener('online', catchUp);
    };
  }, [
    sessionInfo.status,
    runRefresh,
    clearRefreshTimer,
    armRefresh,
    renewAccessTokenEarlyMilliseconds,
  ]);

  useEffect(() => {
    const verifyAfterUnauthorized = () => {
      // The initial /user request already determines whether a visitor is a guest.
      // Only an authenticated session needs a second Fence check after a service 401.
      if (userStatus !== 'authenticated' || userVerificationPromiseRef.current)
        return;
      void updateSession();
    };
    window.addEventListener(VERIFY_SESSION_EVENT, verifyAfterUnauthorized);
    return () => {
      window.removeEventListener(VERIFY_SESSION_EVENT, verifyAfterUnauthorized);
    };
  }, [updateSession, userStatus]);

  useEffect(() => {
    const routePath = (url: string) => url.split(/[?#]/, 1)[0];

    const handleRouteChangeStart = (url: string) => {
      if (!isAppHomePath(routePath(url))) return;

      const isReturningFromProtectedPage =
        routePath(url) === '/' &&
        new URLSearchParams(url.split('?', 2)[1]).has('referer');
      setIsHomeRouteTransitionPending(!isReturningFromProtectedPage);
      homeNavigationVerificationRef.current = updateSession();
    };

    const handleRouteChangeComplete = (url: string) => {
      if (!isAppHomePath(routePath(url))) {
        homeNavigationVerificationRef.current = null;
        setIsHomeRouteTransitionPending(false);
        return;
      }

      const verification =
        homeNavigationVerificationRef.current ?? updateSession();
      void verification.finally(() => {
        if (homeNavigationVerificationRef.current === verification) {
          homeNavigationVerificationRef.current = null;
          setIsHomeRouteTransitionPending(false);
        }
      });
    };

    const handleRouteChangeError = () => {
      homeNavigationVerificationRef.current = null;
      setIsHomeRouteTransitionPending(false);
    };

    router.events.on('routeChangeStart', handleRouteChangeStart);
    router.events.on('routeChangeComplete', handleRouteChangeComplete);
    router.events.on('routeChangeError', handleRouteChangeError);

    return () => {
      router.events.off('routeChangeStart', handleRouteChangeStart);
      router.events.off('routeChangeComplete', handleRouteChangeComplete);
      router.events.off('routeChangeError', handleRouteChangeError);
    };
  }, [router.events, updateSession]);
  /**
   * Update session value every updateSessionInterval seconds
   */
  useEffect(() => {
    void updateSession();

    if (updateSessionIntervalMilliseconds <= 0) return; // do not poll if updateSessionInterval is 0

    const updateUserActivity = () => {
      const timestamp = Date.now();
      setMostRecentActivityTimestamp(timestamp);

      const channel = broadcastChannelRef.current;
      if (channel) {
        try {
          channel.postMessage({
            type: 'activity-update',
            timestamp,
          });
        } catch (error) {
          if (
            error instanceof DOMException &&
            error.name === 'InvalidStateError'
          ) {
            if (broadcastChannelRef.current === channel) {
              broadcastChannelRef.current = null;
            }
          } else {
            throw error;
          }
        }
      }
    };

    window.addEventListener('mousedown', updateUserActivity);
    window.addEventListener('keypress', updateUserActivity);
    window.addEventListener('updateUserActivity', updateUserActivity);
    window.addEventListener('scroll', updateUserActivity);
    window.addEventListener('click', updateUserActivity);
    window.addEventListener('touchstart', updateUserActivity);

    return () => {
      window.removeEventListener('mousedown', updateUserActivity);
      window.removeEventListener('keypress', updateUserActivity);
      window.removeEventListener('updateUserActivity', updateUserActivity);
      window.removeEventListener('scroll', updateUserActivity);
      window.removeEventListener('click', updateUserActivity);
      window.removeEventListener('touchstart', updateUserActivity);
    };
  }, []); // only call on mount/dismount

  useInterval(
    () => {
      if (sessionInfo.status != 'issued') return; // no need to update session if user is not logged in

      const timeSinceLastActivity = Date.now() - mostRecentActivityTimestamp;

      if (logoutInactiveUsers) {
        if (
          timeSinceLastActivity >= inactiveTimeLimitMilliseconds &&
          !isUserOnPage('Workspace')
        ) {
          endSession(false);
          return;
        }
        if (
          workspaceInactivityTimeLimitMilliseconds > 0 &&
          timeSinceLastActivity >= workspaceInactivityTimeLimitMilliseconds &&
          isUserOnPage('Workspace')
        ) {
          endSession(false);
          return;
        }
      }
    },
    updateSessionIntervalMilliseconds > 0
      ? updateSessionIntervalMilliseconds
      : null,
  );

  const hasVerifiedAuthenticatedUser = userStatus === 'authenticated';
  const value: Session = useDeepCompareMemo(() => {
    return {
      ...sessionInfo,
      pending:
        sessionInfo.pending ||
        (!hasVerifiedAuthenticatedUser &&
          (isUserVerificationPending ||
            isUserDetailsLoading ||
            isUserDetailsFetching)),
      updateSession,
      endSession,
    };
  }, [
    sessionInfo,
    hasVerifiedAuthenticatedUser,
    isUserVerificationPending,
    isUserDetailsLoading,
    isUserDetailsFetching,
    updateSession,
    endSession,
  ]);

  const isUserUnauthorized = getRequestErrorStatus(userDetailsError) === 401;
  const hasResolvedUserStatus =
    hasVerifiedAuthenticatedUser || userStatus === 'unauthenticated';
  const isReturningFromProtectedPage =
    router.pathname === '/' && typeof router.query?.referer === 'string';

  if (isGetCSRFError && !hasResolvedUserStatus) {
    return (
      <SessionFailureView
        detail={`The commons status check failed. ${getRequestErrorDetail(getCSRFError)}`}
        onRetry={() => void refetchCSRF()}
      />
    );
  }

  if (
    isUserDetailsError &&
    !isUserUnauthorized &&
    !hasVerifiedAuthenticatedUser
  ) {
    return (
      <SessionFailureView
        detail={`Fence could not return your user session. ${getRequestErrorDetail(userDetailsError)}`}
        onRetry={() => void getUserDetails()}
      />
    );
  }

  if (isGetCSRFSuccess && isAppHomePath(router.pathname) && value.pending) {
    return isReturningFromProtectedPage ? null : <VerifyingAccessLoader />;
  }

  if (
    isGetCSRFSuccess ||
    hasVerifiedAuthenticatedUser ||
    userStatus === 'unauthenticated'
  )
    return (
      <SessionContext.Provider value={value}>
        {isHomeRouteTransitionPending || isLogoutTransitionPending ? (
          <VerifyingAccessLoader
            message={
              isLogoutTransitionPending
                ? 'Signing out...'
                : 'Loading home page...'
            }
          />
        ) : (
          children
        )}
      </SessionContext.Provider>
    );

  if (isAppHomePath(router.pathname)) {
    return isReturningFromProtectedPage ? null : (
      <VerifyingAccessLoader message="Contacting commons services..." />
    );
  }

  return <Center h="100vh" />;
};
