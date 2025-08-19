import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import { WorkspacesPanel } from '../../features/Workspace';
import { WorkspacePageLayoutProps } from './types';

const WorkspacesPage = ({
  headerProps,
  footerProps,
  workspaceProps,
}: WorkspacePageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Gen3 Workspace Page',
        content: 'Workspace page',
        key: 'gen3-workspace-page',
      }}
    >
      <WorkspacesPanel />
    </NavPageLayout>
  );
};

export default WorkspacesPage;
