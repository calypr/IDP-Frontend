import { ZodError } from 'zod';
import { isContentError } from '../content/errors';
import type {
  PageLoadProblem,
  PageProblemSeverity,
  PageProblemSource,
} from './types';

type ErrorMetadata = {
  status?: number | 'CUSTOM_ERROR' | 'FETCH_ERROR';
  code?: string;
  requestId?: string;
  retryable?: boolean;
  fieldPath?: string | null;
  isLoomGraphQLRequestError?: boolean;
};

const safeMessage = (message: string) =>
  message
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/([?&](?:token|access_token|code)=)[^&\s]+/gi, '$1[redacted]');

export const toSerializablePageProblem = (
  problem: PageLoadProblem,
): PageLoadProblem => ({
  severity: problem.severity,
  source: problem.source,
  status: problem.status,
  message: problem.message,
  retryable: problem.retryable,
  ...(problem.code === undefined ? {} : { code: problem.code }),
  ...(problem.requestId === undefined
    ? {}
    : { requestId: problem.requestId }),
  ...(problem.configPath === undefined
    ? {}
    : { configPath: problem.configPath }),
  ...(problem.issues === undefined ? {} : { issues: problem.issues }),
});

export const normalizePageProblem = (
  error: unknown,
  options: {
    source: PageProblemSource;
    severity?: PageProblemSeverity;
    configPath?: string;
  },
): PageLoadProblem => {
  if (error instanceof ZodError) {
    return toSerializablePageProblem({
      severity: options.severity ?? 'error',
      source: 'config',
      status: 500,
      message: `Configuration validation failed${options.configPath ? ` for ${options.configPath}` : ''}`,
      retryable: false,
      configPath: options.configPath,
      issues: error.issues.map((issue) => ({
        path: issue.path.length ? `$.${issue.path.join('.')}` : '$',
        message: issue.message,
      })),
    });
  }

  if (isContentError(error)) {
    return toSerializablePageProblem({
      severity: options.severity ?? 'error',
      source: options.source,
      status: error.status,
      message: safeMessage(error.message),
      requestId: error.requestId,
      retryable: error.retryable,
      configPath: options.configPath ?? error.path,
    });
  }

  if (
    error instanceof Error &&
    /ConfigurationError$/.test(error.name) &&
    'issues' in error &&
    Array.isArray(error.issues)
  ) {
    return toSerializablePageProblem({
      severity: options.severity ?? 'error',
      source: 'config',
      status: 500,
      message: safeMessage(error.message),
      retryable: false,
      configPath: options.configPath,
      issues: error.issues
        .filter(
          (issue): issue is { path: string; message: string } =>
            typeof issue === 'object' &&
            issue !== null &&
            'path' in issue &&
            typeof issue.path === 'string' &&
            'message' in issue &&
            typeof issue.message === 'string',
        )
        .map((issue) => ({
          path: issue.path.startsWith('$') ? issue.path : `$.${issue.path}`,
          message: issue.message,
        })),
    });
  }

  const metadata =
    typeof error === 'object' && error !== null
      ? (error as ErrorMetadata)
      : undefined;
  const rawStatus = metadata?.status;
  const code = metadata?.code;
  const status =
    code === 'BACKEND_UNAVAILABLE'
      ? 503
      : typeof rawStatus === 'number'
        ? rawStatus
        : 502;
  const message =
    error instanceof Error ? error.message : 'An unexpected server error occurred';

  return toSerializablePageProblem({
    severity: options.severity ?? 'error',
    source: metadata?.isLoomGraphQLRequestError ? 'loom' : options.source,
    status,
    message: safeMessage(message),
    code,
    requestId: metadata?.requestId,
    retryable:
      metadata?.retryable ??
      (code === 'BACKEND_UNAVAILABLE' || status >= 500),
    configPath: options.configPath,
  });
};
