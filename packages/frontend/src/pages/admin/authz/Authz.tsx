import React from 'react';
import { NavPageLayout } from '../../../features/Navigation';
import { Gen3Authz, type Authz } from '../../../features/Authz';
import type { PageProps } from '../../../lib/pageLoader';

interface Props extends PageProps {
  configuration: Authz | null;
}

const AuthzPage = ({ headerProps, footerProps, configuration, pageProblems }: Props) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerProps={headerProps}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Authz Editor Page',
        content: 'Authz Editor page',
        key: 'gen3-authz-editor-page',
      }}
    >
      {configuration && <Gen3Authz authz={configuration} />}
    </NavPageLayout>
  );
};

export default AuthzPage;
