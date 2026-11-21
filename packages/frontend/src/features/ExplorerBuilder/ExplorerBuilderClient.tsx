import React, { useMemo } from 'react';
import {
  GEN3_LOOM_API,
  selectCSRFToken,
  selectUserDetails,
  useCoreSelector,
  useCoreDispatch,
  type CoreState,
} from '@gen3/core';
import {
  createLoomClient,
  LoomExplorerBuilder,
  type LoomClient,
} from '@calypr/loom-ui';
import '@calypr/loom-ui/styles.css';
import { publishDataframeThroughFunnel } from './funnelPublication';
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
      key={JSON.stringify([principal, organization, project])}
      principal={principal}
      organization={organization}
      project={project}
      explorerId={explorerId}
      onExplorerChange={onExplorerChange}
    />
  );
};

const ExplorerBuilderPageContent = ({
  principal,
  organization,
  project,
  explorerId,
  onExplorerChange,
}: {
  readonly principal: string;
  readonly organization: string;
  readonly project: string;
  readonly explorerId?: string;
  readonly onExplorerChange?: (explorerId: string) => void;
}) => {
  const dispatch = useCoreDispatch();
  const [publishStatus, setPublishStatus] = React.useState<{
    message: string;
    completedJobId?: string;
  }>();
  const reportPublishStatus = React.useCallback((message: string, completedJobId?: string) => {
    const status = { message, completedJobId };
    setPublishStatus(status);
    if (completedJobId) {
      window.setTimeout(() => {
        setPublishStatus((current) => current === status ? undefined : current);
      }, 8000);
    }
  }, []);
  const useFunnelPublish = process.env.NEXT_PUBLIC_LOOM_FUNNEL_PUBLISH === 'true';
  const csrfToken = useCoreSelector((state: CoreState) => selectCSRFToken(state));
  const csrfTokenRef = React.useRef(csrfToken);
  csrfTokenRef.current = csrfToken;
  const client = useMemo<LoomClient>(
    () =>
      createLoomClient({
        baseUrl: GEN3_LOOM_API,
        credentials: 'include',
        fetch: createAuthenticatedLoomFetch(csrfTokenRef),
        ...(useFunnelPublish ? {
          publishTransport: (args: Parameters<LoomClient['publish']>[0], signal?: AbortSignal) =>
            publishDataframeThroughFunnel(dispatch, organization, project, principal, args, reportPublishStatus, signal),
        } : {}),
      }),
    [dispatch, organization, principal, project, reportPublishStatus, useFunnelPublish],
  );

  return (
    <ProtectedContent>
      {publishStatus?.completedJobId ? (
        <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100%-2rem)] items-center gap-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950 shadow-md">
          <div className="min-w-0">
            <p role="status">{publishStatus.message}</p>
            <a
              href={`/funnel/v1/tasks/${encodeURIComponent(publishStatus.completedJobId)}?view=FULL`}
              target="_blank"
              rel="noopener noreferrer"
              className="break-all underline"
            >
              Funnel job {publishStatus.completedJobId}
            </a>
          </div>
          <button
            type="button"
            className="rounded px-2 text-lg leading-none hover:bg-green-100"
            aria-label="Dismiss publication notification"
            onClick={() => setPublishStatus(undefined)}
          >
            ×
          </button>
        </div>
      ) : publishStatus ? (
        <p role="status" className="px-4 py-1 text-sm text-slate-600">
          {publishStatus.message}
        </p>
      ) : null}
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
