import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '../../lib/session/session';
import { Text } from '@mantine/core';
import { type JWTSessionStatus } from '@gen3/core';
import { LoginView } from '../Modals/LoginModal';

export interface ProtectedContentProps {
  children?: ReactNode;
}

import { useGetAuthzMappingsQuery } from '@gen3/core';
import { hasFenceAccess, NoAccessOverlay } from './NoAccessOverlay';

import { VerifyingAccessLoader } from './VerifyingAccessLoader';
import SessionFailureView from './SessionFailureView';
export { VerifyingAccessLoader };

const isAppHomePath = (path?: string): boolean =>
  path === '/' || Boolean(path?.startsWith('/Apps'));

const AccessGate = ({
  children,
  onBlocked,
}: ProtectedContentProps & { onBlocked: () => void }) => {
  const router = useRouter();
  const {
    data: authzMapping = {},
    isLoading: isAuthZLoading,
    isError: isAuthZError,
    refetch: refetchAuthz,
  } = useGetAuthzMappingsQuery();
  const hasAccess = hasFenceAccess(authzMapping);

  useEffect(() => {
    if (!isAuthZLoading && !isAuthZError) {
      if (!hasAccess) {
        onBlocked();
      } else {
        sessionStorage.setItem('hasVerifiedAccess', 'true');
      }
    }
  }, [hasAccess, isAuthZError, isAuthZLoading, onBlocked]);

  if (isAuthZLoading) {
    if (isAppHomePath(router.pathname)) {
      return <VerifyingAccessLoader />;
    }
    return null;
  }

  if (isAuthZError) {
    return (
      <SessionFailureView
        detail="Your session is valid, but Fence could not return a usable access mapping."
        onRetry={() => void refetchAuthz()}
      />
    );
  }

  if (!hasAccess) {
    return null; // Will unmount shortly because parent will pick up the blocked state
  }

  return <React.Fragment>{children}</React.Fragment>;
};

const ProtectedContent = ({ children }: ProtectedContentProps) => {
  const router = useRouter();
  const [stableStatus, setStableStatus] = useState<
    JWTSessionStatus | undefined
  >();
  const [isBlocked, setIsBlocked] = useState(false);

  const { status, pending } = useSession(true, () => {
    /* prevent redirect */
  });

  useEffect(() => {
    if (!pending && stableStatus !== status) {
      setStableStatus(status);
    }
  }, [status, pending, stableStatus]);

  const handleBlocked = React.useCallback(() => setIsBlocked(true), []);

  if (isBlocked) {
    return <NoAccessOverlay />;
  }

  if (stableStatus === 'issued') {
    return <AccessGate onBlocked={handleBlocked}>{children}</AccessGate>;
  }

  if (pending) {
    if (isAppHomePath(router.pathname)) {
      return <VerifyingAccessLoader />;
    }
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-auto bg-gray-100/95 px-4 py-8">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="bg-primary p-8">
          <Text className="text-white text-3xl font-bold font-heading text-center tracking-tight">
            Protected Content
          </Text>
        </div>
        <div className="p-4">
          <LoginView redirectPath={router.asPath} />
        </div>
        <div className="p-6 bg-gray-50/50 text-center border-t border-gray-100">
          <Text
            size="xs"
            className="text-gray-400 uppercase tracking-widest font-bold"
          >
            Gen3 Data Security Layer
          </Text>
        </div>
      </div>
    </div>
  );
};

export default ProtectedContent;
