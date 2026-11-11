import React, { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  useAdoptProjectViewBuilderCatalogsMutation,
  useDeleteProjectViewConfigMutation,
  useGetProjectViewBuilderQuery,
  useSaveProjectViewConfigMutation,
} from '@gen3/core';
import type { ProjectViewBuilderCatalog, ProjectViewConfig } from '@gen3/core';
import {
  duplicateProjectConfig,
  moveArrayItem,
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
  viewHref,
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

  return (
    <main className="mx-auto max-w-screen-2xl space-y-6 p-6">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={1}>Project View Builder</Title>
          <Text c="dimmed" mt="xs">
            Choose tables, columns, filters, and charts for this project.
          </Text>
        </div>
        <Button component="a" href={viewHref} variant="default">
          Open Viewer
        </Button>
      </Group>

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
        <Card withBorder padding="lg">
          <Stack gap="sm">
            <Title order={3}>No published tables are available yet</Title>
            <Text c="dimmed" size="sm">
              Make the tables already published for this project available for
              editing views. No data is reloaded.
            </Text>
            {state.canEdit ? (
              <Button
                loading={adoptCatalogsStatus.isLoading}
                disabled={isMutationPending}
                onClick={() => void handleAdoptCatalogs()}
              >
                Use existing published data
              </Button>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      <Card withBorder padding="lg">
        <Stack gap="md">
          <Title order={2}>Views</Title>
          <Group align="end" wrap="wrap">
            <Select
              className="min-w-64 flex-1"
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
            <TextInput
              label="New view title"
              value={newConfigTitle}
              onChange={(event) => setNewConfigTitle(event.currentTarget.value)}
              disabled={!state.canEdit}
            />
            {state.catalogs.length > 1 ? (
              <Select
                label="Data source"
                placeholder="Choose a data source"
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
                variant="default"
                disabled={!state.canEdit || isMutationPending}
                onClick={handleDuplicateConfig}
              >
                Duplicate view
              </Button>
            ) : null}
            {selectedConfig && serverConfigRevision ? (
              <Button
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
          {selectedConfig &&
          selectedConfig.id === state.settings.defaultConfigId ? (
            <Text c="dimmed" size="xs">
              Set a different project default before deleting this config.
            </Text>
          ) : null}
        </Stack>
      </Card>

      {selectedConfig ? (
        <Card withBorder padding="lg">
          <Stack gap="lg">
            <Group justify="space-between" align="flex-start">
              <div>
                <Title order={2}>{selectedConfig.title}</Title>
                {state.catalogs.length > 1 ? (
                  <Text c="dimmed" size="sm">
                    Data source: {selectedConfig.recipeRef.name}
                  </Text>
                ) : null}
              </div>
              {expectedRevisionId ? (
                <Badge variant="light">Saved revision</Badge>
              ) : (
                <Badge color="yellow">New draft</Badge>
              )}
            </Group>
            <TextInput
              label="View title"
              value={selectedConfig.title}
              disabled={!state.canEdit}
              onChange={(event) =>
                commitConfig({
                  ...selectedConfig,
                  title: event.currentTarget.value,
                })
              }
            />
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

            <Group align="end">
              <Select
                className="min-w-64 flex-1"
                label="Add a tab"
                placeholder="Choose a published table"
                data={availableNewFrames.map((frame) => ({
                  value: frame.id,
                  label: `${frame.title} · ${frame.id}`,
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
                variant="light"
                disabled={
                  !state.canEdit || !newFrameId || !currentCatalogRevision
                }
                onClick={handleAddTab}
              >
                Add tab
              </Button>
            </Group>

            <Stack gap="md">
              {selectedConfig.views.map((view, index) => (
                <ProjectViewEditor
                  key={view.id}
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
                  onMove={(offset) =>
                    commitConfig({
                      ...selectedConfig,
                      views: moveArrayItem(selectedConfig.views, index, offset),
                    })
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
              ))}
              {selectedConfig.views.length === 0 ? (
                <Alert color="yellow" title="Add a tab before saving">
                  A project view must contain at least one tab.
                </Alert>
              ) : null}
            </Stack>

            <Group justify="flex-end">
              <Button
                loading={saveConfigStatus.isLoading}
                disabled={
                  !state.canEdit ||
                  !isDirty ||
                  isMutationPending ||
                  !currentCatalogRevision ||
                  selectedConfig.views.length === 0
                }
                onClick={() => void handleSaveConfig()}
              >
                Save config
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : null}

      <ProjectViewDefaults
        project={project}
        state={state}
        canEdit={state.canEdit}
      />
    </main>
  );
};

export default ExplorerViewBuilder;
