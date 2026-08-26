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
}

const columnsFor = (
  output: ExplorerRuntimeOutputV1,
): ReadonlyArray<ExplorerRuntimeColumnV1> =>
  [...output.columns].sort((left, right) => left.order - right.order);

const columnByEmission = (output: ExplorerRuntimeOutputV1) =>
  new Map(columnsFor(output).map((column) => [column.emissionId, column]));

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
  const byEmission = columnByEmission(output);
  const tableBindings = [...output.table.columns].sort(
    (left, right) =>
      (byEmission.get(left.emissionId)?.order ?? Number.MAX_SAFE_INTEGER) -
      (byEmission.get(right.emissionId)?.order ?? Number.MAX_SAFE_INTEGER),
  );
  const tableColumns = tableBindings
    .map((binding) => {
      const column = byEmission.get(binding.emissionId);
      if (!column) return undefined;
      return {
        field: column.name,
        title: column.label,
        type: logicalTypeToTableType(column.logicalType),
        visible: binding.visible && column.visible,
        sortable: column.sortable ?? false,
      };
    })
    .filter((column): column is NonNullable<typeof column> => Boolean(column));
  const filters = output.filters
    .map((binding) => {
      const column = byEmission.get(binding.emissionId);
      if (!column || !column.filterable) return undefined;
      return {
        field: column.name,
        index: output.outputId,
        label: binding.label ?? column.label,
        type: 'enum',
      };
    })
    .filter((filter): filter is NonNullable<typeof filter> => Boolean(filter));
  const charts: Record<string, SummaryChart> = {};
  output.charts.forEach((binding) => {
    const column = byEmission.get(binding.emissionId);
    if (!column || !column.chartable) return;
    charts[column.name] = {
      chartType: binding.type ?? 'bar',
      ...(binding.title ? { title: binding.title } : {}),
    };
  });
  const fixedFilters = Object.fromEntries(
    Object.entries(output.fixedFilters).flatMap(([emissionId, values]) => {
      const column = byEmission.get(emissionId);
      return column ? [[column.name, [...values]] as const] : [];
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
              Boolean(columnByEmission(candidate).get(binding.emissionId)),
            );
        const column = output
          ? columnByEmission(output).get(binding.emissionId)
          : undefined;
        return output && column
          ? [{ index: output.outputId, field: column.name }]
          : [];
      });
      return mappings.length > 0 ? [[name, mappings] as const] : [];
    }),
  );
  return {
    panels,
    sharedFiltersMap:
      Object.keys(sharedFilters).length > 0 ? sharedFilters : null,
  };
};
