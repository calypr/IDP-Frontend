import React from 'react';
import { WorkspaceConfig } from './types';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import WorkspaceProvider from './WorkspaceProvider';
import WorkspaceStatusProvider from './WorkspaceStatusProvider';
import WorkspaceNotebookPanelWithControls from './WorkspaceNotebookPanelWithControls';

interface WorkspaceProps {
  configuration: WorkspaceConfig | null;
}

const Workspace = ({ configuration }: WorkspaceProps) => {
  if (!configuration) return null;

  return (
    <ProtectedContent>
      <WorkspaceProvider config={configuration}>
        <WorkspaceStatusProvider>
          <div className="flex min-h-0 h-full w-full flex-1 flex-col relative">
            <WorkspaceNotebookPanelWithControls />
          </div>
        </WorkspaceStatusProvider>
      </WorkspaceProvider>
    </ProtectedContent>
  );
};

export default Workspace;
