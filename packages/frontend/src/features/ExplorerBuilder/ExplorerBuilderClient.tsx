import React, { useMemo } from 'react';
import {
  GEN3_LOOM_API,
  selectCSRFToken,
  selectUserDetails,
  useCoreSelector,
  type CoreState,
} from '@gen3/core';
import {
  createLoomClient,
  LoomExplorerBuilder,
  type LoomClient,
} from '@calypr/loom-ui';
import '@calypr/loom-ui/styles.css';
import { ProtectedContent } from '../../components/Protected';
import { createAuthenticatedLoomFetch } from '../ExplorerViewBuilder/authenticatedLoomClient';

export const ExplorerBuilderClient = ({
  organization,
  project,
  explorerId,
  onExplorerChange,
}: {
  readonly organization: string;
  readonly project: string;
  readonly explorerId?: string;
  readonly onExplorerChange?: (explorerId: string) => void;
}) => {
  const user = useCoreSelector((state: CoreState) => selectUserDetails(state));
  const principal =
    user.sub ?? user.username ?? user.email ?? String(user.id ?? 'anonymous');
  return (
    <ExplorerBuilderPageContent
      key={principal}
      organization={organization}
      project={project}
      explorerId={explorerId}
      onExplorerChange={onExplorerChange}
    />
  );
};

const ExplorerBuilderPageContent = ({
  organization,
  project,
  explorerId,
  onExplorerChange,
}: {
  readonly organization: string;
  readonly project: string;
  readonly explorerId?: string;
  readonly onExplorerChange?: (explorerId: string) => void;
}) => {
  const csrfToken = useCoreSelector((state: CoreState) => selectCSRFToken(state));
  const csrfTokenRef = React.useRef(csrfToken);
  csrfTokenRef.current = csrfToken;
  const client = useMemo<LoomClient>(
    () =>
      createLoomClient({
        baseUrl: GEN3_LOOM_API,
        credentials: 'include',
        fetch: createAuthenticatedLoomFetch(csrfTokenRef),
      }),
    [],
  );

  return (
    <ProtectedContent>
      <LoomExplorerBuilder
        client={client}
        organization={organization}
        project={project}
        explorerId={explorerId}
        onExplorerChange={onExplorerChange}
      />
    </ProtectedContent>
  );
};

export default ExplorerBuilderClient;
