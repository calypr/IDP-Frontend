import React, { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core';
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
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Title order={2}>Project default</Title>
        <Text c="dimmed" size="sm">
          Defaults change only when you save them here. Opening the Viewer does
          not change project settings.
        </Text>
        {saveError ? (
          <Alert color="red" title="Default was not changed">
            {saveError}
          </Alert>
        ) : null}
        <Group align="end" wrap="wrap">
          <Select
            className="min-w-64 flex-1"
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
            className="min-w-64 flex-1"
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
            loading={saveDefaultsStatus.isLoading}
            disabled={!canEdit || !dirty || !defaultConfig || !defaultFrame}
            onClick={() => void handleSave()}
          >
            Save project default
          </Button>
        </Group>
      </Stack>
    </Card>
  );
};
