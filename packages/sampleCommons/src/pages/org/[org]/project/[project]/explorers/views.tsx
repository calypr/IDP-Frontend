import React from 'react';
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
          hasExplorerConfig
          organization={organization}
          project={project}
          explorerHref={explorerHref}
          toolbarContent={
            <div className="flex items-center gap-5 border-l border-slate-200 pl-5">
              <Link href={explorerHref}>Viewer</Link>
              <span aria-current="page" className="font-semibold">
                View Builder
              </span>
            </div>
          }
        >
          <ViewBuilder
            key={`${organization}/${project}`}
            project={`${organization}/${project}`}
            selectedConfigId={selectedConfigId}
            onSelectConfig={selectConfig}
            viewHref={explorerHref}
          />
        </ProjectWorkspaceTabs>
      ) : (
        <p role="status">Loading project…</p>
      )}
    </NavPageLayout>
  );
};
export default ProjectViewBuilder;
