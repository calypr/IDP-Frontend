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
  readonly data?: unknown;
  readonly error?: string;
  readonly code?: string;
}

export interface LoomQueryArgs {
  readonly query: string;
  readonly variables?: Record<string, unknown>;
}

export interface LoomGraphQLResponse<T> {
  readonly data?: T;
  readonly errors?: ReadonlyArray<{
    readonly message: string;
    readonly extensions?: { readonly code?: string };
  }>;
}

export interface LoomRequestOptions {
  readonly endpoint?: string;
  readonly headers?: Record<string, string>;
  readonly signal?: AbortSignal;
}
