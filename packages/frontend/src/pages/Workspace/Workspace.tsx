import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import Workspace from '../../features/Workspace/Workspace';
import { WorkspacePageProps } from './types';

const WorkspacePage = ({
  headerProps,
  footerProps,
  configuration,
  pageProblems,
}: WorkspacePageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      layoutMode="viewport"
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Workspace Page',
        content: 'Workspace page',
        key: 'gen3-workspace-page',
        ...(configuration?.headerMetadata
          ? configuration.headerMetadata
          : {}),
      }}
    >
      <Workspace configuration={configuration} />
    </NavPageLayout>
  );
};

export default WorkspacePage;
