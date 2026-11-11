import React from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import type {
  ProjectViewBuilderCatalog,
  ProjectViewBuilderFrame,
  ProjectViewConfig,
} from '@gen3/core';
import {
  canUseViewColumnPresentation,
  moveArrayItem,
  removeUnavailableViewBindings,
} from '../projectViewDraft';

const frameForView = (
  catalog: ProjectViewBuilderCatalog | undefined,
  output: string,
): ProjectViewBuilderFrame | undefined =>
  catalog?.frames.find((frame) => frame.id === output);

const updateView = (
  config: ProjectViewConfig,
  viewId: string,
  update: (
    view: ProjectViewConfig['views'][number],
  ) => ProjectViewConfig['views'][number],
): ProjectViewConfig => ({
  ...config,
  views: config.views.map((view) => (view.id === viewId ? update(view) : view)),
});

const FieldRow = ({
  config,
  view,
  frame,
  canEdit,
  onChange,
}: {
  readonly config: ProjectViewConfig;
  readonly view: ProjectViewConfig['views'][number];
  readonly frame?: ProjectViewBuilderFrame;
  readonly canEdit: boolean;
  readonly onChange: (config: ProjectViewConfig) => void;
}) => {
  const tableColumns = view.table.columns;
  const availableColumns = (frame?.columns ?? []).filter(
    (column) =>
      !tableColumns.some((configured) => configured.column === column.name),
  );
  const updateColumn = (
    columnName: string,
    update: (
      column: (typeof tableColumns)[number],
    ) => (typeof tableColumns)[number],
  ) => {
    onChange(
      updateView(config, view.id, (currentView) => ({
        ...currentView,
        table: {
          ...currentView.table,
          columns: currentView.table.columns.map((column) =>
            column.column === columnName ? update(column) : column,
          ),
        },
      })),
    );
  };
  const updateFilter = (
    columnName: string,
    update: (
      filter: NonNullable<typeof view.filters>[number],
    ) => NonNullable<typeof view.filters>[number],
  ) => {
    const filters = view.filters ?? [];
    const exists = filters.some((filter) => filter.column === columnName);
    const nextFilters = exists
      ? filters.map((filter) =>
          filter.column === columnName ? update(filter) : filter,
        )
      : filters;
    onChange(
      updateView(config, view.id, (currentView) => ({
        ...currentView,
        filters: nextFilters,
      })),
    );
  };
  const updateChart = (
    columnName: string,
    update: (
      chart: NonNullable<typeof view.charts>[number],
    ) => NonNullable<typeof view.charts>[number],
  ) => {
    const charts = view.charts ?? [];
    const exists = charts.some((chart) => chart.column === columnName);
    const nextCharts = exists
      ? charts.map((chart) =>
          chart.column === columnName ? update(chart) : chart,
        )
      : charts;
    onChange(
      updateView(config, view.id, (currentView) => ({
        ...currentView,
        charts: nextCharts,
      })),
    );
  };

  const addPublishedColumn = (columnName: string) => {
    const source = frame?.columns.find((column) => column.name === columnName);
    if (!source) return;
    onChange(
      updateView(config, view.id, (currentView) => ({
        ...currentView,
        table: {
          ...currentView.table,
          columns: [
            ...currentView.table.columns,
            { column: source.name, label: source.label, visible: true },
          ],
        },
      })),
    );
  };

  return (
    <Stack gap="xs">
      <Group align="end" wrap="wrap" gap="xs">
        <Select
          size="xs"
          className="min-w-0 flex-1"
          label="Add column"
          aria-label="Add a column from this published frame"
          placeholder={
            availableColumns.length ? 'Choose a column' : 'No more columns'
          }
          data={availableColumns.map((column) => ({
            value: column.name,
            label: `${column.label} · ${column.name}`,
          }))}
          value={null}
          onChange={(columnName) => {
            if (columnName) addPublishedColumn(columnName);
          }}
          disabled={!canEdit || availableColumns.length === 0}
          searchable
          clearable
        />
      </Group>

      {tableColumns.length === 0 ? (
        <Text c="dimmed" size="sm">
          This tab has no configured columns.
        </Text>
      ) : (
        <Stack gap="xs">
          {tableColumns.map((column, index) => {
            const schemaColumn = frame?.columns.find(
              (candidate) => candidate.name === column.column,
            );
            const capabilities = schemaColumn
              ? canUseViewColumnPresentation(schemaColumn)
              : { filterable: false, chartable: false };
            const filter = view.filters?.find(
              (candidate) => candidate.column === column.column,
            );
            const chart = view.charts?.find(
              (candidate) => candidate.column === column.column,
            );
            return (
              <div
                key={column.column}
                role="group"
                aria-label={`Column ${column.label ?? schemaColumn?.label ?? column.column}`}
                className="border-b border-base-lighter py-2"
                title={column.column}
              >
                <div className="grid gap-2 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(12rem,1.1fr)_minmax(16rem,1fr)_minmax(9rem,.8fr)_minmax(16rem,1.1fr)]">
                  <Group align="end" wrap="wrap" gap="xs">
                    <TextInput
                      size="xs"
                      className="min-w-0 flex-1"
                      aria-label={`Column label for ${schemaColumn?.label ?? column.column}`}
                      variant="unstyled"
                      classNames={{
                        input:
                          'rounded px-2 hover:bg-base-lightest focus:bg-white focus:outline focus:outline-2 focus:outline-primary',
                      }}
                      value={
                        column.label ?? schemaColumn?.label ?? column.column
                      }
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateColumn(column.column, (current) => ({
                          ...current,
                          label: event.currentTarget.value,
                        }))
                      }
                    />
                    <Button
                      size="xs"
                      aria-label={`Move ${column.label ?? column.column} up`}
                      variant="default"
                      disabled={!canEdit || index === 0}
                      onClick={() =>
                        onChange(
                          updateView(config, view.id, (currentView) => ({
                            ...currentView,
                            table: {
                              ...currentView.table,
                              columns: moveArrayItem(
                                currentView.table.columns,
                                index,
                                -1,
                              ),
                            },
                          })),
                        )
                      }
                    >
                      ↑
                    </Button>
                    <Button
                      size="xs"
                      aria-label={`Move ${column.label ?? column.column} down`}
                      variant="default"
                      disabled={!canEdit || index === tableColumns.length - 1}
                      onClick={() =>
                        onChange(
                          updateView(config, view.id, (currentView) => ({
                            ...currentView,
                            table: {
                              ...currentView.table,
                              columns: moveArrayItem(
                                currentView.table.columns,
                                index,
                                1,
                              ),
                            },
                          })),
                        )
                      }
                    >
                      ↓
                    </Button>
                    <Button
                      size="xs"
                      aria-label={`Remove ${column.label ?? column.column}`}
                      color="red"
                      variant="subtle"
                      disabled={!canEdit}
                      onClick={() =>
                        onChange(
                          updateView(config, view.id, (currentView) => ({
                            ...currentView,
                            table: {
                              ...currentView.table,
                              columns: currentView.table.columns.filter(
                                (current) => current.column !== column.column,
                              ),
                            },
                          })),
                        )
                      }
                    >
                      ×
                    </Button>
                  </Group>
                  {!schemaColumn ? (
                    <Alert
                      color="yellow"
                      variant="light"
                      title="Column not in current catalog"
                    >
                      This saved column is preserved. Remove it only if the view
                      should no longer reference it.
                    </Alert>
                  ) : null}
                  <Group align="center" wrap="wrap" gap="sm">
                    <Checkbox
                      size="xs"
                      label="Visible"
                      checked={column.visible}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateColumn(column.column, (current) => ({
                          ...current,
                          visible: event.currentTarget.checked,
                        }))
                      }
                    />
                    <Checkbox
                      size="xs"
                      label="Pinned"
                      checked={column.pinned ?? false}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateColumn(column.column, (current) => ({
                          ...current,
                          pinned: event.currentTarget.checked,
                        }))
                      }
                    />
                    <Checkbox
                      size="xs"
                      label="Filter"
                      checked={Boolean(filter)}
                      disabled={
                        !canEdit || (!capabilities.filterable && !filter)
                      }
                      onChange={(event) => {
                        if (event.currentTarget.checked) {
                          const filters = view.filters ?? [];
                          if (
                            filters.some(
                              (candidate) => candidate.column === column.column,
                            )
                          )
                            return;
                          onChange(
                            updateView(config, view.id, (currentView) => ({
                              ...currentView,
                              filters: [
                                ...filters,
                                {
                                  column: column.column,
                                  label:
                                    column.label ??
                                    schemaColumn?.label ??
                                    column.column,
                                },
                              ],
                            })),
                          );
                        } else {
                          onChange(
                            updateView(config, view.id, (currentView) => ({
                              ...currentView,
                              filters: (currentView.filters ?? []).filter(
                                (candidate) =>
                                  candidate.column !== column.column,
                              ),
                            })),
                          );
                        }
                      }}
                    />
                    <Checkbox
                      size="xs"
                      label="Chart"
                      checked={Boolean(chart)}
                      disabled={!canEdit || (!capabilities.chartable && !chart)}
                      onChange={(event) => {
                        if (event.currentTarget.checked) {
                          const charts = view.charts ?? [];
                          if (
                            charts.some(
                              (candidate) => candidate.column === column.column,
                            )
                          )
                            return;
                          onChange(
                            updateView(config, view.id, (currentView) => ({
                              ...currentView,
                              charts: [
                                ...charts,
                                {
                                  column: column.column,
                                  type: 'bar',
                                  title:
                                    column.label ??
                                    schemaColumn?.label ??
                                    column.column,
                                },
                              ],
                            })),
                          );
                        } else {
                          onChange(
                            updateView(config, view.id, (currentView) => ({
                              ...currentView,
                              charts: (currentView.charts ?? []).filter(
                                (candidate) =>
                                  candidate.column !== column.column,
                              ),
                            })),
                          );
                        }
                      }}
                    />
                  </Group>
                  {filter ? (
                    <TextInput
                      size="xs"
                      className="xl:col-start-3"
                      label="Filter label"
                      aria-label={`Filter label for ${column.label ?? column.column}`}
                      variant="unstyled"
                      classNames={{
                        input:
                          'rounded px-2 hover:bg-base-lightest focus:bg-white focus:outline focus:outline-2 focus:outline-primary',
                      }}
                      value={filter.label ?? ''}
                      disabled={!canEdit}
                      onChange={(event) =>
                        updateFilter(column.column, (current) => ({
                          ...current,
                          label: event.currentTarget.value,
                        }))
                      }
                    />
                  ) : null}
                  {chart ? (
                    <Group
                      align="end"
                      wrap="wrap"
                      gap="xs"
                      className="xl:col-start-4"
                    >
                      <Select
                        size="xs"
                        className="min-w-0 flex-1"
                        label="Chart type"
                        aria-label={`Chart type for ${column.label ?? column.column}`}
                        data={[
                          { value: 'bar', label: 'Bar' },
                          {
                            value: 'horizontalStacked',
                            label: 'Horizontal stacked',
                          },
                          { value: 'pie', label: 'Pie' },
                          { value: 'fullPie', label: 'Full pie' },
                          { value: 'donut', label: 'Donut' },
                        ]}
                        value={chart.type}
                        disabled={!canEdit}
                        onChange={(type) => {
                          if (type)
                            updateChart(column.column, (current) => ({
                              ...current,
                              type,
                            }));
                        }}
                      />
                      <TextInput
                        size="xs"
                        className="min-w-0 flex-1"
                        label="Chart title"
                        variant="unstyled"
                        classNames={{
                          input:
                            'rounded px-2 hover:bg-base-lightest focus:bg-white focus:outline focus:outline-2 focus:outline-primary',
                        }}
                        value={chart.title ?? ''}
                        disabled={!canEdit}
                        onChange={(event) =>
                          updateChart(column.column, (current) => ({
                            ...current,
                            title: event.currentTarget.value,
                          }))
                        }
                      />
                    </Group>
                  ) : null}
                </div>
              </div>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
};

export const ProjectViewEditor = ({
  config,
  catalog,
  canEdit,
  onChange,
  onRemove,
  onMove,
  onChangeOutput,
  index,
  total,
}: {
  readonly config: ProjectViewConfig;
  readonly catalog?: ProjectViewBuilderCatalog;
  readonly canEdit: boolean;
  readonly onChange: (next: ProjectViewConfig) => void;
  readonly onRemove: () => void;
  readonly onChangeOutput: (output: string) => void;
  readonly onMove: (offset: -1 | 1) => void;
  readonly index: number;
  readonly total: number;
}) => {
  const view = config.views[index];
  if (!view) return null;
  const frame = frameForView(catalog, view.output);
  const update = (nextView: typeof view) =>
    onChange(updateView(config, view.id, () => nextView));
  return (
    <section
      id={`view-${view.id}`}
      className="scroll-mt-32 border-t border-base-lighter py-3"
    >
      <Stack gap="xs">
        <Group align="end" wrap="wrap" gap="xs">
          <TextInput
            size="xs"
            className="min-w-0 flex-1"
            label="Tab title"
            value={view.title}
            disabled={!canEdit}
            onChange={(event) =>
              update({ ...view, title: event.currentTarget.value })
            }
          />
          <Select
            size="xs"
            className="w-full min-w-0 sm:w-56"
            label="Table"
            data={[
              ...(frame
                ? []
                : [
                    {
                      value: view.output,
                      label: `${view.output} · unavailable`,
                    },
                  ]),
              ...(catalog?.frames.map((candidate) => ({
                value: candidate.id,
                label: candidate.title || candidate.id,
              })) ?? []),
            ]}
            value={view.output}
            disabled={!canEdit || !catalog}
            onChange={(output) => {
              if (output) onChangeOutput(output);
            }}
            searchable
          />
          <Button
            size="xs"
            aria-label={`Move tab ${view.title} up`}
            variant="default"
            disabled={!canEdit || index === 0}
            onClick={() => onMove(-1)}
          >
            ↑
          </Button>
          <Button
            size="xs"
            aria-label={`Move tab ${view.title} down`}
            variant="default"
            disabled={!canEdit || index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <Button
            size="xs"
            color="red"
            variant="subtle"
            disabled={!canEdit || total <= 1}
            onClick={onRemove}
          >
            Remove tab
          </Button>
        </Group>
        {frame ? (
          <Text c="dimmed" size="sm">
            Published table · {frame.columns.length} columns
          </Text>
        ) : (
          <Alert
            color="yellow"
            variant="light"
            title="Frame not in current catalog"
          >
            This saved tab is preserved. Choose another published table or
            remove the unavailable bindings below.
          </Alert>
        )}
        {frame && catalog ? (
          <UnavailableBindingsRepair
            config={config}
            catalog={catalog}
            viewId={view.id}
            canEdit={canEdit}
            onChange={onChange}
          />
        ) : null}
        <FieldRow
          config={config}
          view={view}
          frame={frame}
          canEdit={canEdit && Boolean(frame)}
          onChange={onChange}
        />
      </Stack>
    </section>
  );
};

const UnavailableBindingsRepair = ({
  config,
  catalog,
  viewId,
  canEdit,
  onChange,
}: {
  readonly config: ProjectViewConfig;
  readonly catalog: ProjectViewBuilderCatalog;
  readonly viewId: string;
  readonly canEdit: boolean;
  readonly onChange: (config: ProjectViewConfig) => void;
}) => {
  const repair = removeUnavailableViewBindings(config, catalog, viewId);
  if (repair.removed.length === 0) return null;
  return (
    <Alert
      color="yellow"
      variant="light"
      title="This tab has unavailable bindings"
    >
      <Stack gap="xs">
        <Text size="sm">
          These saved references no longer match the current published table.
          Review them before choosing to remove them.
        </Text>
        <ul className="list-disc pl-5 text-sm">
          {repair.removed.map((reference) => (
            <li key={reference}>{reference}</li>
          ))}
        </ul>
        <Group>
          <Button
            size="xs"
            color="yellow"
            variant="light"
            disabled={!canEdit}
            onClick={() => onChange(repair.config)}
          >
            Remove these unavailable references
          </Button>
          <Text size="xs">
            Nothing is removed unless you choose this action.
          </Text>
        </Group>
      </Stack>
    </Alert>
  );
};
