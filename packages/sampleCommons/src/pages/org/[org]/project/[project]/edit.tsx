import React from 'react';
import {
  getNavPageLayoutPropsFromConfig,
  NavPageLayout,
  ProtectedContent,
} from '@gen3/frontend';
import {
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectsQuery,
} from '@gen3/core';
import { Center, Loader } from '@mantine/core';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import {
  buildProjectPresentationDraft,
  fetchProjectPresentationConfig,
  projectPresentationConfigPath,
  saveProjectPresentationConfig,
  ProjectPresentationDraft,
  ProjectPresentationEditor,
} from '../../../../../features/projectPresentation';

const ProjectEditPage = ({
  headerProps,
  footerProps,
}: Awaited<ReturnType<typeof getNavPageLayoutPropsFromConfig>>) => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const presentationConfigPath =
    organization && project
      ? projectPresentationConfigPath(organization, project)
      : null;
  const { data: geckoProjects = [], isLoading: isProjectsLoading } =
    useGetGeckoProjectsQuery();
  const { data: geckoProjectSummary = [], isLoading: isSummaryLoading } =
    useGetGeckoProjectSummaryQuery();
  const { data: presentationHTML = '' } = useSWR(
    presentationConfigPath,
    fetchProjectPresentationConfig,
  );
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
  const [isSaving, setIsSaving] = React.useState(false);
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
    if (!presentationConfigPath || !draft) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const savedHTML = await saveProjectPresentationConfig(
        presentationConfigPath,
        draft.bodyHTML,
      );
      setDraft((current) =>
        current
          ? {
              ...current,
              bodyHTML: savedHTML,
            }
          : current,
      );
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : 'Failed to save presentation.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [draft, presentationConfigPath]);

  return (
    <ProtectedContent>
      <NavPageLayout
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'Project Page Editor',
          content: 'Project page editor',
          key: 'project-page-editor',
        }}
      >
        {isProjectsLoading || isSummaryLoading || !draft ? (
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

export const getServerSideProps: GetServerSideProps = async () => ({
  props: await getNavPageLayoutPropsFromConfig(),
});

export default ProjectEditPage;
