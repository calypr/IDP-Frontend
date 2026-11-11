import React, { useState } from 'react';
import { Alert, Button, Group, Select, Stack, Text } from '@mantine/core';
import {
  useSaveProjectViewDefaultsMutation,
  type ProjectViewBuilderState,
} from '@gen3/core';
import {
  projectViewFrameRef,
  viewForFrameReference,
} from '../projectViewDraft';

interface PendingDefaults {
  readonly configId: string;
  readonly frameId: string;
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  return 'The project default could not be saved.';
};

export const ProjectViewDefaults = ({
  project,
  state,
  canEdit,
}: {
  readonly project: string;
  readonly state: ProjectViewBuilderState;
  readonly canEdit: boolean;
}) => {
  const [saveDefaults, saveDefaultsStatus] =
    useSaveProjectViewDefaultsMutation();
  const [pendingDefaults, setPendingDefaults] = useState<PendingDefaults>();
  const [saveError, setSaveError] = useState<string>();
  const defaultDraft = pendingDefaults ?? {
    configId: state.settings.defaultConfigId,
    frameId: state.settings.defaultFrameId,
  };
  const defaultConfig = state.configs.find(
    ({ config }) => config.id === defaultDraft.configId,
  )?.config;
  const defaultFrameOptions =
    defaultConfig?.views.map((view) => ({
      value: projectViewFrameRef(defaultConfig.recipeRef.name, view.output),
      label: `${view.title} · ${view.output}`,
    })) ?? [];
  const defaultFrame = defaultConfig
    ? viewForFrameReference(defaultConfig, defaultDraft.frameId)
    : undefined;
  const dirty =
    defaultDraft.configId !== state.settings.defaultConfigId ||
    defaultDraft.frameId !== state.settings.defaultFrameId;

  const handleSave = async () => {
    if (!dirty || !defaultConfig || !defaultFrame) return;
    setSaveError(undefined);
    try {
      const updated = await saveDefaults({
        project,
        request: {
          expectedVersion: state.settings.version,
          defaultConfigId: defaultDraft.configId,
          defaultFrameId: defaultDraft.frameId,
        },
      }).unwrap();
      setPendingDefaults({
        configId: updated.settings.defaultConfigId,
        frameId: updated.settings.defaultFrameId,
      });
    } catch (error) {
      setSaveError(errorMessage(error));
    }
  };

  return (
    <section className="pb-2">
      <Stack gap="xs">
        <Group gap="sm">
          <Text size="sm" fw={600}>
            Project default
          </Text>
          <Text c="dimmed" size="xs">
            Saved separately from view edits.
          </Text>
        </Group>
        {saveError ? (
          <Alert color="red" title="Default was not changed">
            {saveError}
          </Alert>
        ) : null}
        <Group align="end" wrap="wrap">
          <Select
            size="xs"
            className="w-full min-w-0 sm:w-64"
            label="Default view"
            placeholder="Choose a saved view"
            data={state.configs.map(({ config }) => ({
              value: config.id,
              label: config.title,
            }))}
            value={defaultDraft.configId || null}
            onChange={(configId) => {
              setPendingDefaults({ configId: configId ?? '', frameId: '' });
              setSaveError(undefined);
            }}
            disabled={!canEdit || state.configs.length === 0}
            searchable
            clearable
          />
          <Select
            size="xs"
            className="w-full min-w-0 sm:w-64"
            label="Default table"
            placeholder="Choose a saved tab"
            data={defaultFrameOptions}
            value={defaultDraft.frameId || null}
            onChange={(frameId) => {
              setPendingDefaults({
                ...defaultDraft,
                frameId: frameId ?? '',
              });
              setSaveError(undefined);
            }}
            disabled={!canEdit || !defaultConfig}
          />
          <Button
            size="xs"
            loading={saveDefaultsStatus.isLoading}
            disabled={!canEdit || !dirty || !defaultConfig || !defaultFrame}
            onClick={() => void handleSave()}
          >
            Save project default
          </Button>
        </Group>
      </Stack>
    </section>
  );
};
