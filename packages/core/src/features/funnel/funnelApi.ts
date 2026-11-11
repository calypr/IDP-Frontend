import { gen3Api } from '../gen3';

export type FunnelTaskState =
  | 'UNKNOWN'
  | 'QUEUED'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETE'
  | 'EXECUTOR_ERROR'
  | 'SYSTEM_ERROR'
  | 'CANCELED';

export interface FunnelTaskCreated {
  readonly id: string;
}

export interface FunnelTaskStatus extends FunnelTaskCreated {
  readonly state: FunnelTaskState;
  readonly errorMessage?: string;
}

export interface CreateFunnelTaskRequest {
  readonly name: string;
  readonly tags: Readonly<Record<string, string>>;
}

const funnelTaskStates: ReadonlyArray<FunnelTaskState> = [
  'UNKNOWN',
  'QUEUED',
  'INITIALIZING',
  'RUNNING',
  'PAUSED',
  'COMPLETE',
  'EXECUTOR_ERROR',
  'SYSTEM_ERROR',
  'CANCELED',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFunnelTaskState = (value: unknown): value is FunnelTaskState =>
  typeof value === 'string' &&
  funnelTaskStates.some((state) => state === value);

const parseTaskId = (response: unknown): FunnelTaskCreated => {
  if (
    !isRecord(response) ||
    typeof response.id !== 'string' ||
    response.id.trim().length === 0
  ) {
    throw new Error('Funnel task response did not include a task ID.');
  }

  return { id: response.id };
};

export const parseTaskStatus = (response: unknown): FunnelTaskStatus => {
  const task = parseTaskId(response);
  if (!isRecord(response) || !isFunnelTaskState(response.state)) {
    throw new Error('Funnel task response included an unknown task state.');
  }

  const messages: string[] = [];
  const systemMessages: string[] = [];
  if (Array.isArray(response.logs)) {
    for (const run of response.logs) {
      if (!isRecord(run)) continue;
      if (Array.isArray(run.logs)) {
        for (const executor of run.logs) {
          if (!isRecord(executor)) continue;
          for (const output of [executor.stderr, executor.stdout]) {
            if (typeof output === 'string' && output.trim()) {
              messages.push(output.trim());
            }
          }
        }
      }
      if (Array.isArray(run.system_logs)) {
        for (const entry of run.system_logs) {
          if (typeof entry === 'string' && entry.includes("level='error'")) {
            systemMessages.push(entry);
          }
        }
      }
    }
  }
  const failed =
    response.state === 'EXECUTOR_ERROR' || response.state === 'SYSTEM_ERROR';
  const output = messages.length > 0 ? messages : systemMessages;
  return {
    ...task,
    state: response.state,
    errorMessage:
      failed && output.length > 0
        ? output.join('\n').slice(0, 16_384)
        : undefined,
  };
};

export const funnelApi = gen3Api.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === 'development',
  endpoints: (builder) => ({
    createFunnelTask: builder.mutation<
      FunnelTaskCreated,
      CreateFunnelTaskRequest
    >({
      query: (body) => ({
        url: '/funnel/v1/tasks',
        method: 'POST',
        body,
        credentials: 'include',
      }),
      transformResponse: parseTaskId,
    }),
    getFunnelTask: builder.query<FunnelTaskStatus, string>({
      query: (id) => ({
        url: `/funnel/v1/tasks/${encodeURIComponent(id)}?view=FULL`,
        method: 'GET',
        credentials: 'include',
      }),
      transformResponse: parseTaskStatus,
    }),
  }),
});

export const { useCreateFunnelTaskMutation, useGetFunnelTaskQuery } = funnelApi;
