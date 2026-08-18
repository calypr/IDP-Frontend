import type { AggregationsData } from '../../types';
import { loomApi } from './loomApi';
import { shapeLoomRows, toHistogramKey } from './processing';
import type {
  LoomAggregateRequest,
  LoomAggregateResponse,
  LoomAggregationsRequest,
  LoomAggregationResult,
  LoomRichAggregationsRequest,
  LoomRichAggregationsResponse,
  LoomDataset,
  LoomRowsRequest,
  LoomRowsResponse,
  LoomTableRenderRequest,
  LoomTableRenderResponse,
  LoomQueryArgs,
  LoomDatasetIdentity,
  DataframeSelector,
} from './types';
import { loomDatasetIdentityKey, validateLoomDatasetSelector } from './types';

const datasetFields = `
  id name revision state rowCount createdAt readyAt error
  columns { name clickhouseType logicalType nullable repeated filterable sortable aggregatable }
`;

// Loom uses these columns to enforce access and paginate internally. They are
// not part of an Explorer's public dataframe contract and Loom rejects them
// when a browser asks for them explicitly.
const isInternalDataframeColumn = (column: string) =>
  column === 'auth_resource_path' || column.startsWith('__loom_');

const publicDataframeColumns = (columns?: ReadonlyArray<string>) =>
  columns?.filter((column) => !isInternalDataframeColumn(column));

const aggregateFields = `
  materialization { ${datasetFields} }
  columns
  rows
`;

const rowsFields = `
  materialization { ${datasetFields} }
  columns
  rows
  totalCount
  pageInfo { hasNextPage endCursor }
`;

export const buildLoomDatasetQuery = (
  input: DataframeSelector | LoomDatasetIdentity,
): LoomQueryArgs => {
  const identity = 'selector' in input ? input : { selector: input };
  return {
    query: `query LoomDataset($input: DataframeDatasetInput!) { dataframeDataset(input: $input) { ${datasetFields} } }`,
    variables: { input: buildLoomIdentityInput(identity) },
  };
};

const buildLoomIdentityInput = (identity: LoomDatasetIdentity) => {
  const diagnostic = validateLoomDatasetSelector(identity.selector);
  if (diagnostic) throw new Error(diagnostic.message);
  return {
    selector: {
      recipe: identity.selector.recipe,
      translationVersion: identity.selector.translationVersion,
      output: identity.selector.output,
    },
  };
};

export const buildLoomDatasetSelectorQuery = (
  selector: LoomDatasetIdentity,
): LoomQueryArgs => ({
  query: `query LoomDataset($input: DataframeDatasetInput!) { dataframeDataset(input: $input) { ${datasetFields} } }`,
  variables: { input: buildLoomIdentityInput(selector) },
});

export const buildLoomRowsQuery = (input: LoomRowsRequest): LoomQueryArgs => ({
  query: `query LoomRows($input: DataframeRowsInput!) { dataframeRows(input: $input) { ${rowsFields} } }`,
  variables: {
    input: {
      ...buildLoomIdentityInput(input),
      columns: publicDataframeColumns(input.columns),
      filters: input.filters ? [...input.filters] : undefined,
      sort:
        input.sort && !isInternalDataframeColumn(input.sort.column)
          ? input.sort
          : undefined,
      first: input.first,
      after: input.after,
    },
  },
});

export const buildLoomAggregateQuery = (
  input: LoomAggregateRequest,
): LoomQueryArgs => ({
  query: `query LoomAggregate($input: DataframeAggregateInput!) { dataframeAggregate(input: $input) { ${aggregateFields} } }`,
  variables: {
    input: {
      ...buildLoomIdentityInput(input),
      groupBy: input.groupBy ? [...input.groupBy] : undefined,
      filters: input.filters ? [...input.filters] : undefined,
      operation: input.operation,
      column: input.column,
    },
  },
});

export const buildLoomCountQuery = (
  input: LoomAggregateRequest,
): LoomQueryArgs => ({
  query: `query LoomCount($input: DataframeAggregateInput!) { dataframeAggregate(input: $input) { columns rows } }`,
  variables: {
    input: {
      ...buildLoomIdentityInput(input),
      filters: input.filters ? [...input.filters] : undefined,
      operation: 'COUNT',
    },
  },
});

export const buildLoomAggregationsQuery = (
  input: LoomAggregationsRequest,
): LoomQueryArgs => {
  if (
    input.fields.length === 0 ||
    input.fields.some((field) => field.trim().length === 0)
  ) {
    throw new Error('Loom aggregations require at least one non-empty field');
  }
  const variables: Record<string, unknown> = {};
  const selections = input.fields
    .map((field, index) => {
      variables[`input${index}`] = {
        ...buildLoomIdentityInput(input),
        groupBy: [field],
        filters: input.filters ? [...input.filters] : [],
        operation: 'COUNT',
        column: field,
      };
      return `a${index}: dataframeAggregate(input: $input${index}) { columns rows }`;
    })
    .join('\n');
  const declarations = input.fields
    .map((_, index) => `$input${index}: DataframeAggregateInput!`)
    .join(', ');
  return {
    query: `query LoomAggregations(${declarations}) { ${selections} }`,
    variables,
  };
};

const richAggregationFields = `
  materialization { id revision }
  aggregations
`;

const buildRichAggregationInput = (input: LoomRichAggregationsRequest) => ({
  ...buildLoomIdentityInput(input),
  filters: input.filters ? [...input.filters] : [],
  specs: input.specs.map((spec) => ({
    name: spec.name,
    kind: spec.kind,
    column: spec.column,
    ...(spec.size === undefined ? {} : { size: spec.size }),
    ...(spec.interval === undefined ? {} : { interval: spec.interval }),
    ...(spec.dateInterval === undefined
      ? {}
      : { dateInterval: spec.dateInterval }),
    ...(spec.excludeSelfFilter === undefined
      ? {}
      : { excludeSelfFilter: spec.excludeSelfFilter }),
  })),
});

export const buildLoomRichAggregationsQuery = (
  input: LoomRichAggregationsRequest,
): LoomQueryArgs => {
  if (input.specs.length === 0) {
    throw new Error('Loom rich aggregations require at least one specification');
  }
  return {
    query: `query LoomRichAggregations($input: DataframeAggregationsInput!) { dataframeAggregations(input: $input) { ${richAggregationFields} } }`,
    variables: { input: buildRichAggregationInput(input) },
  };
};

export const buildLoomTableRenderQuery = (
  input: LoomTableRenderRequest,
): LoomQueryArgs => {
  const rowsInput = buildLoomRowsQuery(input).variables?.input;
  if (!input.facets || input.facets.length === 0) {
    return {
      query: `query LoomTableRender($rows: DataframeRowsInput!) { table: dataframeRows(input: $rows) { ${rowsFields} } }`,
      variables: { rows: rowsInput },
    };
  }
  return {
    query: `query LoomTableRender($rows: DataframeRowsInput!, $facets: DataframeAggregationsInput!) { table: dataframeRows(input: $rows) { ${rowsFields} } facets: dataframeAggregations(input: $facets) { ${richAggregationFields} } }`,
    variables: {
      rows: rowsInput,
      facets: buildRichAggregationInput({
        ...input,
        specs: input.facets,
      }),
    },
  };
};

const normalizeRowsResponse = (
  response: Omit<LoomRowsResponse, 'rows'> & { rows: unknown },
): LoomRowsResponse => ({
  ...response,
  rows: shapeLoomRows(response.rows, response.columns),
});

const normalizeAggregateResponse = (
  response: Omit<LoomAggregateResponse, 'rows'> & { rows: unknown },
): LoomAggregateResponse => ({
  ...response,
  rows: shapeLoomRows(response.rows, response.columns),
});

export const normalizeLoomRowsGraphQLResponse = (response: {
  dataframeRows: Omit<LoomRowsResponse, 'rows'> & { rows: unknown };
}): LoomRowsResponse => normalizeRowsResponse(response.dataframeRows);

export const normalizeLoomAggregateGraphQLResponse = (response: {
  dataframeAggregate: Omit<LoomAggregateResponse, 'rows'> & { rows: unknown };
}): LoomAggregateResponse =>
  normalizeAggregateResponse(response.dataframeAggregate);

const numericCount = (value: unknown): number => {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
};

const recordValue = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const normalizeRichAggregationResult = (
  value: unknown,
): LoomAggregationResult | undefined => {
  const record = recordValue(value);
  if (!record || typeof record.name !== 'string') return undefined;
  const kind = String(record.kind ?? 'TERMS').toUpperCase() as LoomAggregationResult['kind'];
  const columns = Array.isArray(record.columns)
    ? record.columns.filter((column): column is string => typeof column === 'string')
    : [];
  const rows = Array.isArray(record.rows) ? record.rows : [];
  const data = rows.map((row) => {
    const shaped = shapeLoomRows([row], columns)[0] ?? {};
    const key = shaped.key ?? shaped[columns[0] ?? 'key'];
    const count = shaped.doc_count ?? shaped.count ?? shaped[columns[1] ?? 'count'];
    return { key: toHistogramKey(key), count: numericCount(count) };
  });
  return {
    name: record.name,
    kind,
    data,
    missingCount: numericCount(record.missingCount),
    truncated: record.truncated === true,
  };
};

const normalizeRichAggregations = (
  value: unknown,
): Readonly<Record<string, LoomAggregationResult>> => {
  const values = Array.isArray(value)
    ? value
    : recordValue(value)?.aggregations;
  if (!Array.isArray(values)) return {};
  return Object.fromEntries(
    values
      .map(normalizeRichAggregationResult)
      .filter((item): item is LoomAggregationResult => Boolean(item))
      .map((item) => [item.name, item]),
  );
};

export const normalizeLoomRichAggregationsGraphQLResponse = (response: {
  dataframeAggregations: {
    materialization: LoomDataset | null;
    aggregations: unknown;
  };
}): LoomRichAggregationsResponse => ({
  materialization: response.dataframeAggregations.materialization,
  aggregations: normalizeRichAggregations(
    response.dataframeAggregations.aggregations,
  ),
});

export const normalizeLoomTableRenderGraphQLResponse = (response: {
  table: Omit<LoomRowsResponse, 'rows'> & { rows: unknown };
  facets?: {
    materialization: LoomDataset | null;
    aggregations: unknown;
  };
}): LoomTableRenderResponse => ({
  ...normalizeRowsResponse(response.table),
  ...(response.facets
    ? {
        facets: normalizeLoomRichAggregationsGraphQLResponse({
          dataframeAggregations: response.facets,
        }),
      }
    : {}),
});

export const loomTags = loomApi.enhanceEndpoints({
  addTagTypes: ['LOOM_DATASET', 'LOOM_ROWS', 'LOOM_AGGREGATE'],
});

export const loomSlice = loomTags.injectEndpoints({
  endpoints: (builder) => ({
    getLoomDataset: builder.query<LoomDataset | null, DataframeSelector>({
      query: buildLoomDatasetQuery,
      transformResponse: (response: { dataframeDataset: LoomDataset | null }) =>
        response.dataframeDataset,
      providesTags: (_result, _error, selector) => [
        { type: 'LOOM_DATASET', id: loomDatasetIdentityKey({ selector }) },
      ],
    }),
    getLoomDatasetBySelector: builder.query<
      LoomDataset | null,
      LoomDatasetIdentity
    >({
      query: buildLoomDatasetSelectorQuery,
      transformResponse: (response: { dataframeDataset: LoomDataset | null }) =>
        response.dataframeDataset,
      providesTags: (_result, _error, identity) => [
        { type: 'LOOM_DATASET', id: loomDatasetIdentityKey(identity) },
      ],
    }),
    getLoomRows: builder.query<LoomRowsResponse, LoomRowsRequest>({
      query: buildLoomRowsQuery,
      transformResponse: normalizeLoomRowsGraphQLResponse,
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_ROWS', id: loomDatasetIdentityKey(input) },
      ],
    }),
    getLoomAggregate: builder.query<
      LoomAggregateResponse,
      LoomAggregateRequest
    >({
      query: buildLoomAggregateQuery,
      transformResponse: normalizeLoomAggregateGraphQLResponse,
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_AGGREGATE', id: loomDatasetIdentityKey(input) },
      ],
    }),
    getLoomCount: builder.query<number, LoomAggregateRequest>({
      query: buildLoomCountQuery,
      transformResponse: (response: {
        dataframeAggregate: { rows: unknown };
      }) => {
        const rows = Array.isArray(response.dataframeAggregate?.rows)
          ? response.dataframeAggregate.rows
          : [];
        const row = rows[0];
        if (typeof row === 'number') return row;
        if (row && typeof row === 'object') {
          const values = Object.values(row as Record<string, unknown>);
          return Number(values[0]) || 0;
        }
        return 0;
      },
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_AGGREGATE', id: loomDatasetIdentityKey(input) },
      ],
    }),
    getLoomAggregations: builder.query<
      Record<string, AggregationsData[string]>,
      LoomAggregationsRequest
    >({
      query: buildLoomAggregationsQuery,
      transformResponse: (
        response: Record<string, { columns: string[]; rows: unknown }>,
        _meta,
        args,
      ): AggregationsData => {
        const aggregations: AggregationsData = {};

        args.fields.forEach((field, index) => {
          const value = response[`a${index}`];
          const rows = shapeLoomRows(value?.rows, value?.columns ?? []);
          aggregations[field] = rows.map((row) => ({
            key: toHistogramKey(
              row.key ?? row[field] ?? row[value?.columns?.[0] ?? ''],
            ),
            count:
              Number(
                row.doc_count ?? row.count ?? row[value?.columns?.[1] ?? ''],
              ) || 0,
          }));
        });

        return aggregations;
      },
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_AGGREGATE', id: loomDatasetIdentityKey(input) },
      ],
    }),
    getLoomRichAggregations: builder.query<
      LoomRichAggregationsResponse,
      LoomRichAggregationsRequest
    >({
      query: buildLoomRichAggregationsQuery,
      transformResponse: normalizeLoomRichAggregationsGraphQLResponse,
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_AGGREGATE', id: loomDatasetIdentityKey(input) },
      ],
    }),
    getLoomTableRender: builder.query<
      LoomTableRenderResponse,
      LoomTableRenderRequest
    >({
      query: buildLoomTableRenderQuery,
      transformResponse: normalizeLoomTableRenderGraphQLResponse,
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_ROWS', id: loomDatasetIdentityKey(input) },
        { type: 'LOOM_AGGREGATE', id: loomDatasetIdentityKey(input) },
      ],
    }),
  }),
});

export const {
  useGetLoomDatasetQuery,
  useGetLoomDatasetBySelectorQuery,
  useGetLoomRowsQuery,
  useGetLoomAggregateQuery,
  useGetLoomCountQuery,
  useGetLoomAggregationsQuery,
  useGetLoomRichAggregationsQuery,
  useGetLoomTableRenderQuery,
} = loomSlice;
