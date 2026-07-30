import type { AggregationsData } from '../../types';
import { loomApi } from './loomApi';
import { shapeLoomRows, toHistogramKey } from './processing';
import type {
  LoomAggregateRequest,
  LoomAggregateResponse,
  LoomAggregationsRequest,
  LoomDataset,
  LoomRowsRequest,
  LoomRowsResponse,
  LoomQueryArgs,
} from './types';

const datasetFields = `
  id name revision state rowCount createdAt readyAt error
  columns { name clickhouseType logicalType nullable repeated filterable sortable aggregatable }
`;

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

export const buildLoomDatasetQuery = (dataType: string): LoomQueryArgs => ({
  query: `query LoomDataset($dataType: String!) { dataframeDataset(input: { dataType: $dataType }) { ${datasetFields} } }`,
  variables: { dataType },
});

export const buildLoomRowsQuery = (input: LoomRowsRequest): LoomQueryArgs => ({
  query: `query LoomRows($input: DataframeRowsInput!) { dataframeRows(input: $input) { ${rowsFields} } }`,
  variables: {
    input: {
      ...input,
      columns: input.columns ? [...input.columns] : undefined,
      filters: input.filters ? [...input.filters] : undefined,
    },
  },
});

export const buildLoomAggregateQuery = (
  input: LoomAggregateRequest,
): LoomQueryArgs => ({
  query: `query LoomAggregate($input: DataframeAggregateInput!) { dataframeAggregate(input: $input) { ${aggregateFields} } }`,
  variables: {
    input: {
      ...input,
      groupBy: input.groupBy ? [...input.groupBy] : undefined,
      filters: input.filters ? [...input.filters] : undefined,
    },
  },
});

export const buildLoomCountQuery = (
  input: LoomAggregateRequest,
): LoomQueryArgs => ({
  query: `query LoomCount($input: DataframeAggregateInput!) { dataframeAggregate(input: $input) { columns rows } }`,
  variables: {
    input: {
      dataType: input.dataType,
      filters: input.filters ? [...input.filters] : undefined,
      operation: 'COUNT',
    },
  },
});

export const buildLoomAggregationsQuery = (
  input: LoomAggregationsRequest,
): LoomQueryArgs => {
  const selections = input.fields
    .map(
      (field, index) =>
        `a${index}: dataframeAggregate(input: { dataType: $dataType, groupBy: [${JSON.stringify(field)}], filters: $filters, operation: "COUNT", column: ${JSON.stringify(field)} }) { columns rows }`,
    )
    .join('\n');
  return {
    query: `query LoomAggregations($dataType: String!, $filters: [DataframeFilterInput!]) { ${selections} }`,
    variables: {
      dataType: input.dataType,
      filters: input.filters ? [...input.filters] : [],
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

export const loomTags = loomApi.enhanceEndpoints({
  addTagTypes: ['LOOM_DATASET', 'LOOM_ROWS', 'LOOM_AGGREGATE'],
});

export const loomSlice = loomTags.injectEndpoints({
  endpoints: (builder) => ({
    getLoomDatasets: builder.query<Array<LoomDataset>, void>({
      query: () => ({
        query: `query LoomDatasets { dataframeDatasets { ${datasetFields} } }`,
      }),
      transformResponse: (response: { dataframeDatasets: Array<LoomDataset> }) =>
        response.dataframeDatasets ?? [],
      providesTags: ['LOOM_DATASET'],
    }),
    getLoomDataset: builder.query<LoomDataset | null, string>({
      query: buildLoomDatasetQuery,
      transformResponse: (response: { dataframeDataset: LoomDataset | null }) =>
        response.dataframeDataset,
      providesTags: (_result, _error, dataType) => [
        { type: 'LOOM_DATASET', id: dataType },
      ],
    }),
    getLoomRows: builder.query<LoomRowsResponse, LoomRowsRequest>({
      query: buildLoomRowsQuery,
      transformResponse: normalizeLoomRowsGraphQLResponse,
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_ROWS', id: input.dataType },
      ],
    }),
    getLoomAggregate: builder.query<
      LoomAggregateResponse,
      LoomAggregateRequest
    >({
      query: buildLoomAggregateQuery,
      transformResponse: normalizeLoomAggregateGraphQLResponse,
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_AGGREGATE', id: input.dataType },
      ],
    }),
    getLoomCount: builder.query<number, LoomAggregateRequest>({
      query: buildLoomCountQuery,
      transformResponse: (response: { dataframeAggregate: { rows: unknown } }) => {
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
        { type: 'LOOM_AGGREGATE', id: input.dataType },
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
                row.doc_count ??
                  row.count ??
                  row[value?.columns?.[1] ?? ''],
              ) || 0,
          }));
        });

        return aggregations;
      },
      providesTags: (_result, _error, input) => [
        { type: 'LOOM_AGGREGATE', id: input.dataType },
      ],
    }),
  }),
});

export const {
  useGetLoomDatasetsQuery,
  useGetLoomDatasetQuery,
  useGetLoomRowsQuery,
  useGetLoomAggregateQuery,
  useGetLoomCountQuery,
  useGetLoomAggregationsQuery,
} = loomSlice;
