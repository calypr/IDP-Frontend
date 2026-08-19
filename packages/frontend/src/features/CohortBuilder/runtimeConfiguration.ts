import type { CohortPanelConfiguration, TabConfig } from './types';
import type { SummaryTable } from './ExplorerTable/types';

export type RuntimeColumn = {
  readonly name: string;
  readonly filterable?: boolean;
  readonly chartable?: boolean;
  /** Stable logical identities supplied by Loom alongside the physical name. */
  readonly semanticPath?: string;
  readonly selectionId?: string;
  readonly aliases?: ReadonlyArray<string>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const firstString = (...values: ReadonlyArray<unknown>): string | undefined =>
  values.find(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  )?.trim();

const booleanValue = (...values: ReadonlyArray<unknown>): boolean | undefined =>
  values.find((value): value is boolean => typeof value === 'boolean');

const canonicalIdentity = (value: string): string =>
  value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const identityParts = (value: string): string[] => {
  const canonical = canonicalIdentity(value);
  if (!canonical) return [];
  const parts = canonical.split('_').filter(Boolean);
  return [
    canonical,
    ...parts.slice(1).map((_, index) => parts.slice(index + 1).join('_')),
  ];
};

/**
 * Accepts both the current JSON column contract and Loom's older Go default
 * JSON encoding (`PublicColumn`, `SelectionID`, etc.). The viewer only uses
 * `name` for queries; the other values are aliases used to translate the
 * logical ExplorerConfig field into that physical query name.
 */
export const runtimeColumnFromUnknown = (
  value: unknown,
): RuntimeColumn | undefined => {
  if (typeof value === 'string' && value.trim()) return { name: value.trim() };
  if (!isRecord(value)) return undefined;
  const name = firstString(
    value.name,
    value.publicColumn,
    value.PublicColumn,
    value.column,
    value.Column,
  );
  if (!name) return undefined;
  const semanticPath = firstString(
    value.semanticPath,
    value.SemanticPath,
  );
  const selectionId = firstString(value.selectionId, value.SelectionID);
  const aliases = [
    ...[value.name, value.publicColumn, value.PublicColumn, value.column],
    ...[semanticPath, selectionId],
  ].filter(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
  return {
    name,
    ...(semanticPath ? { semanticPath } : {}),
    ...(selectionId ? { selectionId } : {}),
    ...(aliases.length > 0 ? { aliases } : {}),
    filterable: booleanValue(value.filterable, value.Filterable),
    chartable: booleanValue(value.chartable, value.Chartable),
  };
};

export const runtimeColumnsFromUnknown = (
  values: ReadonlyArray<unknown>,
): RuntimeColumn[] =>
  values
    .map(runtimeColumnFromUnknown)
    .filter((column): column is RuntimeColumn => Boolean(column));

const identitiesForColumn = (
  column: RuntimeColumn,
  rootResourceType?: string,
): ReadonlySet<string> => {
  const identities = new Set<string>();
  const addExact = (value: string | undefined) => {
    if (!value) return;
    const identity = canonicalIdentity(value);
    if (identity) identities.add(identity);
  };
  addExact(column.name);
  column.aliases?.forEach((alias) => addExact(alias));

  const root = canonicalIdentity(rootResourceType ?? '');
  const addScopedParts = (value: string | undefined) => {
    const identity = canonicalIdentity(value ?? '');
    if (!identity || (root && identity !== root && !identity.startsWith(`${root}_`)))
      return;
    const relative = identity === root ? '' : identity.slice(root.length + 1);
    identityParts(relative).forEach((part) => identities.add(part));
  };
  if (root) {
    addScopedParts(column.name);
    addScopedParts(column.semanticPath);
    addScopedParts(column.selectionId);
  } else {
    identityParts(column.name).forEach((part) => identities.add(part));
    if (column.semanticPath)
      identityParts(column.semanticPath).forEach((part) => identities.add(part));
    if (column.selectionId)
      identityParts(column.selectionId).forEach((part) => identities.add(part));
  }
  if (!root) {
    column.aliases?.forEach((alias) => {
      identityParts(alias).forEach((part) => identities.add(part));
    });
  } else {
    // Explicit columnMappings aliases are already exact identities. Do not
    // derive suffixes from non-root physical columns: `id` must resolve to
    // the output root, not an unrelated nested Patient.id column.
    column.aliases?.forEach((alias) => {
      const identity = canonicalIdentity(alias);
      if (identity && !identity.includes('_')) identities.add(identity);
    });
  }
  return identities;
};

/** Resolve an authored logical field to the physical column Loom exposes. */
export const resolveRuntimeColumnName = (
  field: string,
  columns: ReadonlyArray<RuntimeColumn>,
  rootResourceType?: string,
): string | undefined => {
  const requested = canonicalIdentity(field);
  if (!requested) return undefined;
  const direct = columns.find(
    (column) => canonicalIdentity(column.name) === requested,
  );
  if (direct) return direct.name;
  const matches = columns.filter((column) =>
    identitiesForColumn(column, rootResourceType).has(requested),
  );
  return matches.length === 1 ? matches[0].name : undefined;
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
  rootResourceType?: string,
): SummaryTable => {
  const available = availableColumnNames(columns);
  const configuredFields = unique([
    ...table.fields,
    ...Object.keys(table.columns ?? {}),
  ]);
  const configuredToPhysical = new Map(
    configuredFields.flatMap((field) => {
      const physical = resolveRuntimeColumnName(field, columns, rootResourceType);
      return physical ? [[field, physical] as const] : [];
    }),
  );
  const matchingFields = unique(
    configuredFields
      .map((field) => configuredToPhysical.get(field))
      .filter((field): field is string => Boolean(field))
      .filter((field) => available.has(field)),
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
  const columnForField = (field: string) => {
    const logical = configuredFields.find(
      (candidate) => configuredToPhysical.get(candidate) === field,
    );
    const configuredColumn =
      configuredColumns[field] ?? (logical ? configuredColumns[logical] : undefined);
    return configuredColumn ? { ...configuredColumn, field } : undefined;
  };

  const subTables = table.subTables
    ?.map((subTable) => {
      const subFields = unique(
        subTable.fields
          .map((field) => resolveRuntimeColumnName(field, columns, rootResourceType))
          .filter((field): field is string => Boolean(field))
          .filter((field) => available.has(field)),
      );
      const subColumns = Object.fromEntries(
        subFields.map((field) => [
          field,
          (() => {
            const logical = subTable.fields.find(
              (candidate) =>
                resolveRuntimeColumnName(candidate, columns, rootResourceType) ===
                field,
            );
            const configuredColumn =
              subTable.columns[field] ??
              (logical ? subTable.columns[logical] : undefined);
            return configuredColumn
              ? { ...configuredColumn, field }
              : undefined;
          })() ??
            subTable.columns[
              subTable.fields.find(
                (candidate) =>
                  resolveRuntimeColumnName(candidate, columns, rootResourceType) ===
                  field,
              ) ?? ''
            ] ?? { field, title: field },
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
        columnForField(field) ?? { field, title: field },
      ]),
    ),
    ...(subTables ? { subTables } : {}),
  };
};

const normalizeFilters = (
  filters: CohortPanelConfiguration['filters'],
  columns: ReadonlyArray<RuntimeColumn>,
  rootResourceType?: string,
): CohortPanelConfiguration['filters'] => {
  if (!filters) return undefined;
  const available = availableColumnNames(columns);
  const filterable = new Set(
    getUsableColumnNames(columns, (column) => column.filterable !== false),
  );
  const tabs = filters.tabs
    .map((tab: TabConfig) => {
      const logicalForPhysical = new Map<string, string>();
      const fields = unique(
        tab.fields
          .map((field) => {
            const physical = resolveRuntimeColumnName(
              field,
              columns,
              rootResourceType,
            );
            if (physical) logicalForPhysical.set(physical, field);
            return physical;
          })
          .filter((field): field is string => Boolean(field))
          .filter((field) => available.has(field) && filterable.has(field)),
      );
      return fields.length > 0
        ? {
            ...tab,
            fields,
            fieldsConfig: Object.fromEntries(
              fields
                .map((field) => {
                  const logical = logicalForPhysical.get(field);
                  const definition =
                    tab.fieldsConfig[field] ??
                    (logical ? tab.fieldsConfig[logical] : undefined);
                  return [
                    field,
                    definition ? { ...definition, field } : undefined,
                  ];
                })
                .filter(([, definition]) => definition),
            ),
          }
        : null;
    })
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab));
  return tabs.length > 0 ? { ...filters, tabs } : undefined;
};

export const hasUsableFilterConfiguration = (
  filters: CohortPanelConfiguration['filters'],
): boolean =>
  Boolean(
    filters?.tabs.some((tab) =>
      tab.fields.some((field) => field.trim().length > 0),
    ),
  );

const normalizeCharts = <T extends Record<string, unknown>>(
  charts: T | undefined,
  columns: ReadonlyArray<RuntimeColumn>,
  rootResourceType?: string,
): T | undefined => {
  if (!charts) return undefined;
  const available = new Set(
    getUsableColumnNames(columns, (column) => column.chartable !== false),
  );
  return Object.fromEntries(
    Object.entries(charts).flatMap(([field, definition]) => {
      const physical = resolveRuntimeColumnName(field, columns, rootResourceType);
      return physical && available.has(physical)
        ? [[physical, definition]]
        : [];
    }),
  ) as T;
};

/**
 * Adapts the authored presentation packet to the physical dataframe that Loom
 * actually published. The packet remains the source of labels and display
 * settings, while executable field references are always checked at runtime.
 */
export const normalizeCohortPanelForDataset = (
  panel: CohortPanelConfiguration,
  columns?: ReadonlyArray<unknown>,
  rootResourceType?: string,
): CohortPanelConfiguration => {
  if (!columns) return panel;

  const runtimeColumns = runtimeColumnsFromUnknown(columns);

  const available = availableColumnNames(runtimeColumns);
  const accessibleValidationField =
    panel.guppyConfig.accessibleValidationField
      ? resolveRuntimeColumnName(
          panel.guppyConfig.accessibleValidationField,
          runtimeColumns,
          rootResourceType,
        )
      : undefined;
  const guppyConfig = {
    ...panel.guppyConfig,
    ...(panel.guppyConfig.accessibleFieldCheckList
      ? {
          accessibleFieldCheckList:
            panel.guppyConfig.accessibleFieldCheckList.filter((field) =>
              Boolean(
                resolveRuntimeColumnName(field, runtimeColumns, rootResourceType),
              ),
            ).map(
              (field) =>
                resolveRuntimeColumnName(field, runtimeColumns, rootResourceType) ??
                field,
            ),
        }
      : {}),
    ...(accessibleValidationField
      ? { accessibleValidationField }
      : {}),
    ...(panel.guppyConfig.fieldMapping
      ? {
          fieldMapping: panel.guppyConfig.fieldMapping.flatMap((mapping) => {
            const field = resolveRuntimeColumnName(
              mapping.field,
              runtimeColumns,
              rootResourceType,
            );
            return field ? [{ ...mapping, field }] : [];
          }),
        }
      : {}),
  };

  const normalizedTable = panel.table
    ? normalizeTable(panel.table, runtimeColumns, rootResourceType)
    : undefined;
  const normalizedFilters = normalizeFilters(
    panel.filters,
    runtimeColumns,
    rootResourceType,
  );
  const normalizedCharts = normalizeCharts(
    panel.charts,
    runtimeColumns,
    rootResourceType,
  );
  const normalizedSectionCharts = panel.chartsSection
    ? normalizeCharts(panel.chartsSection.charts, runtimeColumns, rootResourceType)
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
        Object.entries(panel.preFilters).flatMap(([field, values]) => {
          const physical = resolveRuntimeColumnName(
            field,
            runtimeColumns,
            rootResourceType,
          );
          return physical && available.has(physical)
            ? [[physical, values]]
            : [];
        }),
      )
    : undefined;

  const normalizedPanel: CohortPanelConfiguration = {
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
  if (!normalizedFilters) delete normalizedPanel.filters;
  return normalizedPanel;
};

export const normalizeSharedFilterMappings = <
  T extends ReadonlyArray<{ readonly output: string; readonly column: string }>,
>(
  mappings: T,
  columnsByOutput: Readonly<
    Record<string, ReadonlySet<string> | ReadonlyArray<RuntimeColumn>>
  >,
  rootResourceByOutput?: Readonly<Record<string, string | undefined>>,
): T =>
  mappings.flatMap((mapping) => {
    const columns = columnsByOutput[mapping.output];
    if (!columns) return [mapping];
    if (Array.isArray(columns)) {
      const physical = resolveRuntimeColumnName(
        mapping.column,
        columns,
        rootResourceByOutput?.[mapping.output],
      );
      return physical ? [{ ...mapping, column: physical }] : [];
    }
    return (columns as ReadonlySet<string>).has(mapping.column)
      ? [mapping]
      : [];
  }) as unknown as T;
