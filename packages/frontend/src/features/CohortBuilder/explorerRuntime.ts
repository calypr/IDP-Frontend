import type {
  ExplorerRuntimeColumnV1,
  ExplorerRuntimeOutputV1,
  ExplorerRuntimeV1,
  SharedFieldMapping,
} from '@gen3/core';
import type { SummaryChart } from '../../components/charts/types';
import type { CohortPanelConfiguration } from './types';

export interface ExplorerRuntimeProjection {
  readonly panels: ReadonlyArray<CohortPanelConfiguration>;
  readonly sharedFiltersMap: SharedFieldMapping | null;
  readonly fileActions?: ExplorerRuntimeV1['fileActions'];
}

const columnsFor = (
  output: ExplorerRuntimeOutputV1,
): ReadonlyArray<ExplorerRuntimeColumnV1> =>
  [...output.columns].sort((left, right) => left.order - right.order);

const columnByName = (output: ExplorerRuntimeOutputV1) =>
  new Map(columnsFor(output).map((column) => [column.column, column]));

const logicalTypeToTableType = (
  logicalType: string,
): 'string' | 'number' | 'date' | 'array' | 'boolean' => {
  const value = logicalType.toLowerCase();
  if (value.includes('bool')) return 'boolean';
  if (value.includes('date') || value.includes('time')) return 'date';
  if (
    value.includes('int') ||
    value.includes('float') ||
    value.includes('decimal') ||
    value.includes('number')
  )
    return 'number';
  if (
    value.includes('array') ||
    value.includes('list') ||
    value.includes('repeat')
  )
    return 'array';
  return 'string';
};

const panelFor = (
  output: ExplorerRuntimeOutputV1,
  project: string,
): CohortPanelConfiguration => {
  const byColumn = columnByName(output);
  const tableBindings = [...output.table.columns].sort(
    (left, right) =>
      (byColumn.get(left.column)?.order ?? Number.MAX_SAFE_INTEGER) -
      (byColumn.get(right.column)?.order ?? Number.MAX_SAFE_INTEGER),
  );
  const tableColumns = tableBindings
    .map((binding) => {
      const column = byColumn.get(binding.column);
      if (!column) return undefined;
      return {
        field: column.column,
        title: column.label,
        type: logicalTypeToTableType(column.logicalType),
        visible: binding.visible && column.visible,
        sortable: column.sortable ?? false,
        ...(binding.cellRenderer
          ? { cellRenderFunction: binding.cellRenderer }
          : {}),
      };
    })
    .filter((column): column is NonNullable<typeof column> => Boolean(column));
  const filters = output.filters
    .map((binding) => {
      const column = byColumn.get(binding.column);
      if (!column || !column.filterable) return undefined;
      return {
        field: column.column,
        index: output.outputId,
        label: binding.label ?? column.label,
        type: 'enum',
      };
    })
    .filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  const charts: Record<string, SummaryChart> = {};
  output.charts.forEach((binding) => {
    const column = byColumn.get(binding.column);
    if (!column || !column.chartable) return;
    charts[column.column] = {
      chartType: binding.type ?? 'bar',
      ...(binding.title ? { title: binding.title } : {}),
    };
  });
  const fixedFilters = Object.fromEntries(
    Object.entries(output.fixedFilters).flatMap(([columnName, values]) => {
      const column = byColumn.get(columnName);
      return column ? [[column.column, [...values]] as const] : [];
    }),
  );
  return {
    tabTitle: output.title,
    guppyConfig: {
      dataType: output.outputId,
      output: output.selector.output,
      nodeCountTitle: output.rowLabel,
      loomDataset: output.selector,
      loomProjectIds: [project],
    },
    table: {
      enabled: true,
      fields: tableColumns
        .filter((column) => column.visible !== false)
        .map((column) => column.field),
      columns: Object.fromEntries(
        tableColumns.map((column) => [column.field, column]),
      ),
    },
    ...(filters.length > 0
      ? {
          filters: {
            tabs: [
              {
                title: 'Filters',
                fields: filters.map((filter) => filter.field),
                fieldsConfig: Object.fromEntries(
                  filters.map((filter) => [filter.field, filter]),
                ),
              },
            ],
          },
        }
      : {}),
    ...(Object.keys(charts).length > 0 ? { charts } : {}),
    ...(Object.keys(fixedFilters).length > 0
      ? { preFilters: fixedFilters }
      : {}),
    ...(output.actions?.length
      ? {
          buttons: output.actions.map((action) => ({
            title: action.title,
            action: 'data-table',
            actionArgs: {
              type: output.outputId,
              fileFields: action.columns ?? [],
              filename: action.fileName ?? `${output.outputId}.csv`,
              selector: output.selector,
              projectIds: [project],
            },
          })) as unknown as CohortPanelConfiguration['buttons'],
        }
      : {}),
    runtimeOwned: true,
  } as CohortPanelConfiguration;
};

/**
 * Convert the server-owned runtime packet into the renderer's panel props.
 * This is deliberately a one-way view projection: it accepts no authoring
 * document, recipe, physical-name synthesis, or dataset discovery fallback.
 */
export const cohortBuilderPanelsFromRuntime = (
  runtime: ExplorerRuntimeV1,
  project: string,
): ExplorerRuntimeProjection => {
  const panels = runtime.outputs.map((output) => panelFor(output, project));
  const outputById = new Map(
    runtime.outputs.map((output) => [output.outputId, output]),
  );
  const sharedFilters = Object.fromEntries(
    Object.entries(runtime.sharedFilters).flatMap(([name, bindings]) => {
      const mappings = bindings.flatMap((binding) => {
        const output = binding.outputId
          ? outputById.get(binding.outputId)
          : runtime.outputs.find((candidate) =>
              Boolean(columnByName(candidate).get(binding.column)),
            );
        const column = output
          ? columnByName(output).get(binding.column)
          : undefined;
        return output && column
          ? [{ index: output.outputId, field: column.column }]
          : [];
      });
      return mappings.length > 0 ? [[name, mappings] as const] : [];
    }),
  );
  return {
    panels,
    sharedFiltersMap:
      Object.keys(sharedFilters).length > 0 ? sharedFilters : null,
    fileActions: runtime.fileActions,
  };
};
