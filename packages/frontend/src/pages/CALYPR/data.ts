import { GEN3_COMMONS_NAME, GEN3_FENCE_API } from '@gen3/core';
import {
  definePageLoader,
  type ServerPageContext,
} from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { type CalyprProps } from './types';
import type { CalyprLandingPageProps } from './types';
import { LandingConfigurationSchema } from '../Landing/configurationSchema';

const SESSION_CHECK_TIMEOUT_MS = 12_000;

const cookieValue = (
  cookieHeader: string | undefined,
  name: string,
): string | undefined => {
  if (!cookieHeader) return undefined;

  for (const item of cookieHeader.split(';')) {
    const [key, ...valueParts] = item.trim().split('=');
    if (key === name) return valueParts.join('=') || undefined;
  }
  return undefined;
};

const firstHeaderValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

const requestOrigin = (context: ServerPageContext['next']): string => {
  const forwardedProtocol = firstHeaderValue(
    context.req.headers['x-forwarded-proto'],
  );
  const forwardedHost = firstHeaderValue(
    context.req.headers['x-forwarded-host'],
  );
  const host = forwardedHost ?? context.req.headers.host;

  return host ? `${forwardedProtocol ?? 'http'}://${host}` : '';
};

const sessionEndpoint = (
  context: ServerPageContext['next'],
): string | undefined => {
  const fenceBase = GEN3_FENCE_API.replace(/\/$/, '');
  if (/^https?:\/\//i.test(fenceBase)) {
    return `${fenceBase}/user`;
  }

  const origin = requestOrigin(context);
  return origin
    ? new URL(`${fenceBase}/user`, `${origin}/`).toString()
    : undefined;
};

export const verifyAuthenticatedSession = async (
  context: ServerPageContext['next'],
  headers: Record<string, string>,
): Promise<boolean | null> => {
  const hasFenceCredential =
    Boolean(headers.Authorization) ||
    /(?:^|;\s*)access_token=/i.test(headers.Cookie ?? '');
  if (!hasFenceCredential) return false;

  const endpoint = sessionEndpoint(context);
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SESSION_CHECK_TIMEOUT_MS,
  );

  try {
    const response = await fetch(endpoint, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) return null;

    const user = (await response.json()) as { username?: unknown };
    return typeof user.username === 'string' && user.username.length > 0;
  } catch (error: unknown) {
    console.warn('Failed to verify the server-side user session:', error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

export const sessionRequestHeaders = (
  context: ServerPageContext['next'],
): Record<string, string> => {
  const headers: Record<string, string> = {};
  const cookieHeader = context.req.headers.cookie;
  const authorizationHeader = context.req.headers.authorization;

  if (typeof cookieHeader === 'string' && cookieHeader) {
    headers.Cookie = cookieHeader;
  }
  if (typeof authorizationHeader === 'string' && authorizationHeader) {
    headers.Authorization = authorizationHeader;
  } else {
    // Credentials login stores its token in a frontend-only cookie. Fence does
    // not recognize that cookie name, so SSR must send it as a Bearer token.
    // A Fence access_token takes precedence when both login modes coexist.
    const hasAccessToken = /(?:^|;\s*)access_token=/i.test(cookieHeader ?? '');
    if (!hasAccessToken) {
      const credentialsToken = cookieValue(cookieHeader, 'credentials_token');
      if (credentialsToken) {
        headers.Authorization = `Bearer ${credentialsToken}`;
      }
    }
  }

  return headers;
};

const calyprConfiguration = {
  id: 'calypr-landing-page',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/calyprLandingPage.json`,
  schema: LandingConfigurationSchema,
};

const sessionState = new WeakMap<ServerPageContext, Promise<boolean | null>>();

const loadSessionState = (context: ServerPageContext): Promise<boolean | null> => {
  const existing = sessionState.get(context);
  if (existing) return existing;

  const request = verifyAuthenticatedSession(
    context.next,
    sessionRequestHeaders(context.next),
  );
  sessionState.set(context, request);
  return request;
};

const loadCalyprNavigation = async (context: ServerPageContext) => {
  const navigation = await loadNavigationFromContext(context);
  const hasAuthenticatedSession = await loadSessionState(context);

  if (hasAuthenticatedSession === true) return navigation;

  return {
    ...navigation,
    headerProps: {
      ...navigation.headerProps,
      topBar: {
        ...navigation.headerProps.topBar,
        items: navigation.headerProps.topBar.items.filter(
          (item: { href: string }) => item.href !== '/git',
        ),
      },
    },
  };
};

export const CalyprPageGetServerSideProps =
  definePageLoader<CalyprLandingPageProps>({
    name: 'CALYPR',
    loadNavigation: loadCalyprNavigation,
    load: async (context) => ({
      configuration: (await context.config.load(calyprConfiguration)) as CalyprProps,
      hasAuthenticatedSession: await loadSessionState(context),
    }),
    fallback: () => ({
      configuration: null,
      hasAuthenticatedSession: null,
    }),
  });
