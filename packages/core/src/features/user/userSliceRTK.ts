import { createSelector } from '@reduxjs/toolkit';
import { fetchFence } from '../fence/utils';
import { type Gen3FenceResponse } from '../fence/types';
import { Gen3User, LoginStatus } from './types';
import { CoreState } from '../../reducers';
import { getCookie } from 'cookies-next';
import { QueryStatus } from '@reduxjs/toolkit/query';
import { createApi } from '@reduxjs/toolkit/query/react';
import { GEN3_API } from '../../constants';

export interface CSRFToken {
  readonly csrfToken: string;
}

export interface UserAuthResponse {
  readonly data: Gen3User;
  readonly loginStatus: LoginStatus;
}

export const userAuthApi = createApi({
  reducerPath: 'userAuthApi',
  refetchOnMountOrArgChange: 1800,
  refetchOnReconnect: true,
  baseQuery: async ({ endpoint }, { getState, signal }) => {
    let results;
    const csrfToken = selectCSRFToken(getState() as CoreState);
    let accessToken = undefined;
    if (process.env.NODE_ENV === 'development') {
      accessToken = getCookie('credentials_token');
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };

    try {
      results = await fetchFence({ endpoint, headers, signal });
    } catch (error: any) {
      return {
        error: {
          status: error?.status || 0,
          data: error,
        },
      };
    }

    return { data: results };
  },
  endpoints: (builder) => ({
    fetchUserDetails: builder.query<UserAuthResponse, void>({
      query: () => ({ endpoint: '/user' }),
      transformResponse(response: Gen3FenceResponse<Gen3User>) {
        return {
          data: response.data,
          // TODO: check if this is the correct status code

          loginStatus:
            response.status === 200 && response.data?.username
              ? 'authenticated'
              : 'unauthenticated',
        };
      },
    }),
    getCSRF: builder.query<CSRFToken, void>({
      queryFn: async (_arg, { signal }) => {
        const headers: Record<string, string> = {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        };
        const controller = new AbortController();
        let timedOut = false;
        const abortFromCaller = () => controller.abort(signal.reason);
        signal.addEventListener('abort', abortFromCaller, { once: true });
        const timeout = setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, 12_000);
        try {
          const res = await fetch(`${GEN3_API}/_status`, {
            headers: headers,
            cache: 'no-store',
            signal: controller.signal,
          });

          if (res.ok) {
            const jsonData = await res.json();
            const token = jsonData?.csrf ?? '';
            return {
              data: { csrfToken: token },
            };
          }
        } catch (error: unknown) {
          if (error instanceof Error) {
            return {
              error: {
                status: timedOut ? 408 : 0,
                data: timedOut ? 'Commons status request timed out' : error.message,
              },
            };
          } else {
            return {
              error: { status: 0, data: 'Unknown Error' },
            };
          }
        } finally {
          clearTimeout(timeout);
          signal.removeEventListener('abort', abortFromCaller);
        }
        return {
          error: { status: 0, data: 'Unknown Error' },
        };
      },
    }),
  }),
});

const EMPTY_USER: Gen3User = {
  username: undefined,
};

export const {
  useFetchUserDetailsQuery,
  useLazyFetchUserDetailsQuery,
  useGetCSRFQuery,
  useLazyGetCSRFQuery,
} = userAuthApi;
export const userAuthApiMiddleware = userAuthApi.middleware;
export const userAuthApiReducerPath = userAuthApi.reducerPath;
export const userAuthApiReducer = userAuthApi.reducer;

export const selectUserDetailsFromState =
  userAuthApi.endpoints.fetchUserDetails.select();

export const selectUserDetails = createSelector(
  selectUserDetailsFromState,
  (userDetails) => userDetails?.data?.data ?? EMPTY_USER,
);

export const selectUserAuthStatus = createSelector(
  selectUserDetailsFromState,
  (userLoginState) =>
    userLoginState.status === QueryStatus.pending
      ? ('pending' as LoginStatus)
      : userLoginState.status === QueryStatus.uninitialized
        ? ('not present' as LoginStatus)
        : (userLoginState?.data?.loginStatus ??
          ('unauthenticated' as LoginStatus)),
);

export const selectCSRFTokenData = userAuthApi.endpoints.getCSRF.select();

const passThroughTheState = (state: CoreState) => state.userAuthApi;

export const selectCSRFToken = createSelector(
  [selectCSRFTokenData, passThroughTheState],
  (state) => state?.data?.csrfToken,
);

export const selectHeadersWithCSRFToken = createSelector(
  [selectCSRFToken, passThroughTheState],
  (csrfToken) => ({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
  }),
);
