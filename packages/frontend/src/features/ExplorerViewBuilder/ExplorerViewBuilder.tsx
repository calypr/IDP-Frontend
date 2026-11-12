import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Tabs,
  Title,
} from '@mantine/core';
import {
  useAdoptProjectViewBuilderCatalogsMutation,
  useDeleteProjectViewConfigMutation,
  useGetProjectViewBuilderQuery,
  useSaveProjectViewConfigMutation,
} from '@gen3/core';
import type { ProjectViewConfig } from '@gen3/core';
import {
  duplicateProjectConfig,
  projectConfigFromCatalog,
  projectViewFromFrame,
  updateProjectView,
} from './projectViewDraft';
import { ProjectViewDefaults } from './components/ProjectViewDefaults';
import { ProjectViewEditor } from './components/ProjectViewEditor';

interface LocalConfigDraft {
  readonly config: ProjectViewConfig;
  readonly expectedRevisionId: string;
  readonly dirty: boolean;
}

export interface ExplorerViewBuilderProps {
  readonly project: string;
  readonly selectedConfigId?: string;
  readonly onSelectConfig: (configId: string | undefined) => void;
  readonly viewHref: string;
  readonly toolbarTarget?: HTMLElement | null;
}

type ErrorDetails = {
  readonly status?: number;
  readonly message: string;
};

const errorDetails = (error: unknown): ErrorDetails => {
  if (error instanceof Error) return { message: error.message };
  if (typeof error !== 'object' || error === null) {
    return { message: 'The request could not be completed.' };
  }
  const status =
    'status' in error && typeof error.status === 'number'
      ? error.status
      : undefined;
  if ('message' in error && typeof error.message === 'string') {
    return { status, message: error.message };
  }
  if ('message' in error && typeof error.message === 'string') {
    return { status, message: error.message };
  }
  const data = 'data' in error ? error.data : undefined;
  if (typeof data === 'string') return { status, message: data };
  if (typeof data === 'object' && data !== null && 'message' in data) {
    return {
      status,
      message:
        typeof data.message === 'string'
          ? data.message
          : 'The request could not be completed.',
    };
  }
  return {
    status,
    message:
      'error' in error && typeof error.error === 'string'
        ? error.error
        : 'The request could not be completed.',
  };
};

export const ExplorerViewBuilder = ({
  project,
  selectedConfigId: routeConfigId,
  onSelectConfig,
  toolbarTarget,
}: ExplorerViewBuilderProps): JSX.Element => {
  const stateQuery = useGetProjectViewBuilderQuery({ project });
  const [saveConfig, saveConfigStatus] = useSaveProjectViewConfigMutation();
  const [deleteConfig, deleteConfigStatus] =
    useDeleteProjectViewConfigMutation();
  const [adoptCatalogs, adoptCatalogsStatus] =
    useAdoptProjectViewBuilderCatalogsMutation();
  const [drafts, setDrafts] = useState<
    Readonly<Record<string, LocalConfigDraft>>
  >({});
  const [newConfigTitle, setNewConfigTitle] = useState('');
  const [newConfigRecipe, setNewConfigRecipe] = useState<string | null>(null);
  const [newFrameId, setNewFrameId] = useState<string | null>(null);
  const [tableSelection, setTableSelection] = useState<{
    configId: string;
    tabId: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<ErrorDetails | null>(null);

  const state = stateQuery.data;
  const selectedConfigId =
    routeConfigId || state?.settings.defaultConfigId || '';
  const serverConfigRevision = state?.configs.find(
    (entry) => entry.config.id === selectedConfigId,
  );
  const localDraft = drafts[selectedConfigId];
  const localDraftMatches = Boolean(
    localDraft &&
    (localDraft.dirty ||
      !serverConfigRevision ||
      localDraft.expectedRevisionId === serverConfigRevision.revisionId ||
      stateQuery.isFetching),
  );
  const selectedConfig = localDraftMatches
    ? localDraft?.config
    : serverConfigRevision?.config;
  const selectedTableId =
    selectedConfig?.views.find(
      (view) =>
        tableSelection?.configId === selectedConfig.id &&
        tableSelection.tabId === view.id,
    )?.id ??
    selectedConfig?.views[0]?.id ??
    null;
  const expectedRevisionId = localDraftMatches
    ? (localDraft?.expectedRevisionId ?? '')
    : (serverConfigRevision?.revisionId ?? '');
  const isDirty = localDraftMatches ? (localDraft?.dirty ?? false) : false;
  const selectedCatalog = state?.catalogs.find(
    (catalog) => catalog.recipeName === selectedConfig?.recipeRef.name,
  );
  const currentCatalogRevision = selectedConfig
    ? state?.settings.catalogs[selectedConfig.recipeRef.name]
    : undefined;
  const allConfigIds = [
    ...(state?.configs.map((entry) => entry.config.id) ?? []),
    ...Object.keys(drafts),
  ];
  const uniqueConfigIds = [...new Set(allConfigIds)];
  const selectableConfigs = new Map<
    string,
    { title: string; saved: boolean }
  >();
  state?.configs.forEach((entry) =>
    selectableConfigs.set(entry.config.id, {
      title: entry.config.title,
      saved: true,
    }),
  );
  Object.values(drafts).forEach((draft) =>
    selectableConfigs.set(draft.config.id, {
      title: draft.config.title,
      saved: Boolean(draft.expectedRevisionId),
    }),
  );
  const recipeForNewConfig =
    state?.catalogs.length === 1
      ? state.catalogs[0].recipeName
      : newConfigRecipe;
  const availableNewFrames = (selectedCatalog?.frames ?? []).filter(
    (frame) => !selectedConfig?.views.some((view) => view.output === frame.id),
  );

  const commitConfig = (config: ProjectViewConfig) => {
    const previous = drafts[config.id];
    const saved = state?.configs.find((entry) => entry.config.id === config.id);
    setDrafts((current) => ({
      ...current,
      [config.id]: {
        config,
        expectedRevisionId:
          previous?.expectedRevisionId ?? saved?.revisionId ?? '',
        dirty: true,
      },
    }));
    setSaveError(null);
  };

  const handleCreateConfig = () => {
    const catalog = state?.catalogs.find(
      (candidate) => candidate.recipeName === recipeForNewConfig,
    );
    const title = newConfigTitle.trim();
    if (!catalog || !title || catalog.frames.length === 0) return;
    const config = projectConfigFromCatalog(catalog, title, uniqueConfigIds);
    setDrafts((current) => ({
      ...current,
      [config.id]: { config, expectedRevisionId: '', dirty: true },
    }));
    setNewConfigTitle('');
    setNewConfigRecipe(null);
    onSelectConfig(config.id);
  };

  const handleDuplicateConfig = () => {
    if (!selectedConfig) return;
    const config = duplicateProjectConfig(
      selectedConfig,
      `${selectedConfig.title} copy`,
      uniqueConfigIds,
    );
    setDrafts((current) => ({
      ...current,
      [config.id]: { config, expectedRevisionId: '', dirty: true },
    }));
    onSelectConfig(config.id);
  };

  const handleAddTab = () => {
    if (!selectedConfig || !selectedCatalog || !newFrameId) return;
    const frame = selectedCatalog.frames.find(
      (candidate) => candidate.id === newFrameId,
    );
    if (!frame) return;
    const nextView = projectViewFromFrame(
      selectedConfig.id,
      frame,
      selectedConfig.views.length,
    );
    commitConfig({
      ...selectedConfig,
      views: [...selectedConfig.views, nextView],
    });
    setNewFrameId(null);
    setTableSelection({ configId: selectedConfig.id, tabId: nextView.id });
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig || !currentCatalogRevision || !isDirty) return;
    const submittedConfig = selectedConfig;
    setSaveError(null);
    try {
      const updated = await saveConfig({
        project,
        configId: submittedConfig.id,
        request: {
          expectedRevisionId,
          catalogRevisionId: currentCatalogRevision,
          config: submittedConfig,
        },
      }).unwrap();
      const saved = updated.configs.find(
        (entry) => entry.config.id === submittedConfig.id,
      );
      if (saved) {
        setDrafts((current) => {
          const latestDraft = current[saved.config.id];
          const nextDraft =
            latestDraft && latestDraft.config !== submittedConfig
              ? {
                  ...latestDraft,
                  expectedRevisionId: saved.revisionId,
                  dirty: true,
                }
              : {
                  config: saved.config,
                  expectedRevisionId: saved.revisionId,
                  dirty: false,
                };
          return { ...current, [saved.config.id]: nextDraft };
        });
      }
    } catch (error) {
      setSaveError(errorDetails(error));
    }
  };

  const handleDeleteConfig = async () => {
    if (!selectedConfig || !serverConfigRevision || !state) return;
    setSaveError(null);
    try {
      const updated = await deleteConfig({
        project,
        configId: selectedConfig.id,
        expectedRevisionId: serverConfigRevision.revisionId,
      }).unwrap();
      setDrafts((current) => {
        const { [selectedConfig.id]: _deleted, ...remaining } = current;
        return remaining;
      });
      const nextConfigId =
        updated.settings.defaultConfigId || updated.configs[0]?.config.id;
      onSelectConfig(nextConfigId);
    } catch (error) {
      setSaveError(errorDetails(error));
    }
  };

  const handleAdoptCatalogs = async () => {
    try {
      await adoptCatalogs({ project }).unwrap();
      setSaveError(null);
    } catch (error) {
      setSaveError(errorDetails(error));
    }
  };

  const isMutationPending =
    saveConfigStatus.isLoading ||
    deleteConfigStatus.isLoading ||
    adoptCatalogsStatus.isLoading;
  const error =
    saveError ?? (stateQuery.error ? errorDetails(stateQuery.error) : null);
  const isConflict = error?.status === 409;

  if (stateQuery.isLoading && !state) {
    return (
      <p role="status" className="p-6">
        Loading project view settings…
      </p>
    );
  }
  if (!state) {
    return (
      <main className="mx-auto max-w-screen-xl space-y-4 p-6">
        <Alert color="red" title="View Builder unavailable">
          {error?.message ?? 'Project view settings could not be loaded.'}
        </Alert>
        <Button variant="default" onClick={() => void stateQuery.refetch()}>
          Retry
        </Button>
      </main>
    );
  }

  const saveActions = (
    <Group gap="sm" wrap="nowrap" aria-label="View configuration actions">
      <Badge variant="light" color={isDirty ? 'yellow' : 'gray'} role="status">
        {isDirty ? 'Unsaved changes' : 'Saved'}
      </Badge>
      <Button
        size="xs"
        loading={saveConfigStatus.isLoading}
        disabled={
          !state.canEdit ||
          !isDirty ||
          isMutationPending ||
          !currentCatalogRevision ||
          (selectedConfig?.views.length ?? 0) === 0
        }
        onClick={() => void handleSaveConfig()}
      >
        Save config
      </Button>
    </Group>
  );

  return (
    <main
      aria-label="View Builder"
      className="mx-auto max-w-screen-2xl space-y-2 px-4 py-2 sm:px-6"
    >
      {toolbarTarget ? (
        createPortal(saveActions, toolbarTarget)
      ) : (
        <div className="flex justify-center">{saveActions}</div>
      )}

      {error ? (
        <Alert
          color={isConflict ? 'yellow' : 'red'}
          title={
            isConflict
              ? 'This config changed elsewhere'
              : 'View Builder request failed'
          }
        >
          <Stack gap="xs">
            <Text size="sm">{error.message}</Text>
            {isConflict && selectedConfigId ? (
              <Group>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() => {
                    setDrafts((current) => {
                      const { [selectedConfigId]: _discarded, ...remaining } =
                        current;
                      return remaining;
                    });
                    setSaveError(null);
                    void stateQuery.refetch();
                  }}
                >
                  Discard draft and reload
                </Button>
                <Text size="xs">
                  Your local draft is still preserved until you choose to
                  reload.
                </Text>
              </Group>
            ) : null}
          </Stack>
        </Alert>
      ) : null}

      {!state.canEdit ? (
        <Alert color="blue" variant="light" title="View only">
          You can inspect saved configs and published outputs, but do not have
          project write access.
        </Alert>
      ) : null}

      {state.catalogs.length === 0 ? (
        <section
          aria-label="Table workspace"
          className="min-w-0 rounded-md border border-base-lighter bg-white shadow-sm"
        >
          <Stack gap="sm">
            <Title order={3}>No published tables are available yet</Title>
            <Text c="dimmed" size="sm">
              Make the tables already published for this project available for
              editing views. No data is reloaded.
            </Text>
            {state.canEdit ? (
              <Button
                size="xs"
                loading={adoptCatalogsStatus.isLoading}
                disabled={isMutationPending}
                onClick={() => void handleAdoptCatalogs()}
              >
                Use existing published data
              </Button>
            ) : null}
          </Stack>
        </section>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section
          aria-label="Project views"
          className="min-w-0 rounded-md border border-base-lighter bg-white p-3 shadow-sm"
        >
          <Stack gap="xs">
            <Group align="end" wrap="wrap" gap="xs">
              <Select
                size="xs"
                className="min-w-0 flex-[1_1_9rem]"
                label="Project view"
                placeholder="Select a view"
                data={Array.from(selectableConfigs, ([value, item]) => ({
                  value,
                  label: item.title || value,
                }))}
                value={selectedConfigId || null}
                onChange={(value) => onSelectConfig(value ?? undefined)}
                disabled={!selectableConfigs.size}
                searchable
                clearable
              />
              {selectedConfig ? (
                <TextInput
                  size="xs"
                  label="View title"
                  className="min-w-0 flex-[1_1_9rem]"
                  value={selectedConfig.title}
                  disabled={!state.canEdit}
                  onChange={(event) =>
                    commitConfig({
                      ...selectedConfig,
                      title: event.currentTarget.value,
                    })
                  }
                />
              ) : null}
            </Group>
            <Group align="end" wrap="wrap" gap="xs">
              <TextInput
                size="xs"
                label="New view title"
                className="min-w-0 flex-[1_1_9rem]"
                value={newConfigTitle}
                onChange={(event) =>
                  setNewConfigTitle(event.currentTarget.value)
                }
                disabled={!state.canEdit}
              />
              {state.catalogs.length > 1 ? (
                <Select
                  size="xs"
                  label="Dataframer configuration"
                  placeholder="Choose a dataframer configuration"
                  data={state.catalogs.map((catalog) => ({
                    value: catalog.recipeName,
                    label: catalog.recipeName,
                  }))}
                  value={newConfigRecipe}
                  onChange={setNewConfigRecipe}
                  disabled={!state.canEdit}
                  searchable
                  clearable
                />
              ) : null}
              <Button
                size="xs"
                disabled={
                  !state.canEdit ||
                  !newConfigTitle.trim() ||
                  !recipeForNewConfig ||
                  !state.catalogs.some(
                    (catalog) => catalog.recipeName === recipeForNewConfig,
                  )
                }
                onClick={handleCreateConfig}
              >
                Create view
              </Button>
              {selectedConfig ? (
                <Button
                  size="xs"
                  variant="default"
                  disabled={!state.canEdit || isMutationPending}
                  onClick={handleDuplicateConfig}
                >
                  Duplicate view
                </Button>
              ) : null}
              {selectedConfig && serverConfigRevision ? (
                <Button
                  size="xs"
                  color="red"
                  variant="light"
                  loading={deleteConfigStatus.isLoading}
                  disabled={
                    !state.canEdit ||
                    isMutationPending ||
                    selectedConfig.id === state.settings.defaultConfigId
                  }
                  onClick={() => void handleDeleteConfig()}
                >
                  Delete view
                </Button>
              ) : null}
            </Group>
          </Stack>
        </section>

        <ProjectViewDefaults
          project={project}
          state={state}
          canEdit={state.canEdit}
        />
      </div>

      {selectedConfig ? (
        <section className="border-b border-base-lighter pb-2">
          <Stack gap="sm">
            {!currentCatalogRevision ? (
              <Alert
                color="yellow"
                variant="light"
                title="Published data is not available"
              >
                This view is preserved, but changes cannot be saved until its
                published data is available again.
              </Alert>
            ) : null}

            {serverConfigRevision?.diagnostics?.length ? (
              <Alert
                color="yellow"
                variant="light"
                title="Some saved view bindings need attention"
              >
                <Stack gap="xs">
                  {serverConfigRevision.diagnostics.map((diagnostic, index) => (
                    <Text key={`${diagnostic.code}-${index}`} size="sm">
                      {diagnostic.message}
                      {diagnostic.fieldPath ? ` (${diagnostic.fieldPath})` : ''}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            ) : null}

            <Tabs
              value={selectedTableId}
              onChange={(tabId) => {
                if (tabId)
                  setTableSelection({ configId: selectedConfig.id, tabId });
              }}
              keepMounted={false}
            >
              <Group
                align="center"
                gap="md"
                className="rounded-t-md border-b border-base-lighter bg-base-lightest px-3 py-2"
              >
                <DragDropContext
                  onDragEnd={({ source, destination }) => {
                    if (
                      !state.canEdit ||
                      !currentCatalogRevision ||
                      !destination ||
                      source.index === destination.index
                    )
                      return;
                    const views = [...selectedConfig.views];
                    const [moved] = views.splice(source.index, 1);
                    if (!moved) return;
                    views.splice(destination.index, 0, moved);
                    if (selectedTableId)
                      setTableSelection({
                        configId: selectedConfig.id,
                        tabId: selectedTableId,
                      });
                    commitConfig({ ...selectedConfig, views });
                  }}
                >
                  <Droppable
                    droppableId={`tabs-${selectedConfig.id}`}
                    direction="horizontal"
                  >
                    {(provided) => (
                      <Tabs.List
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        aria-label="Table editors"
                        className="min-w-0 max-w-full overflow-x-auto flex-nowrap"
                      >
                        {selectedConfig.views.map((view, index) => (
                          <Draggable
                            key={view.id}
                            draggableId={view.id}
                            index={index}
                            isDragDisabled={
                              !state.canEdit || !currentCatalogRevision
                            }
                            disableInteractiveElementBlocking
                          >
                            {(dragProvided, snapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                style={dragProvided.draggableProps.style}
                                className={`flex shrink-0 items-center rounded-t ${snapshot.isDragging ? 'bg-white shadow-md ring-2 ring-primary' : ''}`}
                              >
                                <button
                                  type="button"
                                  {...dragProvided.dragHandleProps}
                                  disabled={
                                    !state.canEdit || !currentCatalogRevision
                                  }
                                  aria-label={`Reorder tab ${view.title || view.output}`}
                                  title="Drag to reorder tabs. Keyboard: Space to pick up, left/right arrows to move, Space to drop, Escape to cancel."
                                  className="cursor-grab rounded px-1 py-2 text-base-darkest hover:bg-base-lighter focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing disabled:cursor-default disabled:opacity-40"
                                >
                                  <svg
                                    width="10"
                                    height="16"
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
                                <Tabs.Tab value={view.id}>
                                  {view.title || view.output}
                                </Tabs.Tab>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Tabs.List>
                    )}
                  </Droppable>
                </DragDropContext>
                <Group
                  align="end"
                  gap="xs"
                  wrap="nowrap"
                  className="w-full sm:w-auto"
                >
                  <Select
                    size="xs"
                    className="min-w-0 flex-1 sm:w-48"
                    aria-label="Add a tab"
                    placeholder="Add a table"
                    data={availableNewFrames.map((frame) => ({
                      value: frame.id,
                      label: frame.title || frame.id,
                    }))}
                    value={newFrameId}
                    onChange={setNewFrameId}
                    disabled={
                      !state.canEdit ||
                      !currentCatalogRevision ||
                      !availableNewFrames.length
                    }
                    searchable
                    clearable
                  />
                  <Button
                    size="xs"
                    variant="light"
                    disabled={
                      !state.canEdit || !newFrameId || !currentCatalogRevision
                    }
                    onClick={handleAddTab}
                  >
                    Add tab
                  </Button>
                </Group>
              </Group>
              {selectedConfig.views.map((view, index) => (
                <Tabs.Panel
                  key={view.id}
                  value={view.id}
                  className="px-3 pb-3"
                  pt="xs"
                >
                  <ProjectViewEditor
                    config={selectedConfig}
                    catalog={selectedCatalog}
                    canEdit={state.canEdit && Boolean(currentCatalogRevision)}
                    index={index}
                    total={selectedConfig.views.length}
                    onChange={commitConfig}
                    onChangeOutput={(output) =>
                      commitConfig(
                        updateProjectView(
                          selectedConfig,
                          view.id,
                          (currentView) => ({
                            ...currentView,
                            output,
                          }),
                        ),
                      )
                    }
                    onRemove={() =>
                      commitConfig({
                        ...selectedConfig,
                        views: selectedConfig.views.filter(
                          (candidate) => candidate.id !== view.id,
                        ),
                      })
                    }
                  />
                </Tabs.Panel>
              ))}
              {(selectedConfig?.views.length ?? 0) === 0 ? (
                <Alert color="yellow" title="Add a tab before saving">
                  A project view must contain at least one tab.
                </Alert>
              ) : null}
            </Tabs>
          </Stack>
        </section>
      ) : null}
    </main>
  );
};

export default ExplorerViewBuilder;
