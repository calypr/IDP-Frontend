import React from 'react';
import { Gen3User, LoginStatus, type JWTSessionStatus } from '@gen3/core';

export interface AuthTokenData {
  issued?: number;
  expires?: number;
  status: JWTSessionStatus;
  expiresInMs?: number;
  fenceStatus?: JWTSessionStatus;
  fenceExpires?: number;
  fenceExpiresInMs?: number;
  userContext?: Record<string, string>;
}

export interface Session extends AuthTokenData {
  userStatus?: LoginStatus;
  user?: Gen3User;
  updateSession: () => Promise<void>;
  endSession: (shouldRedirect?: boolean) => void;
  pending: boolean;
}

export interface SessionConfig {
  sessionConfig?: SessionConfiguration;
}

export interface SessionConfiguration {
  /**
   * Interval in minutes for inactivity checks. Token renewal uses token expiry.
   * Set to `0` to disable inactivity checks.
   */
  updateSessionTime?: number;

  /** Refresh this many milliseconds before a token expires. */
  renewAccessTokenEarlyMilliseconds?: number;

  /**
   * number of seconds after which the session will be considered inactive.
   */
  inactiveTimeLimit?: number;

  /**
   * number of seconds after which the session will be considered inactive if using a workspace.
   */
  workspaceInactivityTimeLimit?: number;
  /**
   * `SessionProvider` automatically fetches the session when the user switches between windows.
   * This option activates this behaviour if set to `true` (default).
   */
  refetchOnWindowFocus?: boolean;

  /**
   * logout the user if the session is inactive for the specified time defined by 'inactiveTimeLimit'.
   */
  logoutInactiveUsers?: boolean;

  /**
   *  should workspaces be monitored
   */

  monitorWorkspace?: boolean;
}

export interface SessionProviderProps extends SessionConfiguration {
  children: React.ReactNode;
  initialAuthenticated?: boolean;
}
