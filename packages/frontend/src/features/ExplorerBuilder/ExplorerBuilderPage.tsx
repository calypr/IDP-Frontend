import React from 'react';
import { ProtectedContent } from '../../components/Protected';
import BuilderWorkspace from './BuilderWorkspace';

/** Native Loom authoring Builder. The established visual controls edit only
 * opaque catalog intent and emission-keyed presentation. */
export const ExplorerBuilderPage = ({
  organization,
  project,
}: {
  readonly organization: string;
  readonly project: string;
}) => (
  <ProtectedContent>
    <BuilderWorkspace organization={organization} project={project} />
  </ProtectedContent>
);

export default ExplorerBuilderPage;
