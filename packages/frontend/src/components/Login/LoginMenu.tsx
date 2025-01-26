import { useCallback } from 'react';
import { useRouter } from 'next/router';
import { showNotification } from '@mantine/notifications';
import UserNavigationMenu from '../../components/Profile/UserNavigationMenu';
import LoginProvidersMenuPanel from './LoginProvidersMenuPanel';
import { GEN3_REDIRECT_URL } from '@gen3/core';
import {
  type CoreState,
  selectUserAuthStatus,
  useCoreSelector,
  isAuthenticated,
} from '@gen3/core';

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

const LoginMenu = () => {
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
    <div>
      {!authenticated ? (
        <LoginProvidersMenuPanel
          handleLoginSelected={handleFenceLoginSelected}
        />
      ) : (
        <UserNavigationMenu />
      )}
    </div>
  );
};

export default LoginMenu;
