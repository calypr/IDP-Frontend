import React from 'react';
import {
  NavPageLayout,
  ProjectWorkspaceTabs,
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
  const isEmbedded =
    router.query.embed === '1' || router.query.embed === 'true';
  const matchingProject = geckoProjects.find((candidate) => {
    const parts = candidate.resourcePath.split('/').filter(Boolean);
    return `${parts[1]}-${parts[3]}` === configId;
  });
  const matchingProjectParts =
    matchingProject?.resourcePath.split('/').filter(Boolean) ?? [];
  const organization = matchingProjectParts[1] ?? '';
  const project = matchingProjectParts[3] ?? '';
  const explorerContent = (
    <ProtectedContent errorStatus={errorStatus}>
      <ExplorerMainContent
        tabsLayout={tabsLayout}
        explorerConfig={explorerConfig}
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
      >
        {explorerContent}
      </ProjectWorkspaceTabs>
    </NavPageLayout>
  );
};

export default CohortBuilderPage;

export { getServerSideProps };
