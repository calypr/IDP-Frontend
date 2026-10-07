import React from 'react';
import {
  useGetAuthzMappingsQuery,
  useGetExplorerStateV1Query,
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectsQuery,
  useGetGeckoGitProjectPresentationConfigQuery,
} from '@gen3/core';
import { useRouter } from 'next/router';
import { NavPageLayout } from '../../features/Navigation';
import { ProjectWorkspaceTabs } from '../../features/Navigation';
import { useInitialPageReady } from '../../components/Protected/InitialPageReady';
import { ProtectedContent } from '../../components/Protected';
import { useIsEmbedded } from '../../utils';
import type { NavPageLayoutProps } from '../../features/Navigation';
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
  pageProblems,
}: NavPageLayoutProps) => {
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
  const { data: authzMapping = {}, isLoading: isAuthzLoading } =
    useGetAuthzMappingsQuery(undefined, { skip: !isAuthenticated });
  const canLikelyReadProjectScopedData =
    isAdmin ||
    hasOrganizationMembership(authzMapping, organization) ||
    hasProjectMembershipOrAccess(authzMapping, organization, project);
  const { data: geckoProjects = [], isLoading: isProjectsLoading } =
    useGetGeckoProjectsQuery();
  const { data: explorer } = useGetExplorerStateV1Query(
    { project: `${organization}/${project}`, explorerId: 'default' },
    {
      skip:
        !organization || !project ||
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
    <ProtectedContent>
      <NavPageLayout
        {...{ headerProps, footerProps, pageProblems }}
        headerMetadata={{
          title: 'Project Presentation',
          content: 'Project presentation page',
          key: 'project-presentation',
        }}
      >
        <ProjectWorkspaceTabs
          activeTab="presentation"
          hasExplorerConfig={Boolean(explorer)}
          organization={organization}
          project={project}
        >
          {presentationContent}
        </ProjectWorkspaceTabs>
      </NavPageLayout>
    </ProtectedContent>
  );
};
