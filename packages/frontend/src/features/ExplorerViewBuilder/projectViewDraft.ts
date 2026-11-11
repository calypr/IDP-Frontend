import type {
  ProjectViewBuilderCatalog,
  ProjectViewBuilderConfigRevision,
  ProjectViewBuilderFrame,
  ProjectViewConfig,
} from '@gen3/core';

export const PROJECT_VIEW_CHART_TYPES = [
  'bar',
  'horizontalStacked',
  'pie',
  'fullPie',
  'donut',
] as const;

const safeIdPart = (value: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[._-]+|[._-]+$/g, '');
  return normalized || 'view';
};

export const uniqueProjectConfigId = (
  title: string,
  existing: ReadonlyArray<string>,
): string => {
  const base = safeIdPart(title);
  const used = new Set(existing);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

export const projectViewFrameRef = (
  recipeName: string,
  outputName: string,
): string => `${recipeName}/${outputName}`;

export const outputNameForFrameRef = (
  recipeName: string,
  frameRef: string,
): string | undefined => {
  const prefix = `${recipeName}/`;
  if (!frameRef.startsWith(prefix)) return undefined;
  const outputName = frameRef.slice(prefix.length);
  return outputName || undefined;
};

const viewIdFor = (configId: string, outputName: string, index: number) =>
  `${safeIdPart(configId)}-${safeIdPart(outputName)}-${index + 1}`;

export const projectViewFromFrame = (
  configId: string,
  frame: ProjectViewBuilderFrame,
  index: number,
) => ({
  id: viewIdFor(configId, frame.id, index),
  title: frame.title || frame.id,
  output: frame.id,
  table: {
    columns: frame.columns.map((column) => ({
      column: column.name,
      label: column.label,
      visible: true,
    })),
  },
  filters: [],
  charts: [],
});

export const updateProjectView = (
  config: ProjectViewConfig,
  viewId: string,
  update: (
    view: ProjectViewConfig['views'][number],
  ) => ProjectViewConfig['views'][number],
): ProjectViewConfig => ({
  ...config,
  views: config.views.map((view) => (view.id === viewId ? update(view) : view)),
});

export const projectConfigFromCatalog = (
  catalog: ProjectViewBuilderCatalog,
  title: string,
  existingIds: ReadonlyArray<string>,
): ProjectViewConfig => {
  const id = uniqueProjectConfigId(title, existingIds);
  return {
    id,
    title: title.trim(),
    recipeRef: { name: catalog.recipeName },
    views: catalog.frames.map((frame, index) =>
      projectViewFromFrame(id, frame, index),
    ),
    sharedFilters: {},
    fileActions: { extensions: {}, actions: {} },
  };
};

export const duplicateProjectConfig = (
  source: ProjectViewConfig,
  title: string,
  existingIds: ReadonlyArray<string>,
): ProjectViewConfig => {
  const id = uniqueProjectConfigId(title, existingIds);
  return {
    ...source,
    id,
    title: title.trim(),
    views: source.views.map((view, index) => ({
      ...view,
      id: viewIdFor(id, view.output, index),
      table: {
        ...view.table,
        columns: view.table.columns.map((column) => ({ ...column })),
      },
      ...(view.filters
        ? { filters: view.filters.map((filter) => ({ ...filter })) }
        : {}),
      ...(view.charts
        ? { charts: view.charts.map((chart) => ({ ...chart })) }
        : {}),
    })),
  };
};

export const viewForFrameReference = (
  config: ProjectViewConfig,
  frameRef: string,
): ProjectViewBuilderConfigRevision['config']['views'][number] | undefined => {
  const outputName = outputNameForFrameRef(config.recipeRef.name, frameRef);
  return outputName
    ? config.views.find((view) => view.output === outputName)
    : undefined;
};

export const canUseViewColumnPresentation = (column: {
  readonly filterable: boolean;
  readonly chartable: boolean;
}): { readonly filterable: boolean; readonly chartable: boolean } => ({
  filterable: column.filterable,
  chartable: column.chartable,
});

export interface RemovedViewBindingResult {
  readonly config: ProjectViewConfig;
  readonly removed: ReadonlyArray<string>;
}

export const removeUnavailableViewBindings = (
  config: ProjectViewConfig,
  catalog: ProjectViewBuilderCatalog,
  viewId?: string,
): RemovedViewBindingResult => {
  const removed: string[] = [];
  const frameColumns = new Map(
    catalog.frames.map((frame) => [
      frame.id,
      new Map(frame.columns.map((column) => [column.name, column])),
    ]),
  );
  const views = config.views.map((view) => {
    if (viewId && view.id !== viewId) return view;
    const columns = frameColumns.get(view.output);
    const validTableColumns = view.table.columns.filter((column) => {
      const available = columns?.has(column.column) ?? false;
      if (!available)
        removed.push(`${view.title}: table column ${column.column}`);
      return available;
    });
    const filters = (view.filters ?? []).filter((filter) => {
      const available = columns?.get(filter.column);
      const valid = Boolean(available?.filterable);
      if (!valid) removed.push(`${view.title}: filter ${filter.column}`);
      return valid;
    });
    const charts = (view.charts ?? []).filter((chart) => {
      const available = columns?.get(chart.column);
      const valid = Boolean(available?.chartable);
      if (!valid) removed.push(`${view.title}: chart ${chart.column}`);
      return valid;
    });
    const fixedFilters = Object.fromEntries(
      Object.entries(view.fixedFilters ?? {}).filter(([column]) => {
        const valid = Boolean(columns?.get(column)?.filterable);
        if (!valid) removed.push(`${view.title}: fixed filter ${column}`);
        return valid;
      }),
    );
    const actions = (view.actions ?? []).map((action) => {
      const actionColumns = action.columns ?? [];
      const availableActionColumns = actionColumns.filter((column) => {
        const available = columns?.has(column) ?? false;
        if (!available) removed.push(`${view.title}: action column ${column}`);
        return available;
      });
      const exportHeaders = Object.fromEntries(
        Object.entries(action.exportHeaders ?? {}).filter(([column]) => {
          const available = columns?.has(column) ?? false;
          if (!available)
            removed.push(`${view.title}: action header ${column}`);
          return available;
        }),
      );
      return {
        ...action,
        ...(action.columns ? { columns: availableActionColumns } : {}),
        ...(action.exportHeaders ? { exportHeaders } : {}),
      };
    });
    return {
      ...view,
      table: { ...view.table, columns: validTableColumns },
      ...(view.filters ? { filters } : {}),
      ...(view.charts ? { charts } : {}),
      ...(view.fixedFilters ? { fixedFilters } : {}),
      ...(view.actions ? { actions } : {}),
    };
  });
  const outputs = new Map(
    config.views.map((view) => [view.output, frameColumns.get(view.output)]),
  );
  const selectedOutputs = new Set(
    config.views
      .filter((view) => !viewId || view.id === viewId)
      .map((view) => view.output),
  );
  const sharedFilters = Object.fromEntries(
    Object.entries(config.sharedFilters ?? {}).map(([name, filters]) => {
      const availableFilters = filters.filter((filter) => {
        if (viewId && !selectedOutputs.has(filter.output)) return true;
        const valid = Boolean(
          outputs.get(filter.output)?.get(filter.column)?.filterable,
        );
        if (!valid)
          removed.push(
            `Shared filter ${name}: ${filter.output}/${filter.column}`,
          );
        return valid;
      });
      return [name, availableFilters];
    }),
  );
  const nextConfig = {
    ...config,
    views,
    ...(config.sharedFilters ? { sharedFilters } : {}),
  };
  return { config: nextConfig, removed };
};

export const moveArrayItem = <T>(
  values: ReadonlyArray<T>,
  index: number,
  offset: -1 | 1,
): T[] => {
  const nextIndex = index + offset;
  if (index < 0 || nextIndex < 0 || nextIndex >= values.length) {
    return [...values];
  }
  const next = [...values];
  const [selected] = next.splice(index, 1);
  next.splice(nextIndex, 0, selected);
  return next;
};
