import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { canonicalLoomProjectId, useGetExplorerStateV1Query, useGetGeckoProjectsQuery } from '@gen3/core';
import {
  ExplorerMainContent,
  ExplorerPageGetServerSideProps as getServerSideProps,
  NavPageLayout,
  ProjectWorkspaceTabs,
  useIsEmbedded,
} from '@gen3/frontend';
import type { ExplorerPageProps, PageLoadProblem } from '@gen3/frontend';

const CohortBuilderPage = ({
  headerProps,
  footerProps,
  runtime: initialRuntime,
  project: explorerProject,
  sharedFiltersMap,
  pageProblems,
}: ExplorerPageProps): JSX.Element => {
  const router = useRouter();
  const { data: geckoProjects = [] } = useGetGeckoProjectsQuery();
  const configId =
    typeof router.query.configId === 'string' ? router.query.configId : '';
  const explorerId =
    typeof router.query.explorerId === 'string'
      ? router.query.explorerId
      : 'default';
  const projectId = canonicalLoomProjectId(configId);
  const explorerState = useGetExplorerStateV1Query(
    { project: projectId, explorerId },
    { skip: !configId },
  );
  const runtime = explorerState.data?.runtime ?? initialRuntime ?? null;
  const clientProblems: readonly PageLoadProblem[] = explorerState.error
    ? [{
        severity: 'error',
        source: 'loom',
        status: typeof explorerState.error === 'object' && explorerState.error && 'status' in explorerState.error && typeof explorerState.error.status === 'number' ? explorerState.error.status : 502,
        code: typeof explorerState.error === 'object' && explorerState.error && 'code' in explorerState.error && typeof explorerState.error.code === 'string' ? explorerState.error.code : 'EXPLORER_STATE_REQUEST_FAILED',
        retryable: true,
        message: typeof explorerState.error === 'object' && explorerState.error && 'message' in explorerState.error && typeof explorerState.error.message === 'string' ? explorerState.error.message : 'The Explorer state could not be loaded.',
      }]
    : explorerState.data && !explorerState.data.runtime
      ? [{
          severity: 'error',
          source: 'loom',
          status: 422,
          code: 'EXPLORER_RUNTIME_REQUIRED',
          retryable: false,
          message: 'Loom returned Explorer state without its server-generated runtime.',
        }]
      : [];
  const problems = [...(pageProblems ?? []), ...clientProblems];
  const isEmbedded = useIsEmbedded();
  const [activeExplorerTab, setActiveExplorerTab] = useState<string | null>(
    runtime?.outputs[0]?.title ?? null,
  );

  const matchingProject = geckoProjects.find((candidate) => {
    const parts = candidate.resourcePath.split('/').filter(Boolean);
    return `${parts[1]}/${parts[3]}` === projectId;
  });
  const matchingProjectParts =
    matchingProject?.resourcePath.split('/').filter(Boolean) ?? [];
  const organization = matchingProjectParts[1] ?? '';
  const project = matchingProjectParts[3] ?? '';
  const explorerHref = `/Explorer/${encodeURIComponent(projectId)}${explorerId ? `?explorerId=${encodeURIComponent(explorerId)}` : ''}`;
  const builderHref = `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/explorers/builder${explorerId ? `?explorerId=${encodeURIComponent(explorerId)}` : ''}`;
  const showTabsInToolbar = Boolean(organization && project && !isEmbedded);

  useEffect(() => {
    setActiveExplorerTab(runtime?.outputs[0]?.title ?? null);
  }, [configId, projectId, runtime]);

  const explorerContent = runtime && explorerProject ? (
    <ExplorerMainContent
      runtime={runtime}
      project={explorerProject}
      activeTab={showTabsInToolbar ? activeExplorerTab : undefined}
      hideTabList={showTabsInToolbar}
      onTabChange={showTabsInToolbar ? setActiveExplorerTab : undefined}
      sharedFiltersMap={sharedFiltersMap}
      pageProblems={pageProblems}
    />
  ) : explorerState.isLoading || explorerState.isUninitialized ? (
    <main className="mx-auto max-w-screen-2xl p-6">
      <p role="status">Loading Explorer…</p>
    </main>
  ) : (
    <main className="mx-auto max-w-screen-2xl p-6">
      <p role="alert">
        The published Explorer configuration could not be loaded. Open the
        Builder to inspect or revise the draft.
      </p>
      {problems.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
          {problems.map((problem, index) => (
            <li key={`${problem.code ?? 'problem'}-${index}`}>
              {problem.message}
            </li>
          ))}
        </ul>
      )}
    </main>
  );

  if (isEmbedded) {
    return explorerContent;
  }

  return (
    <NavPageLayout
      headerProps={headerProps}
      footerProps={footerProps}
      headerMetadata={{
        title: 'Gen3 Cohort Builder Page',
        content: 'Cohort Builder',
        key: 'gen3-cohort-builder-page',
      }}
      pageProblems={problems}
    >
      <ProjectWorkspaceTabs
        activeTab="explorer"
        hasExplorerConfig={Boolean(organization && project)}
        organization={organization}
        project={project}
        explorerHref={explorerHref}
        toolbarContent={
          showTabsInToolbar ? (
            <div className="flex min-w-0 flex-1 items-center justify-between border-l border-slate-200 pl-5">
              <div
                aria-label="Explorer views"
                className="flex min-w-0 shrink gap-5 overflow-x-auto"
                role="tablist"
              >
                {runtime?.outputs.map((output) => {
                  const isActive = activeExplorerTab === output.title;
                  return (
                    <button
                      aria-selected={isActive}
                      className={`rounded-none border-0 border-b-2 bg-transparent px-0 pb-3 pt-3 text-sm font-semibold transition-colors ${
                        isActive
                          ? 'border-[#2f5aac] text-[#2f5aac]'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                      key={output.outputId}
                      onClick={() => setActiveExplorerTab(output.title)}
                      role="tab"
                      type="button"
                    >
                      {output.title}
                    </button>
                  );
                })}
              </div>
              <div
                aria-label="Explorer workspace"
                className="ml-auto flex shrink-0 self-stretch gap-5 border-l border-slate-200 pl-5"
                role="tablist"
              >
                <span
                  aria-selected="true"
                  className="rounded-none border-0 border-b-2 border-[#2f5aac] bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-[#2f5aac]"
                  role="tab"
                >
                  View
                </span>
                <Link
                  className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                  href={builderHref}
                  role="tab"
                >
                  Builder
                </Link>
              </div>
            </div>
          ) : null
        }
      >
        {explorerContent}
      </ProjectWorkspaceTabs>
    </NavPageLayout>
  );
};

export default CohortBuilderPage;

export { getServerSideProps };
