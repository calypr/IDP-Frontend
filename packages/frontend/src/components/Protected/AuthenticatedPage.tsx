import React, { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '../../lib/session/session';
import { VerifyingAccessLoader } from './VerifyingAccessLoader';

/** Gate page mounting until Fence has resolved the browser session. */
export const AuthenticatedPage = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const { status, pending } = useSession();
  const isPublicPage = router.pathname === '/';

  useEffect(() => {
    if (!router.isReady || isPublicPage || pending || status === 'issued') {
      return;
    }

    // Keep the requested in-app path for the login link on the public home page.
    const referer = router.asPath.startsWith('/') && !router.asPath.startsWith('//')
      ? router.asPath
      : '/';
    void router.replace({ pathname: '/', query: { referer } });
  }, [router, router.isReady, router.asPath, isPublicPage, pending, status]);

  if (isPublicPage || (router.isReady && !pending && status === 'issued')) {
    return <>{children}</>;
  }

  return <VerifyingAccessLoader />;
};
