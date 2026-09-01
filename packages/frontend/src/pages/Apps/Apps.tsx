import React, { useMemo } from 'react';
import { Loader, MantineProvider, Text } from '@mantine/core';
import { useRouter } from 'next/router';
import type { AppsPageProps } from './types';
import { NavPageLayout } from '../../features/Navigation';
import {
  useGetGeckoProjectSummaryQuery,
  useGetGeckoProjectsQuery,
} from '@gen3/core';
import { ProtectedContent } from '../../components/Protected';

const projectPresentationHref = (organization: string, project: string) =>
  `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/presentation`;

const fallbackProjectThumbnailURL = '/icons/calypr-mark-mono.svg';

const AppsPage = ({ headerProps, footerProps, pageProblems }: AppsPageProps) => {
  const router = useRouter();
  const { isLoading: isGeckoProjectsLoading } = useGetGeckoProjectsQuery();
  const {
    data: geckoProjectSummary = [],
    isLoading: isGeckoProjectSummaryLoading,
  } = useGetGeckoProjectSummaryQuery();

  const projectCatalog = useMemo(
    () =>
      geckoProjectSummary
        .map((project) => ({
          organization: project.organization,
          project: project.project,
          title: project.title,
          contactEmail: project.contact_email,
          description: project.description,
          thumbnailURL: project.thumbnail_url,
        }))
        .filter((project) => project.organization && project.project)
        .sort((left, right) => {
          const titleComparison = (left.title || left.project)
            .toLowerCase()
            .localeCompare((right.title || right.project).toLowerCase());
          if (titleComparison !== 0) {
            return titleComparison;
          }
          const orgComparison = left.organization
            .toLowerCase()
            .localeCompare(right.organization.toLowerCase());
          if (orgComparison !== 0) {
            return orgComparison;
          }
          return left.project
            .toLowerCase()
            .localeCompare(right.project.toLowerCase());
        }),
    [geckoProjectSummary],
  );



  const content = (
    <div className="px-6 py-4">
      <div className="mx-2">
        {isGeckoProjectsLoading || isGeckoProjectSummaryLoading ? (
          <div className="flex min-h-[18rem] items-center justify-center border border-slate-200 bg-white">
            <Loader />
          </div>
        ) : projectCatalog.length === 0 ? (
          <div className="border border-slate-200 bg-white px-6 py-8">
            <Text fw={600}>No Gecko projects are currently available.</Text>
            <Text c="dimmed" mt="xs" size="sm">
              Once projects are registered in CALYPR, they will appear here for
              all logged-in users.
            </Text>
          </div>
        ) : (
          <div className="bg-white">
            <div className="grid items-center gap-6 bg-black px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.8fr)_auto]">
              <div />
              <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Project/Organization
              </Text>
              <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Description
              </Text>
              <Text className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white">
                Contact
              </Text>
              <div />
            </div>
            {projectCatalog.map((project) => {
              const title = project.title || project.project;
              const contactEmail =
                project.contactEmail || 'No contact email configured';
              const description =
                project.description || 'No project description provided.';
              const presentationHref = projectPresentationHref(
                project.organization,
                project.project,
              );
              return (
                <div
                  className="grid cursor-pointer items-center gap-6 px-3 py-3 transition hover:bg-slate-50 focus-within:bg-slate-50 md:grid-cols-[4rem_minmax(0,1fr)_minmax(0,1.35fr)_minmax(0,0.8fr)_auto]"
                  key={`${project.organization}/${project.project}`}
                  onClick={() => void router.push(presentationHref)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      void router.push(presentationHref);
                    }
                  }}
                  role="link"
                  tabIndex={0}
                >
                  <div className="flex h-14 w-14 items-center justify-center overflow-hidden">
                    <img
                      alt={`${title} thumbnail`}
                      className="h-full w-full object-contain"
                      onError={(event) => {
                        if (
                          event.currentTarget.src.endsWith(
                            fallbackProjectThumbnailURL,
                          )
                        ) {
                          return;
                        }
                        event.currentTarget.src = fallbackProjectThumbnailURL;
                      }}
                      src={project.thumbnailURL || fallbackProjectThumbnailURL}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-baseline gap-3">
                      <Text className="truncate text-[15px] font-semibold text-slate-900">
                        {title}
                      </Text>
                      <Text className="shrink-0 truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {project.organization}
                      </Text>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <Text className="truncate text-sm text-slate-700">
                      {description}
                    </Text>
                  </div>

                  <div className="min-w-0">
                    <Text className="truncate text-sm text-slate-600" size="sm">
                      {contactEmail}
                    </Text>
                  </div>
                  <div />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <ProtectedContent>
      <NavPageLayout
        {...{ footerProps }}
        pageProblems={pageProblems}
        headerMetadata={{
          title: 'CALYPR Projects',
          content: 'Project catalog',
          key: 'calypr-project-catalog',
        }}
        headerProps={headerProps}
      >
        <MantineProvider withGlobalClasses>{content}</MantineProvider>
      </NavPageLayout>
    </ProtectedContent>
  );
};

export default AppsPage;
