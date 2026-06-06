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
import {
  buildProjectPresentationDraft,
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
  const { data: geckoProjects = [], isLoading: isProjectsLoading } =
    useGetGeckoProjectsQuery();
  const { data: geckoProjectSummary = [], isLoading: isSummaryLoading } =
    useGetGeckoProjectSummaryQuery();
  const projectRecord = geckoProjects.find((candidate) => {
    const parts = candidate.resourcePath.split('/').filter(Boolean);
    return parts[1] === organization && parts[3] === project;
  });
  const projectSummary = geckoProjectSummary.find(
    (candidate) =>
      candidate.organization === organization && candidate.project === project,
  );
  const [draft, setDraft] = React.useState<ProjectPresentationDraft | null>(null);

  React.useEffect(() => {
    if (!organization || !project) {
      return;
    }
    setDraft(
      buildProjectPresentationDraft({
        organization,
        project,
        projectConfig: projectRecord?.configData,
        projectRecord,
        projectSummary,
      }),
    );
  }, [organization, project, projectRecord, projectSummary]);

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
          <div className="px-6 py-8 lg:px-8">
            <ProjectPresentationEditor
              draft={draft}
              onChange={setDraft}
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
