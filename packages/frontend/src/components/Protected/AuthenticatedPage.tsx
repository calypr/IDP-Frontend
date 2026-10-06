import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '../../lib/session/session';
import { AccessGate } from './ProtectedContent';
import { VerifyingAccessLoader } from './VerifyingAccessLoader';
import {
  useGetAuthzMappingsQuery,
  useGetGeckoProjectsQuery,
  useGetGeckoProjectSummaryQuery,
} from '@gen3/core';
import { hasFenceAccess } from './NoAccessOverlay';

const HomeCatalogGate = ({
  children,
  onReady,
}: {
  children: ReactNode;
  onReady?: () => void;
}) => {
  const { isLoading: isProjectsLoading } = useGetGeckoProjectsQuery();
  const { isLoading: isSummaryLoading } = useGetGeckoProjectSummaryQuery();

  useEffect(() => {
    if (!isProjectsLoading && !isSummaryLoading) onReady?.();
  }, [isProjectsLoading, isSummaryLoading, onReady]);

  return isProjectsLoading || isSummaryLoading ? null : <>{children}</>;
};

/** Gate page mounting until Fence has resolved the browser session. */
export const AuthenticatedPage = ({
  children,
  onHomeReady,
}: {
  children: ReactNode;
  onHomeReady?: () => void;
}) => {
  const router = useRouter();
  const { status, pending } = useSession();
  const isPublicPage = router.pathname === '/';
  const isProjectPage = router.pathname.startsWith(
    '/org/[org]/project/[project]',
  );
  const organization =
    typeof router.query?.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query?.project === 'string' ? router.query.project : '';
  const projectRouteReady = !isProjectPage || Boolean(organization && project);
  const checkHomeAccess = isPublicPage && router.isReady && !pending && status === 'issued';
  const {
    data: authzMapping,
    isLoading: isAuthzLoading,
    isError: isAuthzError,
  } = useGetAuthzMappingsQuery(undefined, { skip: !checkHomeAccess });
  const hasAccess = hasFenceAccess(authzMapping);
  const homeReady =
    isPublicPage &&
    router.isReady &&
    !pending &&
    (status !== 'issued' ||
      (!isAuthzLoading &&
        (isAuthzError ||
          (authzMapping !== undefined && !hasAccess))));

  useEffect(() => {
    if (homeReady) onHomeReady?.();
  }, [homeReady, onHomeReady]);

  useEffect(() => {
    if (!router.isReady || isPublicPage || pending || status === 'issued') {
      return;
    }

    // Keep the requested in-app path for the login link on the public home page.
    const referer =
      router.asPath.startsWith('/') && !router.asPath.startsWith('//')
        ? router.asPath
        : '/';
    void router.replace({ pathname: '/', query: { referer } });
  }, [router, router.isReady, router.asPath, isPublicPage, pending, status]);

  if (router.isReady && projectRouteReady && !pending && status === 'issued') {
    return (
      <AccessGate
        projectScope={isProjectPage ? { organization, project } : undefined}
        showLoadingIndicator={!isPublicPage}
      >
        {isPublicPage ? (
          <HomeCatalogGate onReady={onHomeReady}>{children}</HomeCatalogGate>
        ) : (
          children
        )}
      </AccessGate>
    );
  }

  if (isPublicPage && router.isReady && !pending) {
    return <>{children}</>;
  }

  return status === 'issued' && !isPublicPage ? (
    <VerifyingAccessLoader />
  ) : null;
};
