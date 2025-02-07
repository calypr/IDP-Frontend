import React, { useCallback } from 'react';
import { useRouter } from 'next/router';
import { showNotification } from '@mantine/notifications';
import UserNavigationMenu from '../../components/Profile/UserNavigationMenu';
import LoginProvidersMenuPanel from './LoginProvidersMenuPanel';
import { StylingOverrideWithMergeControl } from '../../types';

import { GEN3_REDIRECT_URL } from '@gen3/core';
import {
  type CoreState,
  selectUserAuthStatus,
  useCoreSelector,
  isAuthenticated,
} from '@gen3/core';
import { UnstyledButton } from '@mantine/core';

const filterRedirect = (redirect: string | string[] | undefined) => {
  let redirectPath = '';
  if (Array.isArray(redirect)) {
    redirectPath = redirect[0];
  } else {
    redirectPath = redirect ?? '/Apps';
  }
  return GEN3_REDIRECT_URL
    ? `${GEN3_REDIRECT_URL}/${redirectPath}`
    : redirectPath;
};

const LoginMenu = ({
  frontBanner,
  classNames,
  children,
}: {
  frontBanner: boolean;
  classNames: StylingOverrideWithMergeControl;
  children?: React.ReactNode;
}) => {
  const router = useRouter();
  const {
    query: { referer },
  } = router;

  const handleFenceLoginSelected = useCallback(
    async (loginURL: string) => {
      router
        .push(`${loginURL}?redirect=${filterRedirect(referer)}`)
        .catch((e) => {
          showNotification({
            title: 'Login Error',
            message: `error logging in ${e.message}`,
          });
        });
    },
    [referer, router],
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
        />
      ) : frontBanner ? (
        <UnstyledButton className="mx-2" onClick={() => router.push('/Apps')}>
          <div className={classNames.label}> To Apps Page </div>
        </UnstyledButton>
      ) : (
        <UserNavigationMenu classNames={classNames} />
      )}
    </React.Fragment>
  );
};

export default LoginMenu;
