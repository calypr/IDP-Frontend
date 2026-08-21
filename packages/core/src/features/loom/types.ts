import type {
  AggregationsData,
  HistogramDataArray,
  JSONObject,
} from '../../types';

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

/**
 * The only identity accepted by Loom dataframe operations.
 *
 * Materialization IDs and data types are server metadata/UI concepts, not
 * dataframe request selectors. Keeping this type strict prevents those
 * retired request shapes from re-entering through a new callsite.
 */
export interface DataframeSelector {
  readonly recipe: string;
  readonly translationVersion: string;
  readonly output: string;
}

/** Backwards-compatible name for consumers of the Loom-specific API. */
export type LoomDatasetSelector = DataframeSelector;

/** Build a dataframe selector only from an immutable server recipe identity. */
export const dataframeSelectorForRecipeOutput = (
  recipe: { readonly recipeName?: string; readonly translationVersion?: string; readonly outputs?: ReadonlyArray<unknown> },
  output: string,
): DataframeSelector => {
  const recipeName = recipe.recipeName?.trim();
  const translationVersion = recipe.translationVersion?.trim();
  if (!recipeName || !translationVersion || !output.trim()) {
    throw new Error('A server recipe name and translation version are required for a dataframe selector.');
  }
  return { recipe: recipeName, translationVersion, output: output.trim() };
};

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
  selector: DataframeSelector,
): LoomSelectorDiagnostic | undefined => {
  const recipe = typeof selector.recipe === 'string' ? selector.recipe.trim() : '';
  const translationVersion =
    typeof selector.translationVersion === 'string'
      ? selector.translationVersion.trim()
      : '';
  const output = typeof selector.output === 'string' ? selector.output.trim() : '';
  if (
    recipe &&
    translationVersion &&
    output
  ) {
    return undefined;
  }
  return {
    code: 'INVALID_DATASET_SELECTOR',
    message:
      'A Loom dataframe selector requires an exact recipe, translation version, and output.',
  };
};

export type LoomDatasetIdentity = {
  readonly selector: DataframeSelector;
  /**
   * Legacy compatibility field. Loom's dataframe GraphQL inputs do not accept
   * projectIds, so request builders intentionally never serialize this value.
   */
  readonly projectIds?: ReadonlyArray<string>;
};

export const loomDatasetIdentityKey = (
  identity: LoomDatasetIdentity,
): string =>
  [
    identity.selector.recipe,
    identity.selector.translationVersion,
    identity.selector.output,
  ].join('|');

export interface LoomDatasetRef {
  /** Logical output name used by the Explorer UI; server recipes may define custom outputs. */
  readonly dataType: string;
  /** Current immutable dataset identity used by dataframe operations. */
  readonly selector?: DataframeSelector;
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

export type LoomAggregationKind =
  | 'TERMS'
  | 'HISTOGRAM'
  | 'DATE_HISTOGRAM'
  | 'STATS'
  | 'MISSING';

/** A bounded, named aggregation supported by dataframeAggregations. */
export interface LoomAggregationSpec {
  readonly name: string;
  readonly kind: LoomAggregationKind;
  readonly column: string;
  readonly size?: number;
  readonly interval?: number;
  readonly dateInterval?: number;
  readonly excludeSelfFilter?: boolean;
}

export type LoomRichAggregationsRequest = LoomDatasetIdentity & {
  readonly specs: ReadonlyArray<LoomAggregationSpec>;
  readonly filters?: ReadonlyArray<LoomFilter>;
};

export interface LoomAggregationResult {
  readonly name: string;
  readonly kind: LoomAggregationKind;
  readonly data: HistogramDataArray;
  readonly missingCount: number;
  readonly truncated: boolean;
}

export interface LoomRichAggregationsResponse {
  readonly materialization: LoomDataset | null;
  readonly aggregations: Readonly<Record<string, LoomAggregationResult>>;
}

/** Rows plus an optional bounded facet batch for one selector/filter snapshot. */
export type LoomTableRenderRequest = LoomRowsRequest & {
  readonly facets?: ReadonlyArray<LoomAggregationSpec>;
};

export interface LoomTableRenderResponse extends LoomRowsResponse {
  readonly facets?: LoomRichAggregationsResponse;
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
  /** Select Loom's graph schema. Dataframe operations use the flat schema. */
  readonly schema?: 'flat' | 'graph';
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
  readonly fieldPath?: string | ReadonlyArray<string> | null;
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
