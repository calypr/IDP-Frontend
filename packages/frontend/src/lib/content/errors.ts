export type ContentErrorKind = 'http' | 'transport' | 'parse' | 'filesystem';

export class ContentError extends Error {
  readonly kind: ContentErrorKind;
  readonly status: number;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly path?: string;
  readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      kind: ContentErrorKind;
      status: number;
      requestId?: string;
      retryable?: boolean;
      path?: string;
      cause?: unknown;
    },
  ) {
    super(message);
    this.name = 'ContentError';
    this.kind = options.kind;
    this.status = options.status;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? options.status >= 500;
    this.path = options.path;
    this.cause = options.cause;
  }
}

export const isContentError = (value: unknown): value is ContentError =>
  value instanceof ContentError;
