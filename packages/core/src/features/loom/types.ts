import type { AggregationsData, JSONObject } from '../../types';

export const LOOM_DATA_TYPES = [
  'Patient',
  'DocumentReference',
  'ResearchSubject',
  'Specimen',
  'MedicationAdministration',
  'GroupMember',
] as const;

export type LoomDataType = (typeof LOOM_DATA_TYPES)[number];

export const isLoomDataType = (value: string): value is LoomDataType =>
  (LOOM_DATA_TYPES as ReadonlyArray<string>).includes(value);

export interface LoomDatasetRef {
  readonly dataType: LoomDataType;
}

export interface LoomColumn {
  readonly name: string;
  readonly clickhouseType: string;
  readonly logicalType: string;
  readonly nullable: boolean;
  readonly repeated: boolean;
  readonly filterable: boolean;
  readonly sortable: boolean;
  readonly aggregatable: boolean;
}

export interface LoomDataset extends LoomDatasetRef {
  readonly id: string;
  readonly name: string;
  readonly revision: string;
  readonly state: 'PENDING' | 'LOADING' | 'READY' | 'FAILED' | string;
  readonly columns: ReadonlyArray<LoomColumn>;
  readonly rowCount: number;
  readonly createdAt: string;
  readonly readyAt?: string | null;
  readonly error?: string | null;
}

export interface LoomFilter {
  readonly column: string;
  readonly op: string;
  readonly value: unknown;
}

export interface LoomSort {
  readonly column: string;
  readonly desc?: boolean;
}

export interface LoomRowsRequest {
  readonly dataType: LoomDataType;
  readonly columns?: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<LoomFilter>;
  readonly sort?: LoomSort;
  readonly first?: number;
  readonly after?: string | null;
}

export interface LoomRowsResponse {
  readonly materialization: LoomDataset;
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<JSONObject>;
  readonly totalCount?: number | null;
  readonly pageInfo: {
    readonly hasNextPage: boolean;
    readonly endCursor?: string | null;
  };
}

export interface LoomAggregateRequest {
  readonly dataType: LoomDataType;
  readonly groupBy?: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<LoomFilter>;
  readonly operation: string;
  readonly column?: string;
}

export interface LoomAggregateResponse {
  readonly materialization: LoomDataset;
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<JSONObject>;
}

export interface LoomAggregationsRequest {
  readonly dataType: LoomDataType;
  readonly fields: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<LoomFilter>;
}

export interface LoomAggregationsResponse {
  readonly materialization: LoomDataset | null;
  readonly data: AggregationsData;
}

export interface LoomApiError {
  readonly status: number | 'CUSTOM_ERROR' | 'FETCH_ERROR';
  readonly httpStatus?: number;
  readonly data?: unknown;
  readonly error?: string;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable?: boolean;
  readonly fieldPath?: string | null;
}

export interface LoomQueryArgs {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
}

export interface LoomGraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: ReadonlyArray<LoomGraphQLError>;
}

export interface LoomGraphQLError {
  readonly message: string;
  readonly locations?: ReadonlyArray<{
    readonly line: number;
    readonly column: number;
  }>;
  readonly path?: ReadonlyArray<string | number>;
  readonly extensions?: LoomGraphQLErrorExtensions;
}

export interface LoomGraphQLErrorExtensions {
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable?: boolean;
  readonly fieldPath?: string | null;
  readonly [key: string]: unknown;
}

export interface LoomRequestMeta {
  readonly endpoint: string;
  readonly status?: number;
  readonly requestId?: string;
}

export interface LoomGraphQLRequestErrorOptions {
  readonly status: number | 'CUSTOM_ERROR' | 'FETCH_ERROR';
  readonly message: string;
  readonly data?: unknown;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable?: boolean;
  readonly fieldPath?: string | null;
  readonly httpStatus?: number;
  readonly meta?: LoomRequestMeta;
  readonly cause?: unknown;
}

export class LoomGraphQLRequestError extends Error implements LoomApiError {
  readonly status: number | 'CUSTOM_ERROR' | 'FETCH_ERROR';
  readonly data?: unknown;
  readonly code?: string;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly fieldPath?: string | null;
  readonly httpStatus?: number;
  readonly meta?: LoomRequestMeta;
  readonly isLoomGraphQLRequestError = true;

  constructor(options: LoomGraphQLRequestErrorOptions) {
    super(options.message);
    this.name = 'LoomGraphQLRequestError';
    this.status = options.status;
    this.data = options.data;
    this.code = options.code;
    this.requestId = options.requestId;
    this.retryable = options.retryable ?? false;
    this.fieldPath = options.fieldPath;
    this.httpStatus = options.httpStatus;
    this.meta = options.meta;

    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }
}

export const isLoomGraphQLRequestError = (
  error: unknown,
): error is LoomGraphQLRequestError =>
  error instanceof LoomGraphQLRequestError ||
  (typeof error === 'object' &&
    error !== null &&
    'isLoomGraphQLRequestError' in error &&
    (error as { isLoomGraphQLRequestError?: unknown })
      .isLoomGraphQLRequestError === true);

export interface LoomRequestOptions {
  readonly endpoint?: string;
  readonly headers?: HeadersInit;
  readonly signal?: AbortSignal;
}
