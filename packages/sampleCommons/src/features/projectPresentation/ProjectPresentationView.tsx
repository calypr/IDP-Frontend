import React from 'react';
import {
  Anchor,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconChartBar,
  IconChevronRight,
  IconMail,
  IconSparkles,
} from '@tabler/icons-react';
import type { ProjectPresentationDraft } from './types';

const paragraphize = (value: string): Array<string> =>
  value
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

export const ProjectPresentationView = ({
  draft,
  showFutureWidgetNote = false,
}: {
  draft: ProjectPresentationDraft;
  showFutureWidgetNote?: boolean;
}) => {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.85)]">
        <div className="grid gap-8 px-8 py-10 lg:grid-cols-[minmax(0,1.5fr)_16rem] lg:px-10">
          <div className="space-y-6">
            <Group gap="sm">
              <Badge color="cyan" radius="sm" variant="light">
                Project Presentation
              </Badge>
              <Badge color="gray" radius="sm" variant="outline">
                {draft.hero.organization}
              </Badge>
            </Group>
            <div className="space-y-3">
              <Title c="white" order={1}>
                {draft.hero.title}
              </Title>
              <Text className="max-w-3xl text-base text-slate-200 sm:text-lg">
                {draft.hero.summary}
              </Text>
            </div>
            <Group gap="xs">
              <Badge color="gray" radius="sm" variant="white">
                {draft.hero.project}
              </Badge>
              {draft.cta.contactEmail ? (
                <Badge color="cyan" radius="sm" variant="white">
                  {draft.cta.contactEmail}
                </Badge>
              ) : null}
            </Group>
          </div>
          <div className="flex items-center justify-center">
            {draft.hero.thumbnailURL ? (
              <img
                alt={`${draft.hero.title} thumbnail`}
                className="max-h-56 w-full rounded-3xl border border-white/10 bg-white/5 object-cover p-2"
                src={draft.hero.thumbnailURL}
              />
            ) : (
              <div className="flex h-full min-h-48 w-full items-center justify-center rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-8 text-center">
                <div className="space-y-3">
                  <ThemeIcon color="cyan" radius="xl" size="xl" variant="light">
                    <IconSparkles size={20} />
                  </ThemeIcon>
                  <Text className="text-sm text-slate-200">
                    Add a thumbnail later to give this project page a stronger visual identity.
                  </Text>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_22rem]">
        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <Title order={2}>Project Overview</Title>
            {paragraphize(draft.overview).map((paragraph) => (
              <Text className="leading-7 text-slate-700" key={paragraph}>
                {paragraph}
              </Text>
            ))}
          </Stack>
        </Card>

        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <Title order={3}>Highlights</Title>
            <div className="space-y-3">
              {draft.highlights.map((highlight, index) => (
                <div className="flex items-start gap-3" key={`${highlight}-${index}`}>
                  <ThemeIcon color="cyan" radius="xl" size="sm" variant="light">
                    <IconChevronRight size={12} />
                  </ThemeIcon>
                  <Text className="text-sm leading-6 text-slate-700">
                    {highlight}
                  </Text>
                </div>
              ))}
            </div>
          </Stack>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Title order={2}>Visualizations and Data Storytelling</Title>
            <Text c="dimmed" mt={4}>
              These slots are intentionally basic right now and will later attach to query-backed widgets.
            </Text>
          </div>
          {showFutureWidgetNote ? (
            <Badge color="orange" radius="sm" variant="light">
              Future query-backed widgets
            </Badge>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          {draft.visualizations.map((visualization) => (
            <Card key={visualization.id} padding="lg" radius="xl" withBorder>
              <Stack gap="md">
                <Group justify="space-between">
                  <Group gap="xs">
                    <ThemeIcon color="indigo" radius="xl" variant="light">
                      <IconChartBar size={18} />
                    </ThemeIcon>
                    <Title order={4}>{visualization.title}</Title>
                  </Group>
                  <Badge radius="sm" variant="outline">
                    Placeholder
                  </Badge>
                </Group>

                {visualization.imageURL ? (
                  <img
                    alt={`${visualization.title} placeholder`}
                    className="h-44 w-full rounded-2xl border border-slate-200 object-cover"
                    src={visualization.imageURL}
                  />
                ) : (
                  <div className="flex h-44 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                    <Text c="dimmed" size="sm">
                      Add an image, chart export, or mockup to make this slot concrete while live widgets are still pending.
                    </Text>
                  </div>
                )}

                <Text className="leading-6 text-slate-700" size="sm">
                  {visualization.caption}
                </Text>

                {visualization.note ? (
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <Text size="sm">{visualization.note}</Text>
                  </div>
                ) : null}

                {visualization.linkURL ? (
                  <Anchor href={visualization.linkURL} rel="noopener noreferrer" target="_blank">
                    Open supporting link
                  </Anchor>
                ) : null}
              </Stack>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <Card padding="xl" radius="xl" withBorder>
          <Stack gap="md">
            <Title order={2}>{draft.cta.title}</Title>
            <Text className="max-w-3xl leading-7 text-slate-700">
              {draft.cta.body}
            </Text>
            <Divider />
            <Group gap="md">
              <Button
                component="a"
                href={draft.cta.buttonURL}
                rightSection={<IconChevronRight size={16} />}
              >
                {draft.cta.buttonLabel}
              </Button>
              {draft.cta.contactEmail ? (
                <Anchor
                  className="inline-flex items-center gap-2 text-sm"
                  href={`mailto:${draft.cta.contactEmail}`}
                >
                  <IconMail size={16} />
                  {draft.cta.contactEmail}
                </Anchor>
              ) : (
                <Text c="dimmed" size="sm">
                  Add a contact email in the editor to make access routing clear.
                </Text>
              )}
            </Group>
          </Stack>
        </Card>
      </section>
    </div>
  );
};
