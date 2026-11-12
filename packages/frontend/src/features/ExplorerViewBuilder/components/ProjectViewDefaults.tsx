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
    <section
      aria-label="Project defaults"
      className="min-w-0 rounded-md border border-base-lighter bg-white p-3 shadow-sm"
    >
      <Stack gap="xs">
        {saveError ? (
          <Alert color="red" title="Default was not changed">
            {saveError}
          </Alert>
        ) : null}
        <Group align="end" wrap="wrap" gap="xs">
          <Select
            size="xs"
            className="min-w-0 flex-[1_1_9rem]"
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
            className="min-w-0 flex-[1_1_9rem]"
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
        </Group>
        <Group align="center" wrap="wrap" gap="xs">
          <Button
            size="xs"
            loading={saveDefaultsStatus.isLoading}
            disabled={!canEdit || !dirty || !defaultConfig || !defaultFrame}
            onClick={() => void handleSave()}
          >
            Save project default
          </Button>
          <Text c="dimmed" size="xs" className="self-center">
            Saved separately from view edits.
          </Text>
        </Group>
      </Stack>
    </section>
  );
};
