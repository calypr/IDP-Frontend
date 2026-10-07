import React from 'react';
import {
  useGetAuthzMappingsQuery,
  useGetConfigListQuery,
  useGetConfigContentQuery,
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectsQuery,
  useGetGeckoGitProjectPresentationConfigQuery,
} from '@gen3/core';
import { useRouter } from 'next/router';
import { NavPageLayout } from '../../features/Navigation';
import { ProjectWorkspaceTabs } from '../../features/Navigation';
import { useInitialPageReady } from '../../components/Protected/InitialPageReady';
import { useIsEmbedded } from '../../utils';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import {
  hasOrganizationMembership,
  hasProjectMembershipOrAccess,
} from '../../features/projectPresentation/access';
import { buildProjectPresentationDraft } from '../../features/projectPresentation/draft';
import { ProjectPresentationView } from '../../features/projectPresentation/ProjectPresentationView';
import { useSession } from '../../lib/session/session';

export const ProjectPresentationPage = ({
  headerProps,
  footerProps,
}: Awaited<ReturnType<typeof getNavPageLayoutPropsFromConfig>>) => {
  const router = useRouter();
  const session = useSession(false);
  const sessionReady = !session.pending;
  const isAuthenticated = session.status === 'issued';
  const isAdmin = session.user?.is_admin === true;
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const isEmbedded = useIsEmbedded();
  const explorerConfigId =
    organization && project ? `${organization}-${project}` : '';
  const { data: authzMapping = {}, isLoading: isAuthzLoading } =
    useGetAuthzMappingsQuery(undefined, { skip: !isAuthenticated });
  const canLikelyReadProjectScopedData =
    isAdmin ||
    hasOrganizationMembership(authzMapping, organization) ||
    hasProjectMembershipOrAccess(authzMapping, organization, project);
  const { data: explorerConfigs } = useGetConfigListQuery(undefined, {
    skip:
      !explorerConfigId ||
      !sessionReady ||
      !isAuthenticated ||
      isAuthzLoading ||
      !canLikelyReadProjectScopedData,
  });
  const explorerConfigAvailable =
    Array.isArray(explorerConfigs?.data) &&
    explorerConfigs.data.includes(explorerConfigId);

  const { data: geckoProjects = [], isLoading: isProjectsLoading } =
    useGetGeckoProjectsQuery();
  const { data: explorerConfigResponse } = useGetConfigContentQuery(
    explorerConfigId,
    {
      skip:
        !explorerConfigId ||
        !explorerConfigAvailable ||
        !sessionReady ||
        !isAuthenticated ||
        isAuthzLoading ||
        !canLikelyReadProjectScopedData,
    },
  );
  const { data: geckoProjectSummary = [], isLoading: isSummaryLoading } =
    useGetGeckoProjectSummaryQuery();
  const { data: presentationConfig, isLoading: isPresentationLoading } =
    useGetGeckoGitProjectPresentationConfigQuery(
      { organization, project },
      {
        skip:
          !organization ||
          !project ||
          !sessionReady ||
          !isAuthenticated ||
          isAuthzLoading ||
          !canLikelyReadProjectScopedData,
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

  const isPageLoading =
    !sessionReady ||
    (isAuthenticated && isAuthzLoading) ||
    isProjectsLoading ||
    isSummaryLoading ||
    isPresentationLoading;
  useInitialPageReady(!isPageLoading);

  const presentationContent = isPageLoading ? null : (
    <div className="px-6 py-8 lg:px-8">
      <ProjectPresentationView draft={draft} />
    </div>
  );

  if (isEmbedded) {
    return presentationContent;
  }

  return (
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
        hasExplorerConfig={
          explorerConfigAvailable && Boolean(explorerConfigResponse?.data)
        }
        organization={organization}
        project={project}
      >
        {presentationContent}
      </ProjectWorkspaceTabs>
    </NavPageLayout>
  );
};
