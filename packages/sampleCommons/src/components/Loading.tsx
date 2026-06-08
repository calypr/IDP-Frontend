import React from 'react';
import { useRouter } from 'next/router';
import { VerifyingAccessLoader } from '@gen3/frontend';

const isAppHomePath = (path?: string): boolean =>
  path === '/' || Boolean(path?.startsWith('/Apps'));

const Loading = () => {
  const router = useRouter();
  const path =
    router?.pathname ||
    (typeof window !== 'undefined' ? window.location.pathname : '');

  // For the Apps portal, immediately show the Verifying Access spinner to perfectly match ProtectedContent.
  // We use this blue spinner for all loading states on this path to avoid "double spinners" or jumping
  // back to the grey one if access is already verified but other parts of the page are still loading.
  if (isAppHomePath(path)) {
    return <VerifyingAccessLoader />;
  }

  // Everywhere else, just return the default global grey spinner
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-base-darkest"></div>
    </div>
  );
};
export default Loading;
