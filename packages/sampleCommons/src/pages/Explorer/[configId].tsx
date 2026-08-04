import React, { useState, useEffect } from 'react';
import {
  NavPageLayout,
  ProjectWorkspaceTabs,
  useIsEmbedded,
} from '@gen3/frontend';
import { useGetGeckoProjectsQuery } from '@gen3/core';
import {
  ProtectedContent,
  ExplorerMainContent,
  ExplorerPageProps,
  ExplorerPageGetServerSidePropsForConfigId as getServerSideProps,
} from '@gen3/frontend';
import { useRouter } from 'next/router';

const CohortBuilderPage = ({
  headerProps,
  footerProps,
  explorerConfig,
  tabsLayout,
  sharedFiltersMap,
  errorStatus,
  fileActions,
}: ExplorerPageProps): JSX.Element => {
  const router = useRouter();
  const { data: geckoProjects = [] } = useGetGeckoProjectsQuery();
  const configId =
    typeof router.query.configId === 'string' ? router.query.configId : '';
  const isEmbedded = useIsEmbedded();
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

  const explorerContent = (
    <ProtectedContent errorStatus={errorStatus}>
      <ExplorerMainContent
        activeTab={showTabsInToolbar ? activeExplorerTab : undefined}
        tabsLayout={tabsLayout}
        explorerConfig={explorerConfig}
        hideTabList={showTabsInToolbar}
        onTabChange={
          showTabsInToolbar ? setActiveExplorerTab : undefined
        }
        sharedFiltersMap={sharedFiltersMap}
        fileActions={fileActions}
      />
    </ProtectedContent>
  );

  if (isEmbedded) {
    return explorerContent;
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Gen3 Cohort Builder Page',
        content: 'Cohort Builder',
        key: 'gen3-cohort-builder-page',
      }}
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
