import type { AggregationsData, JSONObject, StatsData } from '../../types';
import type { LoomAggregateResponse, LoomColumn } from './types';

const isObject = (value: unknown): value is JSONObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assignDottedValue = (row: JSONObject, path: string, value: unknown) => {
  const parts = path.split('.').filter(Boolean);
  if (parts.length < 2) {
    row[path] = value as never;
    return;
  }

  let cursor = row;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (!isObject(existing)) cursor[part] = {};
    cursor = cursor[part] as JSONObject;
  }
  cursor[parts[parts.length - 1]] = value as never;
};

export const shapeLoomRow = (
  row: unknown,
  columns: ReadonlyArray<string>,
): JSONObject => {
  const source = Array.isArray(row)
    ? Object.fromEntries(columns.map((column, index) => [column, row[index]]))
    : isObject(row)
      ? row
      : {};
  const shaped: JSONObject = {};
  Object.entries(source).forEach(([key, value]) =>
    assignDottedValue(shaped, key, value),
  );
  return shaped;
};

export const shapeLoomRows = (
  rows: unknown,
  columns: ReadonlyArray<string>,
): Array<JSONObject> =>
  Array.isArray(rows) ? rows.map((row) => shapeLoomRow(row, columns)) : [];

export const columnsToFieldMapping = (
  columns: ReadonlyArray<LoomColumn>,
): Record<string, LoomColumn> =>
  Object.fromEntries(columns.map((column) => [column.name, column]));

const numericValue = (value: unknown): number => {
  const result = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(result) ? result : 0;
};

export const toHistogramKey = (value: unknown): string | [number, number] => {
  if (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((item) => typeof item === 'number')
  ) {
    return [value[0], value[1]];
  }

  return typeof value === 'string' ? value : String(value ?? '');
};

export const aggregateToHistogram = (
  response: LoomAggregateResponse,
  field: string,
): AggregationsData => {
  const rows = response.rows.map((row) => {
    const key = row.key ?? row[field] ?? row[response.columns[0]];
    const count = row.doc_count ?? row.count ?? row[response.columns[1]];
    return { key: toHistogramKey(key), count: numericValue(count) };
  });
  return { [field]: rows };
};

export const aggregateToStats = (
  response: LoomAggregateResponse,
  field: string,
): StatsData => {
  const row = response.rows[0] ?? {};
  return {
    [field]: [
      {
        count: numericValue(row.count),
        min: numericValue(row.min),
        max: numericValue(row.max),
        avg: numericValue(row.avg),
        sum: numericValue(row.sum),
      },
    ],
  };
};
