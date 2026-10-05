import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '../../lib/session/session';
import { VerifyingAccessLoader } from './VerifyingAccessLoader';
import { AccessGate } from './ProtectedContent';

/** Gate page mounting until Fence has resolved the browser session. */
export const AuthenticatedPage = ({ children }: { children: ReactNode }) => {
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
      >
        {children}
      </AccessGate>
    );
  }

  if (isPublicPage && router.isReady && !pending) {
    return <>{children}</>;
  }

  return <VerifyingAccessLoader />;
};
