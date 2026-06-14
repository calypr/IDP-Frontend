import React from 'react';
import {
  Anchor,
  Button,
  Card,
  Group,
  Stack,
  Text,
  TextInput,
  Textarea,
  Title,
} from '@mantine/core';
import type { ProjectPresentationDraft } from './types';

export const ProjectPresentationEditor = ({
  draft,
  onChange,
  onSave,
  isSaving,
  presentationHref,
}: {
  draft: ProjectPresentationDraft;
  onChange: (nextDraft: ProjectPresentationDraft) => void;
  onSave?: () => void;
  isSaving?: boolean;
  presentationHref: string;
}) => {
  return (
    <div className="space-y-8">
      <Card padding="xl" radius="xl" withBorder>
        <Stack gap="md">
          <Group justify="space-between" align="flex-start">
            <div>
              <Title order={2}>Presentation Editor</Title>
              <Text c="dimmed" mt={4} size="sm">
                This top section controls the page header area. Changes update
                the preview below.
              </Text>
            </div>
            {onSave ? (
              <Button loading={isSaving} onClick={onSave}>
                Save changes
              </Button>
            ) : null}
          </Group>

          <TextInput
            label="Hero title"
            value={draft.hero.title}
            onChange={(event) =>
              onChange({
                ...draft,
                hero: { ...draft.hero, title: event.currentTarget.value },
              })
            }
          />
          <Textarea
            autosize
            label="Hero summary"
            minRows={4}
            value={draft.hero.summary}
            onChange={(event) =>
              onChange({
                ...draft,
                hero: { ...draft.hero, summary: event.currentTarget.value },
              })
            }
          />
          <TextInput
            label="Thumbnail URL"
            placeholder="https://..."
            value={draft.hero.thumbnailURL || ''}
            onChange={(event) =>
              onChange({
                ...draft,
                hero: {
                  ...draft.hero,
                  thumbnailURL: event.currentTarget.value,
                },
              })
            }
          />
        </Stack>
      </Card>

      <Card padding="xl" radius="xl" withBorder>
        <Stack gap="md">
          <div>
            <Title order={3}>Freeform HTML</Title>
            <Text c="dimmed" size="sm">
              Paste any HTML here to render below the top section. Leave it
              empty to use the built-in default template.
            </Text>
          </div>
          <Textarea
            autosize
            label="HTML content"
            minRows={16}
            placeholder="<section><h2>Methods</h2><p>...</p></section>"
            value={draft.bodyHTML}
            onChange={(event) =>
              onChange({
                ...draft,
                bodyHTML: event.currentTarget.value,
              })
            }
          />
        </Stack>
      </Card>

      <Card padding="xl" radius="xl" withBorder>
        <Stack gap="md">
          <div>
            <Title order={3}>Presentation page</Title>
            <Text c="dimmed" size="sm">
              Open the live presentation page in a new tab to review the current
              result.
            </Text>
          </div>
          <Anchor href={presentationHref} target="_blank">
            Open route-backed presentation page
          </Anchor>
        </Stack>
      </Card>
    </div>
  );
};
