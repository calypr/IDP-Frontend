import React, { useEffect, useMemo, useState } from 'react';
import { Tabs } from '@mantine/core';

type ProjectWorkspaceTabKey = 'git' | 'presentation' | 'explorer';

interface ProjectWorkspaceTabsProps {
  readonly activeTab: ProjectWorkspaceTabKey;
  readonly children: React.ReactNode;
  readonly hasExplorerConfig: boolean;
  readonly organization: string;
  readonly project: string;
  readonly gitHref?: string;
  readonly presentationHref?: string;
  readonly explorerHref?: string;
}

interface EmbeddedRoutePanelProps {
  readonly active: boolean;
  readonly src: string;
  readonly title: string;
}

const buildEmbeddedHref = (href: string) =>
  `${href}${href.includes('?') ? '&' : '?'}embed=1`;

const EmbeddedRoutePanel = ({
  active,
  src,
  title,
}: EmbeddedRoutePanelProps) => {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const resizeObserverRef = React.useRef<ResizeObserver | null>(null);
  const [iframeHeight, setIframeHeight] = useState(0);

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

  useEffect(
    () => () => {
      const iframe = iframeRef.current;
      const doc = iframe?.contentDocument;
      doc?.defaultView?.removeEventListener('resize', measureIframe);
      resizeObserverRef.current?.disconnect();
    },
    [measureIframe],
  );

  return (
    <iframe
      className={active ? 'block w-full border-0 bg-transparent' : 'hidden'}
      onLoad={attachIframeMeasurement}
      ref={iframeRef}
      scrolling="no"
      src={src}
      style={{ height: `${iframeHeight}px` }}
      title={title}
    />
  );
};

const ProjectWorkspaceTabs = ({
  activeTab,
  children,
  hasExplorerConfig,
  organization,
  project,
  gitHref,
  presentationHref,
  explorerHref,
}: ProjectWorkspaceTabsProps) => {
  const [selectedTab, setSelectedTab] = useState<ProjectWorkspaceTabKey>(activeTab);
  const [loadedTabs, setLoadedTabs] = useState<Record<ProjectWorkspaceTabKey, boolean>>({
    git: activeTab === 'git',
    presentation: activeTab === 'presentation',
    explorer: activeTab === 'explorer',
  });

  const gitBaseHref =
    gitHref ||
    `/git/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}`;
  const presentationBaseHref =
    presentationHref ||
    `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/presentation`;
  const explorerBaseHref =
    explorerHref ||
    `/Explorer/${encodeURIComponent(`${organization}-${project}`)}`;

  const visibleTabs = useMemo(
    () =>
      [
        {
          key: 'presentation' as const,
          label: 'Home',
          src: buildEmbeddedHref(presentationBaseHref),
        },
        ...(hasExplorerConfig
          ? [
              {
                key: 'explorer' as const,
                label: 'Explorer',
                src: buildEmbeddedHref(explorerBaseHref),
              },
            ]
          : []),
        {
          key: 'git' as const,
          label: 'Source',
          src: buildEmbeddedHref(gitBaseHref),
        },
      ],
    [
      explorerBaseHref,
      gitBaseHref,
      hasExplorerConfig,
      presentationBaseHref,
    ],
  );

  useEffect(() => {
    setSelectedTab(activeTab);
    setLoadedTabs((current) => ({
      ...current,
      [activeTab]: true,
    }));
  }, [activeTab]);

  if (!organization || !project) {
    return <>{children}</>;
  }

  return (
    <div>
      <div className="border-b border-slate-200 bg-white">
        <Tabs
          onChange={(value) => {
            if (
              value !== 'git' &&
              value !== 'presentation' &&
              value !== 'explorer'
            ) {
              return;
            }
            setSelectedTab(value);
            setLoadedTabs((current) => ({
              ...current,
              [value]: true,
            }));
          }}
          value={selectedTab}
        >
          <Tabs.List className="min-h-[3rem] gap-5 border-0 px-4">
            {visibleTabs.map((tab) => (
              <Tabs.Tab
                className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 data-[active=true]:border-[#2f5aac] data-[active=true]:bg-transparent data-[active=true]:text-[#2f5aac]"
                key={tab.key}
                value={tab.key}
              >
                {tab.label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      </div>

      <div>
        {visibleTabs.map((tab) => {
          const isActivePanel = selectedTab === tab.key;
          const isCurrentRoutePanel = activeTab === tab.key;

          return (
            <div
              className={
                isActivePanel
                  ? 'block'
                  : 'hidden'
              }
              key={`panel-${tab.key}`}
            >
              {isCurrentRoutePanel ? (
                children
              ) : loadedTabs[tab.key] ? (
                <EmbeddedRoutePanel
                  active={isActivePanel}
                  src={tab.src}
                  title={`${tab.label} for ${organization}/${project}`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectWorkspaceTabs;
