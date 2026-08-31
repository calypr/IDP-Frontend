import React from 'react';
import { ProtectedContent } from '../../components/Protected';
import BuilderWorkspace from './BuilderWorkspace';

/** Native Loom authoring Builder. The established visual controls edit only
 * opaque catalog intent and emission-keyed presentation. */
export const ExplorerBuilderPage = ({
  organization,
  project,
  explorerId,
  onExplorerChange,
}: {
  readonly organization: string;
  readonly project: string;
  readonly explorerId?: string;
  readonly onExplorerChange?: (explorerId: string) => void;
}) => (
  <ProtectedContent>
    <BuilderWorkspace
      organization={organization}
      project={project}
      explorerId={explorerId}
      onExplorerChange={onExplorerChange}
    />
  </ProtectedContent>
);

export default ExplorerBuilderPage;
