import React from 'react';
import { ProtectedContent } from '../../components/Protected';
import BuilderWorkspace from './BuilderWorkspace';

/** ExplorerConfig V2 visual Builder. The graph, column catalog, preview, and
 * presentation controls all edit one typed packet. */
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
