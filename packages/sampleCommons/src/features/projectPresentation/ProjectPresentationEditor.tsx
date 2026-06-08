import React from 'react';
import {
  ActionIcon,
  Alert,
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
import { IconInfoCircle, IconPlus, IconTrash } from '@tabler/icons-react';
import type { ProjectPresentationDraft } from './types';
import { ProjectPresentationView } from './ProjectPresentationView';
import { updateVisualizationAtIndex } from './draft';

const MAX_HIGHLIGHTS = 6;
const MAX_VISUALIZATIONS = 3;

const createEmptyHighlight = (): string => '';

const createEmptyVisualization = (index: number) => ({
  id: `custom-visualization-${index + 1}`,
  title: '',
  caption: '',
  imageURL: '',
  linkURL: '',
  note: '',
  dataSource: 'manual-placeholder',
  queryRef: '',
  widgetType: 'placeholder',
});

export const ProjectPresentationEditor = ({
  draft,
  onChange,
  presentationHref,
}: {
  draft: ProjectPresentationDraft;
  onChange: (nextDraft: ProjectPresentationDraft) => void;
  presentationHref: string;
}) => {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
      <div className="space-y-6">
        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <div>
              <Title order={2}>Presentation Editor</Title>
              <Text c="dimmed" mt={4} size="sm">
                This first version is frontend-only. Changes update the preview below but are not persisted yet.
              </Text>
            </div>

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
              minRows={3}
              value={draft.hero.summary}
              onChange={(event) =>
                onChange({
                  ...draft,
                  hero: { ...draft.hero, summary: event.currentTarget.value },
                })
              }
            />
            <Textarea
              autosize
              label="Overview body"
              minRows={6}
              description="Use blank lines between paragraphs."
              value={draft.overview}
              onChange={(event) =>
                onChange({
                  ...draft,
                  overview: event.currentTarget.value,
                })
              }
            />
          </Stack>
        </Card>

        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Title order={3}>Highlights</Title>
                <Text c="dimmed" size="sm">
                  Add a few short points that explain why the project matters.
                </Text>
              </div>
              <Button
                disabled={draft.highlights.length >= MAX_HIGHLIGHTS}
                leftSection={<IconPlus size={16} />}
                size="xs"
                variant="light"
                onClick={() =>
                  onChange({
                    ...draft,
                    highlights: [...draft.highlights, createEmptyHighlight()],
                  })
                }
              >
                Add highlight
              </Button>
            </Group>

            {draft.highlights.map((highlight, index) => (
              <Group align="flex-start" key={`highlight-${index}`} wrap="nowrap">
                <TextInput
                  className="flex-1"
                  label={`Highlight ${index + 1}`}
                  value={highlight}
                  onChange={(event) => {
                    const nextHighlights = draft.highlights.map(
                      (currentHighlight, currentIndex) =>
                        currentIndex === index
                          ? event.currentTarget.value
                          : currentHighlight,
                    );
                    onChange({ ...draft, highlights: nextHighlights });
                  }}
                />
                <ActionIcon
                  aria-label={`Remove highlight ${index + 1}`}
                  color="red"
                  mt={30}
                  variant="light"
                  onClick={() =>
                    onChange({
                      ...draft,
                      highlights: draft.highlights.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    })
                  }
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
          </Stack>
        </Card>

        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Title order={3}>Visualization Placeholders</Title>
                <Text c="dimmed" size="sm">
                  These slots are for narrative placeholders now and future query-backed widgets later.
                </Text>
              </div>
              <Button
                disabled={draft.visualizations.length >= MAX_VISUALIZATIONS}
                leftSection={<IconPlus size={16} />}
                size="xs"
                variant="light"
                onClick={() =>
                  onChange({
                    ...draft,
                    visualizations: [
                      ...draft.visualizations,
                      createEmptyVisualization(draft.visualizations.length),
                    ],
                  })
                }
              >
                Add visualization
              </Button>
            </Group>

            <Alert color="blue" icon={<IconInfoCircle size={16} />} radius="lg">
              Query references, widget types, and live data wiring are intentionally reserved for a later pass. Use title, caption, image, link, and notes for now.
            </Alert>

            {draft.visualizations.map((visualization, index) => (
              <Card key={visualization.id} padding="lg" radius="lg" withBorder>
                <Stack gap="sm">
                  <Group justify="space-between">
                    <Title order={4}>Visualization {index + 1}</Title>
                    <ActionIcon
                      aria-label={`Remove visualization ${index + 1}`}
                      color="red"
                      variant="light"
                      onClick={() =>
                        onChange({
                          ...draft,
                          visualizations: draft.visualizations.filter(
                            (_, currentIndex) => currentIndex !== index,
                          ),
                        })
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                  <TextInput
                    label="Title"
                    value={visualization.title}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visualizations: updateVisualizationAtIndex(
                          draft.visualizations,
                          index,
                          {
                            ...visualization,
                            title: event.currentTarget.value,
                          },
                        ),
                      })
                    }
                  />
                  <Textarea
                    autosize
                    label="Caption"
                    minRows={2}
                    value={visualization.caption}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visualizations: updateVisualizationAtIndex(
                          draft.visualizations,
                          index,
                          {
                            ...visualization,
                            caption: event.currentTarget.value,
                          },
                        ),
                      })
                    }
                  />
                  <TextInput
                    label="Image URL"
                    placeholder="https://..."
                    value={visualization.imageURL}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visualizations: updateVisualizationAtIndex(
                          draft.visualizations,
                          index,
                          {
                            ...visualization,
                            imageURL: event.currentTarget.value,
                          },
                        ),
                      })
                    }
                  />
                  <TextInput
                    label="Supporting link"
                    placeholder="https://..."
                    value={visualization.linkURL}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visualizations: updateVisualizationAtIndex(
                          draft.visualizations,
                          index,
                          {
                            ...visualization,
                            linkURL: event.currentTarget.value,
                          },
                        ),
                      })
                    }
                  />
                  <Textarea
                    autosize
                    label="Manual note"
                    minRows={2}
                    value={visualization.note}
                    onChange={(event) =>
                      onChange({
                        ...draft,
                        visualizations: updateVisualizationAtIndex(
                          draft.visualizations,
                          index,
                          {
                            ...visualization,
                            note: event.currentTarget.value,
                          },
                        ),
                      })
                    }
                  />
                </Stack>
              </Card>
            ))}
          </Stack>
        </Card>

        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <Title order={3}>Call To Action</Title>
            <TextInput
              label="CTA title"
              value={draft.cta.title}
              onChange={(event) =>
                onChange({
                  ...draft,
                  cta: { ...draft.cta, title: event.currentTarget.value },
                })
              }
            />
            <Textarea
              autosize
              label="CTA body"
              minRows={3}
              value={draft.cta.body}
              onChange={(event) =>
                onChange({
                  ...draft,
                  cta: { ...draft.cta, body: event.currentTarget.value },
                })
              }
            />
            <Group grow align="flex-start">
              <TextInput
                label="Button label"
                value={draft.cta.buttonLabel}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    cta: { ...draft.cta, buttonLabel: event.currentTarget.value },
                  })
                }
              />
              <TextInput
                label="Button URL"
                value={draft.cta.buttonURL}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    cta: { ...draft.cta, buttonURL: event.currentTarget.value },
                  })
                }
              />
            </Group>
            <TextInput
              label="Contact email"
              value={draft.cta.contactEmail}
              onChange={(event) =>
                onChange({
                  ...draft,
                  cta: { ...draft.cta, contactEmail: event.currentTarget.value },
                })
              }
            />
            <Anchor href={presentationHref}>Open route-backed presentation page</Anchor>
          </Stack>
        </Card>
      </div>

      <div className="space-y-4">
        <div>
          <Title order={2}>Preview</Title>
          <Text c="dimmed" mt={4} size="sm">
            The preview updates immediately and represents the shared presentation model for this first frontend-only version.
          </Text>
        </div>
        <ProjectPresentationView draft={draft} showFutureWidgetNote />
      </div>
    </div>
  );
};
