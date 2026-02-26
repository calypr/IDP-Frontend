import React, { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from '../../lib/session/session';
import { Loader, Text } from '@mantine/core';
import {
  type JWTSessionStatus,
} from '@gen3/core';
import { LoginView } from '../Modals/LoginModal';

import Custom403Page from '../../pages/403/Custom403Page';

export interface ProtectedContentProps {
  children?: ReactNode;
  errorStatus?: number;
}

const ProtectedContent = ({ children, errorStatus }: ProtectedContentProps) => {
  const router = useRouter();
  const [stableStatus, setStableStatus] = useState<
    JWTSessionStatus | undefined
  >();

  const { status, pending } = useSession(true, () => {
    /* prevent redirect */
  });

  useEffect(() => {
    if (!pending && stableStatus !== status) {
      setStableStatus(status);
    }
  }, [status, pending, stableStatus]);

  if (stableStatus === 'issued') {
    if (errorStatus === 403) {
      return <Custom403Page />;
    }
    return <React.Fragment>{children}</React.Fragment>;
  }

  if (pending) {
    return (
      <div className="flex justify-center w-full mt-10">
        <Loader />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-zinc-900/60 py-12 px-4 backdrop-blur-md">
      <div className="max-w-xl w-full bg-white shadow-2xl rounded-2xl overflow-hidden transition-all scale-110">
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
