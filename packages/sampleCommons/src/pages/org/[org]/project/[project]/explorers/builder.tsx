import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ExplorerBuilderPage,
  NavPageLayout,
  ProjectWorkspaceTabs,
  type NavPageLayoutProps,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

export const getServerSideProps = defineSamplePageLoader('ExplorerBuilder');

const ProjectExplorerBuilder = ({
  headerProps,
  footerProps,
  pageProblems,
}: NavPageLayoutProps): JSX.Element => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const explorerId =
    typeof router.query.explorerId === 'string'
      ? router.query.explorerId
      : undefined;
  const explorerHref = `/Explorer/${encodeURIComponent(`${organization}-${project}`)}${explorerId ? `?explorerId=${encodeURIComponent(explorerId)}` : ''}`;
  return (
    <NavPageLayout
      {...{ footerProps, headerProps, pageProblems }}
      headerMetadata={{
        title: 'Explorer Builder',
        content: 'Explorer Builder',
        key: 'explorer-builder-page',
      }}
    >
      {organization && project ? (
        <ProjectWorkspaceTabs
          activeTab="explorer"
          hasExplorerConfig
          organization={organization}
          project={project}
          explorerHref={explorerHref}
          toolbarContent={
            <div className="flex w-full items-center gap-4">
              <div
                id="explorer-builder-toolbar-host"
                className="min-w-0 flex-1 border-l border-slate-200 pl-4"
              />
              <div
                aria-label="Explorer workspace"
                className="ml-auto flex shrink-0 self-stretch gap-5 border-l border-slate-200 pl-5"
                role="tablist"
              >
                <Link
                  className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                  href={explorerHref}
                  role="tab"
                >
                  View
                </Link>
                <span
                  aria-selected="true"
                  className="rounded-none border-0 border-b-2 border-[#2f5aac] px-0 pb-3 pt-3 text-sm font-semibold text-[#2f5aac]"
                  role="tab"
                >
                  Builder
                </span>
              </div>
            </div>
          }
        >
          <ExplorerBuilderPage organization={organization} project={project} />
        </ProjectWorkspaceTabs>
      ) : (
        <p>Loading builder…</p>
      )}
    </NavPageLayout>
  );
};

export default ProjectExplorerBuilder;
