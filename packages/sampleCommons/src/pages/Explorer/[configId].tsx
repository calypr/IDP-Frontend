import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGetGeckoProjectsQuery } from '@gen3/core';
import {
  ExplorerMainContent,
  ExplorerBuilderPage,
  ExplorerPageGetServerSidePropsForConfigId as getServerSideProps,
  ExplorerPageProps,
  NavPageLayout,
  ProjectWorkspaceTabs,
  useIsEmbedded,
} from '@gen3/frontend';

const CohortBuilderPage = ({
  headerProps,
  footerProps,
  configuration,
  sharedFiltersMap,
  pageProblems,
}: ExplorerPageProps): JSX.Element => {
  const router = useRouter();
  const { data: geckoProjects = [] } = useGetGeckoProjectsQuery();
  const configId =
    typeof router.query.configId === 'string' ? router.query.configId : '';
  const isEmbedded = useIsEmbedded();
  const explorerConfig = configuration?.explorerConfig;
  const [activeExplorerTab, setActiveExplorerTab] = useState<string | null>(
    explorerConfig?.[0]?.tabTitle ?? null,
  );

  const matchingProject = geckoProjects.find((candidate) => {
    const parts = candidate.resourcePath.split('/').filter(Boolean);
    return `${parts[1]}-${parts[3]}` === configId;
  });
  const matchingProjectParts =
    matchingProject?.resourcePath.split('/').filter(Boolean) ?? [];
  const organization = matchingProjectParts[1] ?? '';
  const project = matchingProjectParts[3] ?? '';
  const showTabsInToolbar = Boolean(organization && project && !isEmbedded);

  useEffect(() => {
    setActiveExplorerTab(explorerConfig?.[0]?.tabTitle ?? null);
  }, [configId, explorerConfig]);

  const explorerContent = configuration ? (
    <ExplorerMainContent
      activeTab={showTabsInToolbar ? activeExplorerTab : undefined}
      configuration={configuration}
      hideTabList={showTabsInToolbar}
      onTabChange={showTabsInToolbar ? setActiveExplorerTab : undefined}
      sharedFiltersMap={sharedFiltersMap}
      pageProblems={pageProblems}
    />
  ) : organization && project ? (
    <ExplorerBuilderPage organization={organization} project={project} />
  ) : (
    <main className="mx-auto max-w-screen-2xl p-6">
      <p role="status">Loading project Explorer tools…</p>
    </main>
  );

  if (isEmbedded) {
    return explorerContent;
  }

  return (
    <NavPageLayout
      headerProps={headerProps}
      footerProps={footerProps}
      headerMetadata={{
        title: 'Gen3 Cohort Builder Page',
        content: 'Cohort Builder',
        key: 'gen3-cohort-builder-page',
      }}
      pageProblems={configuration ? pageProblems : []}
    >
      <ProjectWorkspaceTabs
        activeTab="explorer"
        hasExplorerConfig={Boolean(organization && project)}
        organization={organization}
        project={project}
        toolbarContent={
          showTabsInToolbar ? (
            <div
              aria-label="Explorer views"
              className="flex shrink-0 self-stretch gap-5 border-l border-slate-200 pl-5"
              role="tablist"
            >
              {explorerConfig?.map((panel) => {
                const isActive = activeExplorerTab === panel.tabTitle;
                return (
                  <button
                    aria-selected={isActive}
                    className={`rounded-none border-0 border-b-2 bg-transparent px-0 pb-3 pt-3 text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-[#2f5aac] text-[#2f5aac]'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                    key={panel.tabTitle}
                    onClick={() => setActiveExplorerTab(panel.tabTitle)}
                    role="tab"
                    type="button"
                  >
                    {panel.tabTitle}
                  </button>
                );
              })}
              <Link
                aria-selected={!configuration}
                className={`rounded-none border-0 border-b-2 bg-transparent px-0 pb-3 pt-3 text-sm font-semibold transition-colors ${
                  configuration
                    ? 'border-transparent text-slate-500 hover:text-slate-800'
                    : 'border-[#2f5aac] text-[#2f5aac]'
                }`}
                href={`/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/explorers/builder`}
                role="tab"
              >
                Builder
              </Link>
            </div>
          ) : null
        }
      >
        {explorerContent}
      </ProjectWorkspaceTabs>
    </NavPageLayout>
  );
};

export default CohortBuilderPage;

export { getServerSideProps };
