import type {
  LoomAggregationKind,
  LoomAggregationResult,
  LoomAggregationSpec,
  LoomDatasetIdentity,
  LoomFilter,
} from './types';
import { loomDatasetIdentityKey } from './types';

export type LoomFacetDemandMode = 'eager' | 'lazy' | 'disabled';

export const DEFAULT_LOOM_FACET_SIZE = 50;
export const DEFAULT_LOOM_EAGER_FACET_LIMIT = 12;

export interface LoomFacetPolicyInput {
  readonly field: string;
  readonly facetType?: string;
  readonly demand?: LoomFacetDemandMode;
  readonly kind?: LoomAggregationKind;
  readonly size?: number;
  readonly interval?: number;
  readonly dateInterval?: number;
  readonly excludeSelfFilter?: boolean;
  readonly filterable?: boolean;
  readonly aggregatable?: boolean;
}

export interface LoomFacetPlan {
  readonly specs: ReadonlyArray<LoomAggregationSpec>;
  readonly eagerFields: ReadonlyArray<string>;
  readonly lazyFields: ReadonlyArray<string>;
  readonly disabledFields: ReadonlyArray<string>;
}

const FACET_TYPES_WITH_EAGER_TERMS = new Set([
  'enum',
  'exact',
  'multiselect',
  'toggle',
]);

const FACET_TYPES_WITH_LAZY_DATA = new Set([
  'range',
  'age',
  'year',
  'years',
  'days',
  'percent',
  'datetime',
]);

const stableJson = (value: unknown): string => {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value as Record<string, unknown>)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
};

const hash = (value: string): string => {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(16).padStart(8, '0');
};

const canonicalCollection = (value: unknown): unknown => {
  if (!Array.isArray(value)) return value;
  return [...value].sort((left, right) =>
    stableJson(left).localeCompare(stableJson(right)),
  );
};

/** Normalize filters in the same way Loom keys aggregate work. */
export const canonicalizeLoomFilters = (
  filters: ReadonlyArray<LoomFilter> = [],
): ReadonlyArray<LoomFilter> =>
  filters
    .map((filter) => {
      const op = filter.op.trim().toUpperCase();
      return {
        ...filter,
        column: filter.column.trim(),
        op,
        value:
          op === 'IN' || op === 'NOT_IN' || op === 'ARRAY_OVERLAPS'
            ? canonicalCollection(filter.value)
            : filter.value,
      };
    })
    .sort((left, right) =>
      stableJson(left).localeCompare(stableJson(right)),
    );

export const loomFacetSpecName = (field: string): string => {
  const normalized = field
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
  return `facet__${normalized || 'field'}__${hash(field.trim())}`;
};

export const loomFacetCacheKey = (input: {
  readonly identity: LoomDatasetIdentity;
  readonly spec: LoomAggregationSpec;
  readonly filters?: ReadonlyArray<LoomFilter>;
  readonly revision?: string;
}): string =>
  [
    loomDatasetIdentityKey(input.identity),
    input.revision ?? '',
    stableJson(input.spec),
    stableJson(canonicalizeLoomFilters(input.filters)),
  ].join('|');

/** Small independent facet cache for responses that arrived in a batch. */
export class LoomFacetCache {
  private readonly entries = new Map<
    string,
    { result: LoomAggregationResult; expiresAt: number }
  >();

  public constructor(
    private readonly maxEntries = 128,
    private readonly ttlMs = 15 * 60 * 1000,
  ) {}

  public get(key: string): LoomAggregationResult | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.result;
  }

  public set(key: string, result: LoomAggregationResult): void {
    this.entries.delete(key);
    this.entries.set(key, { result, expiresAt: Date.now() + this.ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  public clear(): void {
    this.entries.clear();
  }
}

export const selectLoomFacetDemand = (
  input: LoomFacetPolicyInput,
): LoomFacetDemandMode => {
  if (input.demand) return input.demand;
  if (input.filterable === false || input.aggregatable === false) {
    return 'disabled';
  }
  const type = input.facetType?.toLowerCase();
  if (type && FACET_TYPES_WITH_EAGER_TERMS.has(type)) return 'eager';
  if (type && FACET_TYPES_WITH_LAZY_DATA.has(type)) return 'lazy';
  const field = input.field.toLowerCase();
  if (/(^|[._])(id|uuid|identifier|reference|url|path|sha|hash)([._]|$)/.test(field)) {
    return 'lazy';
  }
  return 'eager';
};

export const buildLoomFacetSpec = (
  input: LoomFacetPolicyInput,
): LoomAggregationSpec => ({
  name: loomFacetSpecName(input.field),
  kind: input.kind ?? 'TERMS',
  column: input.field,
  size: input.size ?? DEFAULT_LOOM_FACET_SIZE,
  ...(input.interval === undefined ? {} : { interval: input.interval }),
  ...(input.dateInterval === undefined
    ? {}
    : { dateInterval: input.dateInterval }),
  ...(input.excludeSelfFilter === undefined
    ? {}
    : { excludeSelfFilter: input.excludeSelfFilter }),
});

/** Build the bounded initial facet batch. Lazy fields are demand-loaded later. */
export const buildLoomFacetPlan = (
  inputs: ReadonlyArray<LoomFacetPolicyInput>,
  maxEager = DEFAULT_LOOM_EAGER_FACET_LIMIT,
): LoomFacetPlan => {
  const eagerFields: string[] = [];
  const lazyFields: string[] = [];
  const disabledFields: string[] = [];
  const specs: LoomAggregationSpec[] = [];

  inputs.forEach((input) => {
    const demand = selectLoomFacetDemand(input);
    if (demand === 'disabled') {
      disabledFields.push(input.field);
      return;
    }
    if (demand === 'lazy') {
      lazyFields.push(input.field);
      return;
    }
    if (eagerFields.length >= Math.max(0, maxEager)) {
      lazyFields.push(input.field);
      return;
    }
    eagerFields.push(input.field);
    specs.push(buildLoomFacetSpec(input));
  });

  return { specs, eagerFields, lazyFields, disabledFields };
};
