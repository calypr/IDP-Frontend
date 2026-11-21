import type {
  Excludes,
  ExcludeIfAny,
  FilterSet,
  Includes,
  Intersection,
  Operation,
} from '../filters';
import type { LoomFilter } from './types';

const scalarFilter = (
  column: string,
  op: string,
  value: unknown,
): LoomFilter => ({ column, op, value });

const convertOperation = (
  column: string,
  operation: Operation,
): Array<LoomFilter> => {
  switch (operation.operator) {
    case '=':
      return [scalarFilter(column, 'EQ', operation.operand)];
    case '!=':
      return [scalarFilter(column, 'NEQ', operation.operand)];
    case '<':
    case '<=':
    case '>':
    case '>=':
      return [scalarFilter(column, operation.operator, operation.operand)];
    case 'in':
    case 'includes':
      return [scalarFilter(column, 'IN', (operation as Includes).operands)];
    case 'excludes':
      return [scalarFilter(column, 'NOT_IN', (operation as Excludes).operands)];
    case 'excludeifany':
      return [
        scalarFilter(column, 'NOT_IN', (operation as ExcludeIfAny).operands),
      ];
    case 'missing':
      return [scalarFilter(column, 'IS_NULL', null)];
    case 'exists':
      return [scalarFilter(column, 'IS_NOT_NULL', null)];
    case 'and':
      return (operation as Intersection).operands.flatMap((child) =>
        convertOperation(column, child),
      );
    case 'or':
      throw new Error(
        `Unsupported Loom filter union for column ${column}; use a supported scalar or IN filter`,
      );
    case 'nested': {
      let nestedOperation: Operation = operation.operand;
      const nestedPath = [operation.path];
      while (nestedOperation.operator === 'nested') {
        nestedPath.push(nestedOperation.path);
        nestedOperation = nestedOperation.operand;
      }
      const leafField = 'field' in nestedOperation ? nestedOperation.field : '';
      const flattenedColumn = column.includes('.')
        ? column
        : [...nestedPath, leafField].filter(Boolean).join('.');
      return convertOperation(flattenedColumn, nestedOperation);
    }
    default:
      throw new Error('Unsupported Loom filter operation');
  }
};

export const convertFilterSetToLoomFilters = (
  filters?: FilterSet,
): Array<LoomFilter> => {
  if (!filters) return [];
  if (filters.mode === 'or') {
    throw new Error(
      'Unsupported Loom filter union at the filter-set level; use a supported scalar or IN filter',
    );
  }
  return Object.entries(filters.root).flatMap(([column, operation]) =>
    convertOperation(column, operation),
  );
};

export const assertLoomFilterable = (
  filters: ReadonlyArray<LoomFilter>,
  columns: ReadonlyArray<{ name: string; filterable: boolean }>,
) => {
  const columnMap = new Map(columns.map((column) => [column.name, column]));
  for (const filter of filters) {
    const column = columnMap.get(filter.column);
    if (!column) throw new Error(`Unknown Loom filter column: ${filter.column}`);
    if (!column.filterable) {
      throw new Error(`Loom column is not filterable: ${filter.column}`);
    }
  }
};
