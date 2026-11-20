import { funnelApi, type useCoreDispatch } from '@gen3/core';
import type { LoomClient } from '@calypr/loom-ui';

type PublishArgs = Parameters<LoomClient['publish']>[0];
type Dispatch = ReturnType<typeof useCoreDispatch>;

const unknownStatus = (message: string) =>
  Object.assign(new Error(message), { code: 'PUBLICATION_STATUS_UNKNOWN' });

const pause = () => new Promise<void>((resolve) => window.setTimeout(resolve, 2000));

export async function publishDataframeThroughFunnel(
  dispatch: Dispatch,
  organization: string,
  project: string,
  principal: string,
  args: PublishArgs,
  report: (status: string, completedJobId?: string) => void,
  signal?: AbortSignal,
): Promise<unknown> {
  const scope = `/programs/${organization}/projects/${project}`;
  if (args.authResourcePath && args.authResourcePath !== scope) {
    throw new Error('Funnel dataframe publishing requires the project authorization scope.');
  }
  const key = JSON.stringify(['loom-funnel-publish', principal, organization, project, args.explorerId, args.receiptId]);
  signal?.throwIfAborted();
  let id = sessionStorage.getItem(key);
  if (!id) {
    report('Submitting dataframe publication…');
    const request = dispatch(funnelApi.endpoints.createFunnelTask.initiate({
      name: 'Publish dataframe',
      tags: {
        'calypr.publish-dataframe': JSON.stringify({
          organization,
          project,
          explorerId: args.explorerId,
          receiptId: args.receiptId,
        }),
      },
    }));
    try {
      id = (await request.unwrap()).id;
      sessionStorage.setItem(key, id);
    } finally {
      request.reset();
    }
  }
  const reportTask = (message: string) => report(`${message} Funnel job ${id}.`);
  reportTask('Publication submitted.');
  let consecutiveErrors = 0;
  let resultChecks = 0;
  for (;;) {
    signal?.throwIfAborted();
    const request = dispatch(funnelApi.endpoints.getFunnelTask.initiate(id, {
      subscribe: false,
      forceRefetch: true,
    }));
    const status = await request.unwrap().catch(() => undefined);
    signal?.throwIfAborted();
    if (!status) {
      reportTask('Reconnecting to Funnel.');
      if (++consecutiveErrors >= 5) {
        reportTask('Publication status unavailable. Select Publish to reconnect.');
        throw unknownStatus('Funnel status is temporarily unavailable. Select Publish again to reconnect to the existing task.');
      }
      await pause();
      continue;
    }
    consecutiveErrors = 0;
    if (status.state === 'COMPLETE') {
      if (status.publicationResult) {
        report('Dataframe published.', id);
        return status.publicationResult;
      }
      if (++resultChecks >= 5) {
        reportTask('Publication job completed. The Loom result is unavailable.');
        throw unknownStatus('Funnel finished, but the Loom publication result is unavailable. Check the Viewer for the active revision.');
      }
      reportTask('Publication job completed. Waiting for Loom’s result.');
      await pause();
      continue;
    }
    if (status.state === 'EXECUTOR_ERROR' || status.state === 'SYSTEM_ERROR' || status.state === 'CANCELED') {
      reportTask(status.state === 'CANCELED' ? 'Publication job canceled.' : 'Publication job failed.');
      sessionStorage.removeItem(key);
      throw new Error(status.errorMessage || `Funnel task ${id} ended in ${status.state}.`);
    }
    const progress = {
      UNKNOWN: 'Funnel has yet to report a publication job state.',
      QUEUED: 'Publication job queued.',
      INITIALIZING: 'Starting publication job.',
      RUNNING: 'Publication job running.',
      PAUSED: 'Publication job paused.',
    };
    reportTask(progress[status.state]);
    await pause();
  }
}
