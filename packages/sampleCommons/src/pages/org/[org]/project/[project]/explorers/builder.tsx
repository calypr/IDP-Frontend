import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ExplorerBuilderPage, ProjectWorkspaceTabs } from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

export const getServerSideProps = defineSamplePageLoader('ExplorerBuilder');

const ProjectExplorerBuilder = (): JSX.Element => {
  const router = useRouter();
  const organization =
    typeof router.query.org === 'string' ? router.query.org : '';
  const project =
    typeof router.query.project === 'string' ? router.query.project : '';
  return organization && project ? (
    <ProjectWorkspaceTabs
      activeTab="explorer"
      hasExplorerConfig
      organization={organization}
      project={project}
      toolbarContent={
        <div
          aria-label="Explorer workspace"
          className="flex shrink-0 self-stretch gap-5 border-l border-slate-200 pl-5"
          role="tablist"
        >
          <Link
            className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
            href={`/Explorer/${encodeURIComponent(`${organization}-${project}`)}`}
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
      }
    >
      <ExplorerBuilderPage organization={organization} project={project} />
    </ProjectWorkspaceTabs>
  ) : (
    <p>Loading builder…</p>
  );
};

export default ProjectExplorerBuilder;
