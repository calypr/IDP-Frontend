import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  NavPageLayout,
  ProjectWorkspaceTabs,
  type NavPageLayoutProps,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

const ViewBuilder = dynamic(
  () => import('@gen3/frontend').then((module) => module.ExplorerViewBuilder),
  {
    ssr: false,
    loading: () => (
      <p role="status" className="p-6">
        Loading View Builder…
      </p>
    ),
  },
);

export const getServerSideProps = defineSamplePageLoader('ExplorerBuilder');

const ProjectViewBuilder = ({
  headerProps,
  footerProps,
  pageProblems,
}: NavPageLayoutProps) => {
  const router = useRouter();
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(
    null,
  );
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  const selectedConfigId =
    typeof router.query.explorerId === 'string'
      ? router.query.explorerId
      : undefined;
  const explorerHref = `/Explorer/${encodeURIComponent(`${organization}/${project}`)}${selectedConfigId ? `?explorerId=${encodeURIComponent(selectedConfigId)}` : ''}`;
  const selectConfig = (id: string | undefined) => {
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, explorerId: id } },
      undefined,
      { shallow: true },
    );
  };
  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
      headerMetadata={{
        title: 'View Builder',
        content: 'Project views',
        key: 'project-view-builder',
      }}
    >
      {organization && project ? (
        <ProjectWorkspaceTabs
          activeTab="explorer"
          stickyHeader
          hasExplorerConfig
          organization={organization}
          project={project}
          explorerHref={explorerHref}
          toolbarContent={
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
              <div
                ref={setToolbarTarget}
                className="flex min-w-0 flex-1 justify-center py-2"
              />
              <div
                className="ml-auto flex min-w-0 justify-end gap-5"
                role="tablist"
                aria-label="Explorer workspace"
              >
                <Link
                  href={explorerHref}
                  role="tab"
                  className="rounded-none border-0 border-b-2 border-transparent px-0 py-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                >
                  Viewer
                </Link>
                <span
                  aria-current="page"
                  aria-selected="true"
                  role="tab"
                  className="rounded-none border-0 border-b-2 border-[#2f5aac] px-0 py-3 text-sm font-semibold text-[#2f5aac]"
                >
                  View Builder
                </span>
              </div>
            </div>
          }
        >
          <ViewBuilder
            key={`${organization}/${project}`}
            project={`${organization}/${project}`}
            selectedConfigId={selectedConfigId}
            onSelectConfig={selectConfig}
            viewHref={explorerHref}
            toolbarTarget={toolbarTarget}
          />
        </ProjectWorkspaceTabs>
      ) : (
        <p role="status">Loading project…</p>
      )}
    </NavPageLayout>
  );
};
export default ProjectViewBuilder;
