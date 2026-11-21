import { NavPageLayout } from '../../features/Navigation';
import LoginPanel from '../../components/Login/LoginPanel';
import React from 'react';
import { LoginPageLayoutProps } from './types';

const LoginPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: LoginPageLayoutProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
      headerMetadata={{
        title: 'Gen3 Login Page',
        content: 'Login page',
        key: 'gen3-login-page',
        ...(configuration?.headerMetadata ? configuration.headerMetadata : {}),
      }}
    >
      {configuration && <LoginPanel {...configuration} />}
    </NavPageLayout>
  );
};

export default LoginPage;
