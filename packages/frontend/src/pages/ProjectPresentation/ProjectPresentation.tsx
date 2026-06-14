import React from 'react';
import {
  useGetConfigContentQuery,
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectsQuery,
  useGetGeckoGitProjectPresentationConfigQuery,
} from '@gen3/core';
import { Center, Loader } from '@mantine/core';
import { useRouter } from 'next/router';
import { NavPageLayout } from '../../features/Navigation';
import { ProjectWorkspaceTabs } from '../../features/Navigation';
import { ProtectedContent } from '../../components/Protected';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import { buildProjectPresentationDraft } from '../../features/projectPresentation/draft';
import { ProjectPresentationView } from '../../features/projectPresentation/ProjectPresentationView';

export const ProjectPresentationPage = ({
  headerProps,
  footerProps,
}: Awaited<ReturnType<typeof getNavPageLayoutPropsFromConfig>>) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const isEmbedded =
    router.query.embed === '1' || router.query.embed === 'true';
  const explorerConfigId =
    organization && project ? `${organization}-${project}` : '';

  const { data: geckoProjects = [], isLoading: isProjectsLoading } =
    useGetGeckoProjectsQuery();
  const { data: explorerConfigResponse } = useGetConfigContentQuery(
    explorerConfigId,
    {
      skip: !explorerConfigId,
    },
  );
  const { data: geckoProjectSummary = [], isLoading: isSummaryLoading } =
    useGetGeckoProjectSummaryQuery();
  const { data: presentationConfig, isLoading: isPresentationLoading } =
    useGetGeckoGitProjectPresentationConfigQuery(
      { organization, project },
      {
        skip: !organization || !project,
      },
    );

  const presentationHTML = presentationConfig?.presentationConfig ?? '';

  const projectRecord = geckoProjects.find((candidate) => {
    const parts = candidate.resourcePath.split('/').filter(Boolean);
    return parts[1] === organization && parts[3] === project;
  });
  const projectSummary = geckoProjectSummary.find(
    (candidate) =>
      candidate.organization === organization && candidate.project === project,
  );
  const draft = buildProjectPresentationDraft({
    organization,
    project,
    projectConfig: projectRecord?.configData,
    projectRecord,
    projectSummary,
    bodyHTML: presentationHTML,
  });

  const presentationContent =
    isProjectsLoading || isSummaryLoading || isPresentationLoading ? (
      <Center className="min-h-[55vh]">
        <Loader />
      </Center>
    ) : (
      <div className="px-6 py-8 lg:px-8">
        <ProjectPresentationView draft={draft} />
      </div>
    );

  if (isEmbedded) {
    return <ProtectedContent>{presentationContent}</ProtectedContent>;
  }

  return (
    <ProtectedContent>
      <NavPageLayout
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'Project Presentation',
          content: 'Project presentation page',
          key: 'project-presentation',
        }}
      >
        <ProjectWorkspaceTabs
          activeTab="presentation"
          hasExplorerConfig={Boolean(explorerConfigResponse?.data)}
          organization={organization}
          project={project}
        >
          {presentationContent}
        </ProjectWorkspaceTabs>
      </NavPageLayout>
    </ProtectedContent>
  );
};
