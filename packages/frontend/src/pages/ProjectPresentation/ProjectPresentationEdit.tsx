import React from 'react';
import {
  useGetAuthzMappingsQuery,
  useGetGeckoGitOrganizationsStatusQuery,
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectsQuery,
  useGetGeckoGitProjectPresentationConfigQuery,
  useUpdateGeckoGitProjectPresentationConfigMutation,
} from '@gen3/core';
import { Alert, Center, Loader } from '@mantine/core';
import { useRouter } from 'next/router';
import { NavPageLayout } from '../../features/Navigation';
import { ProtectedContent } from '../../components/Protected';
import type { NavPageLayoutProps } from '../../features/Navigation';
import {
  hasOrganizationMembership,
  hasProjectMembershipOrAccess,
} from '../../features/projectPresentation/access';
import { buildProjectPresentationDraft } from '../../features/projectPresentation/draft';
import { ProjectPresentationEditor } from '../../features/projectPresentation/ProjectPresentationEditor';
import { ProjectPresentationDraft } from '../../features/projectPresentation/types';
import { useSession } from '../../lib/session/session';

export const ProjectPresentationEditPage = ({
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

  const { data: authzMapping = {}, isLoading: isAuthzLoading } =
    useGetAuthzMappingsQuery(undefined, { skip: !isAuthenticated });
  const { data: gitOrganizationsStatus, isLoading: isGitStatusLoading } =
    useGetGeckoGitOrganizationsStatusQuery(undefined, {
      skip: !isAuthenticated,
    });
  const { data: geckoProjects = [], isLoading: isProjectsLoading } =
    useGetGeckoProjectsQuery();
  const { data: geckoProjectSummary = [], isLoading: isSummaryLoading } =
    useGetGeckoProjectSummaryQuery();
  const gitOrganizationStatus = gitOrganizationsStatus?.organizations.find(
    (entry) => entry.organization === organization,
  );
  const gitProjectStatus = gitOrganizationStatus?.projects.find(
    (entry) => entry.project === project,
  );
  const canEditPresentation =
    isAdmin ||
    gitProjectStatus?.can_manage_settings === true ||
    hasOrganizationMembership(authzMapping, organization) ||
    hasProjectMembershipOrAccess(authzMapping, organization, project);
  const unauthorized = sessionReady && isAuthenticated && !canEditPresentation;
  const { data: presentationConfig, isLoading: isPresentationLoading } =
    useGetGeckoGitProjectPresentationConfigQuery(
      { organization, project },
      {
        skip: !organization || !project || !canEditPresentation,
      },
    );
  const [updatePresentationConfig, { isLoading: isSaving }] =
    useUpdateGeckoGitProjectPresentationConfigMutation();

  const presentationHTML = presentationConfig?.presentationConfig ?? '';

  const projectRecord = geckoProjects.find((candidate) => {
    const parts = candidate.resourcePath.split('/').filter(Boolean);
    return parts[1] === organization && parts[3] === project;
  });
  const projectSummary = geckoProjectSummary.find(
    (candidate) =>
      candidate.organization === organization && candidate.project === project,
  );

  const [draft, setDraft] = React.useState<ProjectPresentationDraft | null>(null);
  const [hasUserEdited, setHasUserEdited] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!organization || !project) {
      return;
    }
    if (hasUserEdited) {
      return;
    }
    setDraft(
      buildProjectPresentationDraft({
        organization,
        project,
        projectConfig: projectRecord?.configData,
        projectRecord,
        projectSummary,
        bodyHTML: presentationHTML,
      }),
    );
  }, [
    hasUserEdited,
    organization,
    project,
    projectRecord,
    projectSummary,
    presentationHTML,
  ]);

  const handleSave = React.useCallback(async () => {
    if (!organization || !project || !draft) {
      return;
    }

    setSaveError(null);

    try {
      const response = await updatePresentationConfig({
        organization,
        project,
        presentationConfig: draft.bodyHTML,
      }).unwrap();

      setDraft((current) =>
        current
          ? {
              ...current,
              bodyHTML: response.presentationConfig,
            }
          : current,
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save presentation.',
      );
    }
  }, [draft, organization, project, updatePresentationConfig]);

  return (
    <ProtectedContent>
      <NavPageLayout
        {...{ headerProps, footerProps, pageProblems }}
        headerMetadata={{
          title: 'Project Page Editor',
          content: 'Project page editor',
          key: 'project-page-editor',
        }}
      >
        {!sessionReady || (isAuthenticated && (isAuthzLoading || isGitStatusLoading)) ? (
          <Center className="min-h-[55vh]">
            <Loader />
          </Center>
        ) : unauthorized ? (
          <div className="space-y-4 px-6 py-8 lg:px-8">
            <Alert color="yellow" variant="light">
              You must be a member of this organization or project, or have
              write access to this project, to edit its presentation page.
            </Alert>
          </div>
        ) : isProjectsLoading || isSummaryLoading || isPresentationLoading || !draft ? (
          <Center className="min-h-[55vh]">
            <Loader />
          </Center>
        ) : (
          <div className="space-y-4 px-6 py-8 lg:px-8">
            {saveError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            ) : null}
            <ProjectPresentationEditor
              draft={draft}
              isSaving={isSaving}
              onChange={(nextDraft) => {
                setHasUserEdited(true);
                setDraft(nextDraft);
              }}
              onSave={handleSave}
              presentationHref={`/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/presentation`}
            />
          </div>
        )}
      </NavPageLayout>
    </ProtectedContent>
  );
};
