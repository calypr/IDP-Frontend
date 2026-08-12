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

export interface LoomDatasetSelector {
  readonly recipe: string;
  readonly translationVersion: string;
  readonly output: string;
  readonly materializationId?: string;
}

export interface LoomSelectorDiagnostic {
  readonly code: 'UNSUPPORTED_LEGACY_OUTPUT' | 'INVALID_DATASET_SELECTOR';
  readonly message: string;
  readonly configPath?: string;
}

const LEGACY_LOOM_OUTPUTS: Readonly<Record<string, string>> = {
  file: 'DocumentReference',
  document_reference: 'DocumentReference',
  research_subject: 'ResearchSubject',
  specimen: 'Specimen',
  medication_administration: 'MedicationAdministration',
  group_member: 'GroupMember',
};

/** Normalizes only the legacy aliases. Arbitrary PascalCase output names pass through. */
export const normalizeLegacyLoomOutput = (
  value: string,
): {
  readonly output?: string;
  readonly diagnostic?: LoomSelectorDiagnostic;
} => {
  const output =
    LEGACY_LOOM_OUTPUTS[value] ??
    (/^[A-Z][A-Za-z0-9]*$/.test(value) ? value : undefined);
  return output
    ? { output }
    : {
        diagnostic: {
          code: 'UNSUPPORTED_LEGACY_OUTPUT',
          message: `Unsupported Loom output: ${value}`,
        },
      };
};

export const validateLoomDatasetSelector = (
  selector: LoomDatasetSelector,
): LoomSelectorDiagnostic | undefined => {
  if (selector.materializationId?.trim()) return undefined;
  if (
    selector.recipe.trim() &&
    selector.translationVersion.trim() &&
    selector.output.trim()
  ) {
    return undefined;
  }
  return {
    code: 'INVALID_DATASET_SELECTOR',
    message:
      'A Loom selector requires a materialization ID or an exact recipe, translation version, and output.',
  };
};

export type LoomDatasetIdentity =
  | { readonly dataType: LoomDataType; readonly selector?: never; readonly materializationId?: never }
  | { readonly dataType?: never; readonly selector: LoomDatasetSelector; readonly materializationId?: never }
  | { readonly dataType?: never; readonly selector?: never; readonly materializationId: string };

export const loomDatasetIdentityKey = (
  identity: LoomDatasetIdentity,
): string =>
  identity.selector
    ? [
        identity.selector.recipe,
        identity.selector.translationVersion,
        identity.selector.output,
        identity.selector.materializationId ?? '',
      ].join('|')
    : identity.materializationId
      ? `materialization|${identity.materializationId}`
      : `legacy|${identity.dataType}`;

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

export type LoomRowsRequest = LoomDatasetIdentity & {
  readonly columns?: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<LoomFilter>;
  readonly sort?: LoomSort;
  readonly first?: number;
  readonly after?: string | null;
};

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

export type LoomAggregateRequest = LoomDatasetIdentity & {
  readonly groupBy?: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<LoomFilter>;
  readonly operation: string;
  readonly column?: string;
};

export interface LoomAggregateResponse {
  readonly materialization: LoomDataset;
  readonly columns: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<JSONObject>;
}

export type LoomAggregationsRequest = LoomDatasetIdentity & {
  readonly fields: ReadonlyArray<string>;
  readonly filters?: ReadonlyArray<LoomFilter>;
};

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
