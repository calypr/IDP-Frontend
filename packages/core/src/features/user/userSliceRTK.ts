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

const getRequestErrorStatus = (error: unknown): number | undefined => {
  if (typeof error !== 'object' || error === null) return undefined;

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  if ('error' in error) {
    const nestedError = error.error;
    if (
      typeof nestedError === 'object' &&
      nestedError !== null &&
      'status' in nestedError &&
      typeof nestedError.status === 'number'
    ) {
      return nestedError.status;
    }
  }

  return undefined;
};

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
    } catch (error: unknown) {
      return {
        error: {
          status: getRequestErrorStatus(error) ?? 0,
          data: error,
        },
      };
    }

    return { data: results };
  },
  endpoints: (builder) => ({
    fetchUserDetails: builder.query<UserAuthResponse, void>({
      query: () => ({ endpoint: '/user' }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } catch (error: unknown) {
          if (getRequestErrorStatus(error) !== 401) return;

          dispatch(
            userAuthApi.util.updateQueryData(
              'fetchUserDetails',
              undefined,
              () =>
                ({
                  data: EMPTY_USER,
                  loginStatus: 'unauthenticated',
                }) satisfies UserAuthResponse,
            ),
          );
        }
      },
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

          return {
            error: {
              status: res.status,
              data: await res.text(),
            },
          };
        } catch (error: unknown) {
          if (error instanceof Error) {
            return {
              error: {
                status: timedOut ? 408 : 0,
                data: timedOut
                  ? 'Commons status request timed out'
                  : error.message,
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
  (userLoginState): LoginStatus => {
    if (getRequestErrorStatus(userLoginState.error) === 401) {
      return 'unauthenticated';
    }

    if (userLoginState.data?.loginStatus) {
      return userLoginState.data.loginStatus;
    }

    if (
      userLoginState.status === QueryStatus.pending ||
      userLoginState.status === QueryStatus.rejected
    ) {
      return 'pending';
    }

    if (userLoginState.status === QueryStatus.uninitialized) {
      return 'not present';
    }

    return 'unauthenticated';
  },
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
