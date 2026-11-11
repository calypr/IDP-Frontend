import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  canonicalLoomProjectId,
  useGetExplorerAuthoringExplorersQuery,
  useGetProjectViewBuilderQuery,
  useGetExplorerStateV1Query,
  useGetGeckoProjectsQuery,
} from '@gen3/core';
import {
  ExplorerMainContent,
  selectedProjectViewId,
  useProjectViewTab,
  isExplorerBuilderEnabled,
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
  explorerId: initialExplorerId,
  sharedFiltersMap,
  pageProblems,
}: ExplorerPageProps): JSX.Element => {
  const router = useRouter();
  const { data: geckoProjects = [] } = useGetGeckoProjectsQuery();
  const configId =
    typeof router.query.configId === 'string' ? router.query.configId : '';
  const explicitExplorerId =
    typeof router.query.explorerId === 'string'
      ? router.query.explorerId
      : undefined;
  const projectId = canonicalLoomProjectId(configId);
  const viewSettings = useGetProjectViewBuilderQuery(
    { project: projectId },
    { skip: !projectId, refetchOnMountOrArgChange: true },
  );
  const settings = viewSettings.currentData?.settings;
  const explorerId = selectedProjectViewId(
    explicitExplorerId,
    settings?.defaultConfigId,
  );
  const waitingForDefaults = !explicitExplorerId && !viewSettings.currentData;
  const initialFrame =
    typeof router.query.frame === 'string'
      ? router.query.frame
      : explorerId === settings?.defaultConfigId
        ? settings.defaultFrameId
        : undefined;
  const explorerConfigsQuery = useGetExplorerAuthoringExplorersQuery(
    { project: projectId },
    { skip: !projectId, refetchOnMountOrArgChange: true },
  );
  const publishedExplorerConfigs = (explorerConfigsQuery.data ?? []).filter(
    (summary) => Boolean(summary.activeRevisionId),
  );
  const showExplorerConfigPicker =
    !explorerConfigsQuery.error && publishedExplorerConfigs.length >= 2;
  const selectedExplorerConfigId = publishedExplorerConfigs.some(
    (summary) => summary.explorerId === explorerId,
  )
    ? explorerId
    : '';
  const handleExplorerConfigChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextExplorerId = event.currentTarget.value;
    if (!nextExplorerId) return;
    void router.replace(
      {
        pathname: router.pathname,
        query: {
          ...router.query,
          explorerId: nextExplorerId,
          frame: undefined,
        },
      },
      undefined,
      { shallow: true },
    );
  };
  const explorerState = useGetExplorerStateV1Query(
    { project: projectId, explorerId },
    { skip: !configId || waitingForDefaults, refetchOnMountOrArgChange: true },
  );
  const currentExplorerState = explorerState.currentData;
  const runtime = waitingForDefaults
    ? null
    : (currentExplorerState?.runtime ??
      (explorerProject === projectId && initialExplorerId === explorerId
        ? initialRuntime
        : null));
  const effectiveProject = currentExplorerState?.project ?? explorerProject;
  const clientProblems: readonly PageLoadProblem[] = explorerState.error
    ? [
        {
          severity: 'error',
          source: 'loom',
          status:
            typeof explorerState.error === 'object' &&
            explorerState.error &&
            'status' in explorerState.error &&
            typeof explorerState.error.status === 'number'
              ? explorerState.error.status
              : 502,
          code:
            typeof explorerState.error === 'object' &&
            explorerState.error &&
            'code' in explorerState.error &&
            typeof explorerState.error.code === 'string'
              ? explorerState.error.code
              : 'EXPLORER_STATE_REQUEST_FAILED',
          retryable: true,
          message:
            typeof explorerState.error === 'object' &&
            explorerState.error &&
            'message' in explorerState.error &&
            typeof explorerState.error.message === 'string'
              ? explorerState.error.message
              : 'The Explorer state could not be loaded.',
        },
      ]
    : currentExplorerState && !currentExplorerState.runtime
      ? [
          {
            severity: 'error',
            source: 'loom',
            status: 422,
            code: 'EXPLORER_RUNTIME_REQUIRED',
            retryable: false,
            message:
              'Loom returned Explorer state without its server-generated runtime.',
          },
        ]
      : [];
  const problems = [...(pageProblems ?? []), ...clientProblems];
  const isEmbedded = useIsEmbedded();
  const {
    activeTab: activeExplorerTab,
    selectTab: setActiveExplorerTab,
    unavailableDefault,
  } = useProjectViewTab(runtime, initialFrame, `${projectId}/${explorerId}`);

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
  const viewBuilderHref = `/org/${encodeURIComponent(organization)}/project/${encodeURIComponent(project)}/explorers/views?explorerId=${encodeURIComponent(explorerId)}`;
  const showTabsInToolbar = Boolean(organization && project && !isEmbedded);

  const explorerContent =
    runtime && effectiveProject ? (
      <>
        {unavailableDefault && (
          <p role="alert" className="p-4 text-amber-800">
            The saved default table needs updating for the current data. Choose
            another tab or repair the view in View Builder.
          </p>
        )}
        <ExplorerMainContent
          runtime={runtime}
          project={effectiveProject}
          activeTab={activeExplorerTab}
          hideTabList={showTabsInToolbar}
          onTabChange={setActiveExplorerTab}
          sharedFiltersMap={sharedFiltersMap}
          pageProblems={pageProblems}
          toolbarCenter={
            showExplorerConfigPicker ? (
              <label className="flex flex-wrap items-center justify-center gap-2 text-sm text-slate-600">
                <span>Project configuration</span>
                <select
                  aria-label="Project configuration"
                  className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                  value={selectedExplorerConfigId}
                  onChange={handleExplorerConfigChange}
                >
                  <option value="">Select a published configuration</option>
                  {publishedExplorerConfigs.map((summary) => (
                    <option key={summary.explorerId} value={summary.explorerId}>
                      {summary.title || summary.explorerId}
                    </option>
                  ))}
                </select>
              </label>
            ) : null
          }
        />
      </>
    ) : waitingForDefaults && viewSettings.error ? (
      <p role="alert" className="p-6">
        The project’s default view could not be loaded. Refresh to retry.
      </p>
    ) : waitingForDefaults ||
      explorerState.isLoading ||
      explorerState.isUninitialized ||
      explorerState.isFetching ? (
      <main className="mx-auto max-w-screen-2xl p-6">
        <p role="status">Loading Explorer…</p>
      </main>
    ) : (
      <main className="mx-auto max-w-screen-2xl p-6">
        <p role="alert">
          The published Explorer could not be loaded. Check the metadata
          publication status in Source, then refresh this page.
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
        title: 'Project Explorer',
        content: 'Published project metadata',
        key: 'project-explorer-page',
      }}
      pageProblems={problems}
    >
      <ProjectWorkspaceTabs
        activeTab="explorer"
        hasExplorerConfig={Boolean(runtime && organization && project)}
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
              {(viewSettings.currentData?.canEdit ||
                isExplorerBuilderEnabled()) && (
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
                  {viewSettings.currentData?.canEdit && (
                    <Link
                      href={viewBuilderHref}
                      className="px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                      role="tab"
                    >
                      View Builder
                    </Link>
                  )}
                  {isExplorerBuilderEnabled() && (
                    <Link
                      className="rounded-none border-0 border-b-2 border-transparent bg-transparent px-0 pb-3 pt-3 text-sm font-semibold text-slate-500 hover:text-slate-800"
                      href={builderHref}
                      role="tab"
                    >
                      Builder
                    </Link>
                  )}
                </div>
              )}
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
