import type { CohortPanelConfiguration, TabConfig } from './types';
import type { SummaryTable } from './ExplorerTable/types';

type RuntimeColumn = {
  readonly name: string;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
};

const isPublicColumn = (name: string): boolean =>
  name !== 'auth_resource_path' && !name.startsWith('__loom_');

const unique = (values: ReadonlyArray<string>): string[] => [
  ...new Set(values.filter((value) => value.trim().length > 0)),
];

const availableColumnNames = (
  columns: ReadonlyArray<RuntimeColumn>,
): ReadonlySet<string> =>
  new Set(
    columns
      .map((column) => column.name)
      .filter((name) => isPublicColumn(name)),
  );

const getUsableColumnNames = (
  columns: ReadonlyArray<RuntimeColumn>,
  predicate: (column: RuntimeColumn) => boolean,
): string[] =>
  unique(
    columns
      .filter((column) => isPublicColumn(column.name) && predicate(column))
      .map((column) => column.name),
  );

const normalizeTable = (
  table: SummaryTable,
  columns: ReadonlyArray<RuntimeColumn>,
): SummaryTable => {
  const available = availableColumnNames(columns);
  const configuredFields = unique([
    ...table.fields,
    ...Object.keys(table.columns ?? {}),
  ]);
  const matchingFields = configuredFields.filter((field) =>
    available.has(field),
  );
  // A stale Builder packet should not make the table disappear. When none of
  // its configured fields exist in the live dataframe, use the dataframe's
  // public columns and retain any matching presentation overrides.
  const fields =
    matchingFields.length > 0
      ? matchingFields
      : columns
          .map((column) => column.name)
          .filter((name) => available.has(name));
  const configuredColumns = table.columns ?? {};

  const subTables = table.subTables
    ?.map((subTable) => {
      const subFields = unique(subTable.fields).filter((field) =>
        available.has(field),
      );
      const subColumns = Object.fromEntries(
        subFields.map((field) => [
          field,
          subTable.columns[field] ?? { field, title: field },
        ]),
      );
      return subFields.length > 0
        ? { ...subTable, fields: subFields, columns: subColumns }
        : null;
    })
    .filter((subTable): subTable is NonNullable<typeof subTable> =>
      Boolean(subTable),
    );

  return {
    ...table,
    fields,
    columns: Object.fromEntries(
      fields.map((field) => [
        field,
        configuredColumns[field] ?? { field, title: field },
      ]),
    ),
    ...(subTables ? { subTables } : {}),
  };
};

const normalizeFilters = (
  filters: CohortPanelConfiguration['filters'],
  columns: ReadonlyArray<RuntimeColumn>,
): CohortPanelConfiguration['filters'] => {
  if (!filters) return undefined;
  const available = availableColumnNames(columns);
  const filterable = new Set(
    getUsableColumnNames(columns, (column) => column.filterable !== false),
  );
  const tabs = filters.tabs
    .map((tab: TabConfig) => {
      const fields = unique(tab.fields).filter(
        (field) => available.has(field) && filterable.has(field),
      );
      return fields.length > 0
        ? {
            ...tab,
            fields,
            fieldsConfig: Object.fromEntries(
              fields
                .map((field) => [field, tab.fieldsConfig[field]])
                .filter(([, definition]) => definition),
            ),
          }
        : null;
    })
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab));
  if (tabs.length > 0) return { ...filters, tabs };

  const fallbackFields = [...filterable];
  if (fallbackFields.length === 0) return undefined;
  const firstTab = filters.tabs[0];
  return {
    ...filters,
    tabs: [
      {
        title: firstTab?.title ?? 'Filters',
        fields: fallbackFields,
        fieldsConfig: {},
        ...(firstTab?.classNames ? { classNames: firstTab.classNames } : {}),
        ...(firstTab?.defaultSort
          ? { defaultSort: firstTab.defaultSort }
          : {}),
      },
    ],
  };
};

const normalizeCharts = <T extends Record<string, unknown>>(
  charts: T | undefined,
  columns: ReadonlyArray<RuntimeColumn>,
): T | undefined => {
  if (!charts) return undefined;
  const available = new Set(
    getUsableColumnNames(columns, (column) => column.chartable !== false),
  );
  return Object.fromEntries(
    Object.entries(charts).filter(([field]) => available.has(field)),
  ) as T;
};

/**
 * Adapts the authored presentation packet to the physical dataframe that Loom
 * actually published. The packet remains the source of labels and display
 * settings, while executable field references are always checked at runtime.
 */
export const normalizeCohortPanelForDataset = (
  panel: CohortPanelConfiguration,
  columns?: ReadonlyArray<RuntimeColumn>,
): CohortPanelConfiguration => {
  if (!columns) return panel;

  const available = availableColumnNames(columns);
  const accessibleValidationField =
    panel.guppyConfig.accessibleValidationField &&
    available.has(panel.guppyConfig.accessibleValidationField)
      ? panel.guppyConfig.accessibleValidationField
      : undefined;
  const guppyConfig = {
    ...panel.guppyConfig,
    ...(panel.guppyConfig.accessibleFieldCheckList
      ? {
          accessibleFieldCheckList:
            panel.guppyConfig.accessibleFieldCheckList.filter((field) =>
              available.has(field),
            ),
        }
      : {}),
    ...(accessibleValidationField
      ? { accessibleValidationField }
      : {}),
    ...(panel.guppyConfig.fieldMapping
      ? {
          fieldMapping: panel.guppyConfig.fieldMapping.filter((mapping) =>
            available.has(mapping.field),
          ),
        }
      : {}),
  };

  const normalizedTable = panel.table
    ? normalizeTable(panel.table, columns)
    : undefined;
  const normalizedFilters = normalizeFilters(panel.filters, columns);
  const normalizedCharts = normalizeCharts(panel.charts, columns);
  const normalizedSectionCharts = panel.chartsSection
    ? normalizeCharts(panel.chartsSection.charts, columns)
    : undefined;
  const normalizedChartsSection = panel.chartsSection
    ? {
        ...panel.chartsSection,
        ...(normalizedSectionCharts
          ? { charts: normalizedSectionCharts }
          : {}),
      }
    : undefined;
  const normalizedPreFilters = panel.preFilters
    ? Object.fromEntries(
        Object.entries(panel.preFilters).filter(([field]) =>
          available.has(field),
        ),
      )
    : undefined;

  return {
    ...panel,
    guppyConfig,
    ...(normalizedTable ? { table: normalizedTable } : {}),
    ...(normalizedFilters ? { filters: normalizedFilters } : {}),
    ...(normalizedCharts ? { charts: normalizedCharts } : {}),
    ...(normalizedChartsSection
      ? { chartsSection: normalizedChartsSection }
      : {}),
    ...(normalizedPreFilters ? { preFilters: normalizedPreFilters } : {}),
  };
};

export const normalizeSharedFilterMappings = <
  T extends ReadonlyArray<{ readonly output: string; readonly column: string }>,
>(
  mappings: T,
  columnsByOutput: Readonly<Record<string, ReadonlySet<string>>>,
): T =>
  mappings.filter((mapping) => {
    const columns = columnsByOutput[mapping.output];
    return !columns || columns.has(mapping.column);
  }) as unknown as T;
