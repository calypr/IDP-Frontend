import React, { useMemo } from 'react';
import {
  GEN3_LOOM_API,
  fetchLoomResponse,
  handleUnauthorizedStatus,
  selectCSRFToken,
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

const calyprLoomFetch: typeof globalThis.fetch = async (input, init) => {
  const endpoint =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  const response = await fetchLoomResponse(endpoint, init);
  handleUnauthorizedStatus(response.status);
  return response;
};

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
  <ExplorerBuilderPageContent
    organization={organization}
    project={project}
    explorerId={explorerId}
    onExplorerChange={onExplorerChange}
  />
);

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
  const csrfToken = useCoreSelector((state: CoreState) =>
    selectCSRFToken(state),
  );
  const client = useMemo<LoomClient>(
    () =>
      createLoomClient({
        baseUrl: GEN3_LOOM_API,
        credentials: 'include',
        fetch: calyprLoomFetch,
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined,
      }),
    [csrfToken],
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

export default ExplorerBuilderPage;
