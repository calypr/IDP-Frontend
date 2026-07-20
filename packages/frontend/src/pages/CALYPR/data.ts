import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME, GEN3_FENCE_API } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type CalyprProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

const SESSION_CHECK_TIMEOUT_MS = 12_000;

const firstHeaderValue = (
  value: string | string[] | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value);

const requestOrigin = (context: Parameters<GetServerSideProps>[0]): string => {
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
  context: Parameters<GetServerSideProps>[0],
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
  context: Parameters<GetServerSideProps>[0],
  headers: Record<string, string>,
): Promise<boolean | null> => {
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

export const CalyprPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (context) => {
  const requestHeaders: Record<string, string> = {};
  const cookieHeader = context.req.headers.cookie;
  const authorizationHeader = context.req.headers.authorization;
  if (typeof cookieHeader === 'string' && cookieHeader) {
    requestHeaders.Cookie = cookieHeader;
  }
  if (typeof authorizationHeader === 'string' && authorizationHeader) {
    requestHeaders.Authorization = authorizationHeader;
  }

  const navigationRequestHeaders = {
    ...requestHeaders,
    ...(context.req.headers.host ? { Host: context.req.headers.host } : {}),
  };

  const [hasAuthenticatedSession, calyprConfig, initialNavPageLayoutProps] =
    await Promise.all([
      verifyAuthenticatedSession(context, requestHeaders),
      ContentSource.getContentDatabase().get<CalyprProps>(
        `${GEN3_COMMONS_NAME}/calyprLandingPage.json`,
      ),
      getNavPageLayoutPropsFromConfig(navigationRequestHeaders),
    ]);

  let navPageLayoutProps = initialNavPageLayoutProps;
  if (hasAuthenticatedSession !== true) {
    const filteredItems = navPageLayoutProps.headerProps.topBar.items.filter(
      (item: { href: string }) => item.href !== '/git',
    );
    navPageLayoutProps = {
      ...navPageLayoutProps,
      headerProps: {
        ...navPageLayoutProps.headerProps,
        topBar: {
          ...navPageLayoutProps.headerProps.topBar,
          items: filteredItems,
        },
      },
    };
  }

  if (!navPageLayoutProps) {
    return { notFound: true };
  }

  return {
    props: {
      ...navPageLayoutProps,
      calyprConfig: calyprConfig ? calyprConfig : null,
      hasAuthenticatedSession,
    },
  };
};
