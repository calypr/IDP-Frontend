import React from 'react';
import {
  GEN3_WORKSPACE_API,
  selectActiveWorkspaceStatus,
  useCoreSelector,
  WorkspaceStatus,
} from '@gen3/core';

const WorkspaceNotebook = () => {
  const currentWorkspaceStatus = useCoreSelector(selectActiveWorkspaceStatus);

  if (currentWorkspaceStatus !== WorkspaceStatus.Running) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col content-center items-center">
      <iframe
        className="h-full min-h-0 w-full flex-1 border-8"
        title="Workspace"
        src={`${GEN3_WORKSPACE_API}/proxy/`}
      />
    </div>
  );
};

export default WorkspaceNotebook;
