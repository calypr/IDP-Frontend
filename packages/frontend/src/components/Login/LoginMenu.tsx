import { useCallback } from 'react';
import { useRouter } from 'next/router';
import { showNotification } from '@mantine/notifications';
import LoginProvidersMenuPanel from './LoginProvidersMenuPanel';
import { GEN3_REDIRECT_URL } from '@gen3/core';

const filterRedirect = (redirect: string | string[] | undefined) => {
  let redirectPath = '';
  if (Array.isArray(redirect)) {
    redirectPath = redirect[0];
  } else {
    redirectPath = redirect ?? '/Explorer';
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

  return (
    <div className="grid grid-cols-6 w-full">
      <LoginProvidersMenuPanel handleLoginSelected={handleFenceLoginSelected} />
    </div>
  );
};

export default LoginMenu;
