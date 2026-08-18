import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useGetGeckoProjectsQuery } from '@gen3/core';
import {
  ExplorerMainContent,
  ExplorerPageGetServerSideProps as getServerSideProps,
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
  const problems = pageProblems ?? [];
  const configId =
    typeof router.query.configId === 'string' ? router.query.configId : '';
  const explorerId =
    typeof router.query.explorerId === 'string'
      ? router.query.explorerId
      : undefined;
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
  const explorerHref = `/Explorer/${encodeURIComponent(configId)}${explorerId ? `?explorerId=${encodeURIComponent(explorerId)}` : ''}`;
  const builderHref = `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/explorers/builder${explorerId ? `?explorerId=${encodeURIComponent(explorerId)}` : ''}`;
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
  ) : (
    <main className="mx-auto max-w-screen-2xl p-6">
      <p role="alert">
        The published Explorer configuration could not be loaded. Open the
        Builder to inspect or revise the draft.
      </p>
      {problems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
          {problems.map((problem, index) => (
            <li key={`${problem.code ?? 'problem'}-${index}`}>
              {problem.message}
            </li>
          ))}
        </ul>
      )}
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
      pageProblems={problems}
    >
      <ProjectWorkspaceTabs
        activeTab="explorer"
        hasExplorerConfig={Boolean(organization && project)}
        organization={organization}
        project={project}
        explorerHref={explorerHref}
        toolbarContent={
          showTabsInToolbar ? (
            <div className="flex min-w-0 flex-1 items-center justify-between border-l border-slate-200 pl-5">
              <div
                aria-label="Explorer views"
                className="flex min-w-0 shrink gap-5 overflow-x-auto"
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
              </div>
              <div
                aria-label="Explorer workspace"
                className="ml-auto flex shrink-0 self-stretch gap-5 border-l border-slate-200 pl-5"
                role="tablist"
              >
                <span
                  aria-selected="true"
                  className="rounded-none border-0 border-b-2 border-[#2f5aac] bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-[#2f5aac]"
                  role="tab"
                >
                  View
                </span>
                <Link
                  className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                  href={builderHref}
                  role="tab"
                >
                  Builder
                </Link>
              </div>
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
