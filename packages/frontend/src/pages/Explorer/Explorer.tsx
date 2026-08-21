import React from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import type { SharedFieldMapping } from '@gen3/core';
import { canonicalLoomProjectId, useGetExplorerStateV1Query } from '@gen3/core';
import { NavPageLayout } from '../../features/Navigation';
import PageLoadBoundary from '../../components/MessageCards/PageLoadBoundary';
import { ProtectedContent } from '../../components/Protected';
import type { PageLoadProblem } from '../../lib/pageLoader';
import type { ExplorerRuntimeV1 } from '@gen3/core';
import { useSession } from '../../lib/session/session';
import { ExplorerPageProps } from './types';

const CohortBuilder = dynamic(
  () => import('../../features/CohortBuilder/CohortBuilder'),
  { ssr: false },
);

interface ExplorerMainContentProps {
  runtime: ExplorerRuntimeV1 | null;
  project?: string;
  activeTab?: string | null;
  hideTabList?: boolean;
  onTabChange?: (value: string | null) => void;
  sharedFiltersMap: SharedFieldMapping | null;
  pageProblems?: readonly PageLoadProblem[];
}

export const ExplorerMainContent = ({
  runtime,
  project,
  activeTab,
  hideTabList,
  onTabChange,
  sharedFiltersMap,
  pageProblems = [],
}: ExplorerMainContentProps) => {
  if (!runtime || !project) return <PageLoadBoundary problems={pageProblems} />;

  return (
    <ProtectedContent>
      <AuthenticatedExplorerContent
        runtime={runtime}
        project={project}
        activeTab={activeTab}
        hideTabList={hideTabList}
        onTabChange={onTabChange}
        sharedFiltersMap={sharedFiltersMap}
      />
    </ProtectedContent>
  );
};

const AuthenticatedExplorerContent = ({
  runtime,
  project,
  activeTab,
  hideTabList,
  onTabChange,
  sharedFiltersMap,
}: Omit<ExplorerMainContentProps, 'pageProblems'>) => {
  const { status } = useSession();
  if (status !== 'issued') return null;
  return (
    <CohortBuilder
      runtime={runtime as ExplorerRuntimeV1}
      project={project as string}
      activeTab={activeTab}
      hideTabList={hideTabList}
      onTabChange={onTabChange}
      sharedFiltersMap={sharedFiltersMap}
    />
  );
};

const ExplorerPage = ({
  headerProps,
  footerProps,
  runtime,
  project,
  headerMetadata,
  sharedFiltersMap,
  pageProblems,
}: ExplorerPageProps): JSX.Element => {
  const router = useRouter();
  const routeProject = typeof router.query.configId === 'string'
    ? canonicalLoomProjectId(router.query.configId)
    : project;
  const routeExplorerId = typeof router.query.explorerId === 'string' ? router.query.explorerId : 'default';
  const explorerState = useGetExplorerStateV1Query(
    { project: routeProject ?? '', explorerId: routeExplorerId },
    { skip: !routeProject },
  );
  const effectiveRuntime = explorerState.data?.runtime ?? runtime;
  const pageHeaderMetadata =
    headerMetadata ?? {
      title: 'Gen3 Explorer Page',
      content: 'Explorer Page',
      key: 'gen3-explorer-page',
    };

  return (
    <NavPageLayout
      headerProps={headerProps}
      footerProps={footerProps}
      headerMetadata={pageHeaderMetadata}
      pageProblems={pageProblems}
    >
      <ExplorerMainContent
        runtime={effectiveRuntime}
        project={explorerState.data?.project ?? project}
        sharedFiltersMap={sharedFiltersMap}
        pageProblems={pageProblems}
      />
    </NavPageLayout>
  );
};

export default ExplorerPage;
