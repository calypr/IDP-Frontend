import React, { useCallback } from 'react';
import { useRouter } from 'next/router';
import { showNotification } from '@mantine/notifications';
import UserNavigationMenu from '../../components/Profile/UserNavigationMenu';
import LoginProvidersMenuPanel from './LoginProvidersMenuPanel';
import { StylingOverrideWithMergeControl } from '../../types';

import {
  type CoreState,
  selectUserAuthStatus,
  useCoreSelector,
  isAuthenticated,
} from '@gen3/core';
import { UnstyledButton } from '@mantine/core';
import { appendParameterToUrl } from './utils';
import { safeRedirect } from './safeRedirect';

const LoginMenu = ({
  frontBanner,
  classNames,
  zIndex,
  redirectPath: explicitRedirectPath,
  children,
}: {
  frontBanner: boolean;
  classNames: StylingOverrideWithMergeControl;
  zIndex?: number;
  redirectPath?: string;
  children?: React.ReactNode;
}) => {
  const router = useRouter();
  const {
    query: { referer },
  } = router;

  const handleFenceLoginSelected = useCallback(
    async (loginURL: string) => {
      const targetRedirect = explicitRedirectPath || referer;
      router
        .push(
          appendParameterToUrl(
            loginURL,
            'redirect',
            safeRedirect(targetRedirect),
          ),
        )
        .catch((e) => {
          showNotification({
            title: 'Login Error',
            message: `error logging in ${e.message}`,
          });
        });
    },
    [explicitRedirectPath, referer, router],
  );
  const userStatus = useCoreSelector((state: CoreState) =>
    selectUserAuthStatus(state),
  );
  const authenticated = isAuthenticated(userStatus);

  return (
    <React.Fragment>
      {!authenticated ? (
        <LoginProvidersMenuPanel
          classNames={classNames}
          handleLoginSelected={handleFenceLoginSelected}
          zIndex={zIndex}
        />
      ) : frontBanner ? (
        <UnstyledButton className="mx-2" onClick={() => router.push('/Apps')}>
          <div className={classNames.label}> Open CALYPR </div>
        </UnstyledButton>
      ) : (
        <UserNavigationMenu classNames={classNames} />
      )}
    </React.Fragment>
  );
};

export default LoginMenu;
