import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
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
    <div className="contents">
      <Group
        align="end"
        wrap="wrap"
        gap="xs"
        className="min-w-0 lg:col-start-2 lg:row-start-1"
      >
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
        <DragDropContext
          onDragEnd={({ source, destination }) => {
            if (!canEdit || !destination || source.index === destination.index)
              return;
            const columns = [...tableColumns];
            const [moved] = columns.splice(source.index, 1);
            if (!moved) return;
            columns.splice(destination.index, 0, moved);
            onChange(
              updateView(config, view.id, (current) => ({
                ...current,
                table: { ...current.table, columns },
              })),
            );
          }}
        >
          <Droppable droppableId={`columns-${view.id}`}>
            {(provided) => (
              <Stack
                ref={provided.innerRef}
                {...provided.droppableProps}
                gap={0}
                className="min-w-0 rounded-md border border-base-lighter lg:col-span-2"
              >
                <div
                  aria-hidden="true"
                  className="hidden grid-cols-[minmax(12rem,1.1fr)_minmax(16rem,1fr)_minmax(9rem,.8fr)_minmax(16rem,1.1fr)] items-center gap-2 rounded-t-md border-b border-base-lighter bg-base-lightest px-2 py-2 text-xs font-semibold text-base-darkest xl:grid"
                >
                  <span className="px-2">Column label and order</span>
                  <span>Display options</span>
                  <span className="px-2">Filter label</span>
                  <div className="grid grid-cols-2 gap-2">
                    <span>Chart type</span>
                    <span className="px-2">Chart title</span>
                  </div>
                </div>
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
                    <Draggable
                      key={column.column}
                      draggableId={column.column}
                      index={index}
                      isDragDisabled={!canEdit}
                      disableInteractiveElementBlocking
                    >
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          style={dragProvided.draggableProps.style}
                          data-dragging={snapshot.isDragging || undefined}
                          role="group"
                          aria-label={`Column ${column.label ?? schemaColumn?.label ?? column.column}`}
                          className="border-b border-base-lighter px-2 py-1 last:border-b-0 bg-white data-[dragging=true]:shadow-lg data-[dragging=true]:ring-2 data-[dragging=true]:ring-primary hover:bg-base-lightest focus-within:bg-base-lightest"
                          title={column.column}
                        >
                          <div className="grid items-center gap-2 lg:grid-cols-[minmax(15rem,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(12rem,1.1fr)_minmax(16rem,1fr)_minmax(9rem,.8fr)_minmax(16rem,1.1fr)]">
                            <Group align="center" wrap="nowrap" gap="xs">
                              <button
                                type="button"
                                {...dragProvided.dragHandleProps}
                                disabled={!canEdit}
                                aria-label={`Reorder ${column.label ?? column.column}`}
                                title="Drag to reorder. Keyboard: Space to pick up, arrow keys to move, Space to drop, Escape to cancel."
                                className="shrink-0 cursor-grab rounded px-2 py-1 text-base-darkest hover:bg-base-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                              >
                                <svg
                                  width="12"
                                  height="18"
                                  viewBox="0 0 12 18"
                                  fill="currentColor"
                                  aria-hidden="true"
                                >
                                  <circle cx="3" cy="4" r="1.5" />
                                  <circle cx="9" cy="4" r="1.5" />
                                  <circle cx="3" cy="9" r="1.5" />
                                  <circle cx="9" cy="9" r="1.5" />
                                  <circle cx="3" cy="14" r="1.5" />
                                  <circle cx="9" cy="14" r="1.5" />
                                </svg>
                              </button>
                              <TextInput
                                size="xs"
                                className="min-w-0 flex-1"
                                aria-label={`Column label for ${schemaColumn?.label ?? column.column}`}
                                variant="unstyled"
                                classNames={{
                                  label: 'xl:sr-only',
                                  input:
                                    'rounded border border-transparent px-2 hover:border-base-lighter hover:bg-white focus:bg-white focus:outline focus:outline-2 focus:outline-primary',
                                }}
                                value={
                                  column.label ??
                                  schemaColumn?.label ??
                                  column.column
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
                                aria-label={`Remove ${column.label ?? column.column}`}
                                color="red"
                                variant="subtle"
                                disabled={!canEdit}
                                onClick={() =>
                                  onChange(
                                    updateView(
                                      config,
                                      view.id,
                                      (currentView) => ({
                                        ...currentView,
                                        table: {
                                          ...currentView.table,
                                          columns:
                                            currentView.table.columns.filter(
                                              (current) =>
                                                current.column !==
                                                column.column,
                                            ),
                                        },
                                      }),
                                    ),
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
                                This saved column is preserved. Remove it only
                                if the view should no longer reference it.
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
                                  !canEdit ||
                                  (!capabilities.filterable && !filter)
                                }
                                onChange={(event) => {
                                  if (event.currentTarget.checked) {
                                    const filters = view.filters ?? [];
                                    if (
                                      filters.some(
                                        (candidate) =>
                                          candidate.column === column.column,
                                      )
                                    )
                                      return;
                                    onChange(
                                      updateView(
                                        config,
                                        view.id,
                                        (currentView) => ({
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
                                        }),
                                      ),
                                    );
                                  } else {
                                    onChange(
                                      updateView(
                                        config,
                                        view.id,
                                        (currentView) => ({
                                          ...currentView,
                                          filters: (
                                            currentView.filters ?? []
                                          ).filter(
                                            (candidate) =>
                                              candidate.column !==
                                              column.column,
                                          ),
                                        }),
                                      ),
                                    );
                                  }
                                }}
                              />
                              <Checkbox
                                size="xs"
                                label="Chart"
                                checked={Boolean(chart)}
                                disabled={
                                  !canEdit ||
                                  (!capabilities.chartable && !chart)
                                }
                                onChange={(event) => {
                                  if (event.currentTarget.checked) {
                                    const charts = view.charts ?? [];
                                    if (
                                      charts.some(
                                        (candidate) =>
                                          candidate.column === column.column,
                                      )
                                    )
                                      return;
                                    onChange(
                                      updateView(
                                        config,
                                        view.id,
                                        (currentView) => ({
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
                                        }),
                                      ),
                                    );
                                  } else {
                                    onChange(
                                      updateView(
                                        config,
                                        view.id,
                                        (currentView) => ({
                                          ...currentView,
                                          charts: (
                                            currentView.charts ?? []
                                          ).filter(
                                            (candidate) =>
                                              candidate.column !==
                                              column.column,
                                          ),
                                        }),
                                      ),
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
                                  label: 'xl:sr-only',
                                  input:
                                    'rounded border border-transparent px-2 hover:border-base-lighter hover:bg-white focus:bg-white focus:outline focus:outline-2 focus:outline-primary',
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
                                  classNames={{ label: 'xl:sr-only' }}
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
                                  aria-label={`Chart title for ${column.label ?? column.column}`}
                                  variant="unstyled"
                                  classNames={{
                                    label: 'xl:sr-only',
                                    input:
                                      'rounded border border-transparent px-2 hover:border-base-lighter hover:bg-white focus:bg-white focus:outline focus:outline-2 focus:outline-primary',
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
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </Stack>
            )}
          </Droppable>
        </DragDropContext>
      )}
    </div>
  );
};

export const ProjectViewEditor = ({
  config,
  catalog,
  canEdit,
  onChange,
  onRemove,
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
  readonly index: number;
  readonly total: number;
}) => {
  const view = config.views[index];
  if (!view) return null;
  const frame = frameForView(catalog, view.output);
  const update = (nextView: typeof view) =>
    onChange(updateView(config, view.id, () => nextView));
  return (
    <section id={`view-${view.id}`} className="scroll-mt-32 py-2">
      <div className="grid items-end gap-x-3 gap-y-2 lg:grid-cols-[minmax(0,1fr)_minmax(12rem,.45fr)]">
        <Group
          align="end"
          wrap="wrap"
          gap="xs"
          className="min-w-0 lg:col-start-1 lg:row-start-1"
        >
          <TextInput
            size="xs"
            className="min-w-0 flex-[1_1_9rem]"
            label="Tab title"
            value={view.title}
            disabled={!canEdit}
            onChange={(event) =>
              update({ ...view, title: event.currentTarget.value })
            }
          />
          <Select
            size="xs"
            className="min-w-0 flex-[1_1_9rem]"
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
            color="red"
            variant="subtle"
            disabled={!canEdit || total <= 1}
            onClick={onRemove}
          >
            Remove tab
          </Button>
          {frame ? (
            <Text c="dimmed" size="xs" className="self-center">
              Published table · {frame.columns.length} columns
            </Text>
          ) : null}
        </Group>
        {!frame ? (
          <Alert
            color="yellow"
            variant="light"
            title="Frame not in current catalog"
          >
            This saved tab is preserved. Choose another published table or
            remove the unavailable bindings below.
          </Alert>
        ) : null}
        {frame && catalog ? (
          <div className="lg:col-span-2">
            <UnavailableBindingsRepair
              config={config}
              catalog={catalog}
              viewId={view.id}
              canEdit={canEdit}
              onChange={onChange}
            />
          </div>
        ) : null}
        <FieldRow
          config={config}
          view={view}
          frame={frame}
          canEdit={canEdit && Boolean(frame)}
          onChange={onChange}
        />
      </div>
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
