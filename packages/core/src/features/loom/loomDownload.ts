import { z } from 'zod';
import { fetchLoomGraphQL } from './loomApi';
import { buildLoomRowsQuery } from './loomSlice';
import { convertFilterSetToLoomFilters } from './filters';
import type { FilterSet } from '../filters';
import type { LoomDatasetIdentity, LoomSort } from './types';
import { isJSONObject, type JSONObject } from '../../types';

const pageSchema = z.object({
  dataframeRows: z.object({
    materialization: z.object({
      id: z.string().min(1),
      revision: z.string().min(1),
    }),
    columns: z.array(z.string()),
    rows: z.array(
      z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
    ),
    pageInfo: z.object({
      hasNextPage: z.boolean(),
      endCursor: z.string().nullish(),
    }),
  }),
});

export type LoomRowsDownloadParams = LoomDatasetIdentity & {
  readonly fields: ReadonlyArray<string>;
  readonly filter?: FilterSet;
  readonly sort?: LoomSort;
};

export type LoomFileDownloadParams = LoomRowsDownloadParams &
  (
    | {
        readonly format: 'csv' | 'tsv';
        readonly exportHeaders?: Readonly<Record<string, string>>;
      }
    | { readonly format: 'json' | 'jsonl' }
  );

async function* downloadPages(
  parameters: LoomRowsDownloadParams,
  signal?: AbortSignal,
): AsyncGenerator<JSONObject[]> {
  if (!parameters.fields.length)
    throw new Error('This export has no configured columns.');
  const cursors = new Set<string>();
  let after: string | undefined;
  let publication: string | undefined;
  for (;;) {
    signal?.throwIfAborted();
    const result: unknown = await fetchLoomGraphQL(
      buildLoomRowsQuery({
        selector: parameters.selector,
        projectIds: parameters.projectIds,
        columns: parameters.fields,
        filters: convertFilterSetToLoomFilters(parameters.filter),
        sort: parameters.sort,
        first: 1000,
        after,
      }),
      {
        signal,
      },
    );
    const page = pageSchema.parse(result).dataframeRows;
    const identity = JSON.stringify([
      page.materialization.id,
      page.materialization.revision,
    ]);
    if (publication !== undefined && publication !== identity) {
      throw new Error(
        'The published dataset changed during export. Please download again.',
      );
    }
    publication = identity;
    if (parameters.fields.some((field) => !page.columns.includes(field))) {
      throw new Error('Loom did not return all configured export columns.');
    }
    const rows = page.rows.map((row) => {
      const values = Array.isArray(row)
        ? Object.fromEntries(
            page.columns.map((column, index) => [column, row[index]]),
          )
        : row;
      return Object.fromEntries(
        parameters.fields.map((field) => [field, values[field]]),
      );
    });
    if (!rows.every(isJSONObject))
      throw new Error('Loom returned invalid JSON rows.');
    yield rows;
    signal?.throwIfAborted();
    if (!page.pageInfo.hasNextPage) break;
    const cursor = page.pageInfo.endCursor;
    if (!cursor || cursors.has(cursor) || !page.rows.length)
      throw new Error('Loom returned an invalid export cursor.');
    cursors.add(cursor);
    after = cursor;
  }
}

export const downloadLoomRows = async (
  parameters: LoomRowsDownloadParams,
  signal?: AbortSignal,
): Promise<JSONObject[]> => {
  const rows: JSONObject[] = [];
  for await (const page of downloadPages(parameters, signal))
    rows.push(...page);
  return rows;
};

export const downloadLoomFile = async (
  parameters: LoomFileDownloadParams,
  signal?: AbortSignal,
): Promise<Blob> => {
  const chunks: BlobPart[] = [];
  const tabular = parameters.format === 'csv' || parameters.format === 'tsv';
  const delimiter = parameters.format === 'tsv' ? '\t' : ',';
  const cell = (value: unknown) => {
    const text =
      value == null
        ? ''
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
    return text.includes(delimiter) || /["\r\n]/.test(text)
      ? `"${text.replace(/"/g, '""')}"`
      : text;
  };
  if (parameters.format === 'csv' || parameters.format === 'tsv') {
    chunks.push(
      parameters.fields
        .map((field) => cell(parameters.exportHeaders?.[field] ?? field))
        .join(delimiter) + '\r\n',
    );
  } else if (parameters.format === 'json') chunks.push('[');
  let first = true;
  for await (const page of downloadPages(parameters, signal)) {
    if (tabular)
      chunks.push(
        page
          .map(
            (row) =>
              parameters.fields
                .map((field) => cell(row[field]))
                .join(delimiter) + '\r\n',
          )
          .join(''),
      );
    else if (parameters.format === 'jsonl')
      chunks.push(page.map((row) => JSON.stringify(row) + '\n').join(''));
    else if (page.length) {
      chunks.push(
        (first ? '' : ',') + page.map((row) => JSON.stringify(row)).join(','),
      );
      first = false;
    }
  }
  if (parameters.format === 'json') chunks.push(']');
  const mediaType =
    parameters.format === 'csv'
      ? 'text/csv'
      : parameters.format === 'tsv'
        ? 'text/tab-separated-values'
        : parameters.format === 'jsonl'
          ? 'application/x-ndjson'
          : 'application/json';
  return new Blob(chunks, { type: mediaType + ';charset=utf-8' });
};
