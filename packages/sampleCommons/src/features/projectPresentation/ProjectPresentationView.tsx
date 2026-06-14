import React from 'react';
import { Badge, Group, Text, ThemeIcon, Title } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { DEFAULT_PROJECT_PRESENTATION_HTML } from './defaults';
import type { ProjectPresentationDraft } from './types';

export const ProjectPresentationView = ({
  draft,
}: {
  draft: ProjectPresentationDraft;
}) => {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const [iframeHeight, setIframeHeight] = React.useState(0);
  const bodyHTML =
    draft.bodyHTML.trim().length > 0
      ? draft.bodyHTML
      : DEFAULT_PROJECT_PRESENTATION_HTML;
  const iframeSrcDoc = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html,
      body {
        margin: 0;
        padding: 0;
        background: transparent;
      }
      body {
        overflow: auto;
      }
    </style>
  </head>
  <body>${bodyHTML}</body>
</html>
`;

  const measureIframe = React.useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) {
      return;
    }

    const bodyHeight = doc.body?.scrollHeight ?? 0;
    const documentHeight = doc.documentElement?.scrollHeight ?? 0;
    const nextHeight = Math.ceil(Math.max(bodyHeight, documentHeight));

    setIframeHeight((currentHeight) =>
      currentHeight !== nextHeight ? nextHeight : currentHeight,
    );
  }, []);

  const attachIframeMeasurement = React.useCallback(() => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    if (!doc) {
      return;
    }

    doc.defaultView?.removeEventListener('resize', measureIframe);
    resizeObserverRef.current?.disconnect();
    measureIframe();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(measureIframe);
      if (doc.body) {
        observer.observe(doc.body);
      }
      if (doc.documentElement) {
        observer.observe(doc.documentElement);
      }
      resizeObserverRef.current = observer;
    }

    doc.defaultView?.addEventListener('resize', measureIframe);
    void doc.fonts?.ready.then(measureIframe);
  }, [measureIframe]);

  React.useEffect(
    () => () => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      doc?.defaultView?.removeEventListener('resize', measureIframe);
      resizeObserverRef.current?.disconnect();
    },
    [measureIframe],
  );

  return (
    <div>
      <section className="shrink-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950 text-white shadow-[0_24px_70px_-36px_rgba(15,23,42,0.85)]">
        <div className="grid gap-8 px-8 py-10 lg:grid-cols-[minmax(0,1.5fr)_16rem] lg:px-10">
          <div className="space-y-6">
            <Group gap="sm">
              <Badge color="cyan" radius="sm" variant="light">
                Home
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
            <Badge color="gray" radius="sm" variant="white">
              {draft.hero.project}
            </Badge>
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
                    Add a thumbnail later if this page needs a stronger visual anchor.
                  </Text>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-8 overflow-hidden">
        <iframe
          className="project-presentation-frame block w-full border-0 bg-transparent"
          onLoad={attachIframeMeasurement}
          ref={iframeRef}
          scrolling="no"
          sandbox="allow-same-origin allow-forms allow-popups"
          srcDoc={iframeSrcDoc}
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            height: `${iframeHeight}px`,
          }}
          title="Project presentation"
        />
      </div>
    </div>
  );
};
