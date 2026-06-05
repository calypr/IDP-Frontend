import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type CalyprProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const CalyprPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (context) => {
  const requestHeaders: Record<string, string> = {};
  const cookieHeader = context.req.headers.cookie;
  const authorizationHeader = context.req.headers.authorization;
  const hasAuthenticatedSession =
    (typeof authorizationHeader === 'string' &&
      authorizationHeader.length > 0) ||
    (typeof cookieHeader === 'string' &&
      /(?:^|;\s*)(?:access_token|credentials_token)=/i.test(cookieHeader));

  if (typeof cookieHeader === 'string' && cookieHeader) {
    requestHeaders.Cookie = cookieHeader;
  }
  if (typeof authorizationHeader === 'string' && authorizationHeader) {
    requestHeaders.Authorization = authorizationHeader;
  }

  const calyprConfig: CalyprProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/calyprLandingPage.json`,
    );

  let navPageLayoutProps =
    await getNavPageLayoutPropsFromConfig(requestHeaders);
  if (!hasAuthenticatedSession) {
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
