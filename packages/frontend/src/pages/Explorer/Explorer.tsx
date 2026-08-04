import React from 'react';
import dynamic from 'next/dynamic';
import type { SharedFieldMapping } from '@gen3/core';
import { NavPageLayout } from '../../features/Navigation';
import PageLoadBoundary from '../../components/MessageCards/PageLoadBoundary';
import type { PageLoadProblem } from '../../lib/pageLoader';
import type { CohortBuilderConfiguration } from '../../features/CohortBuilder';
import { useSession } from '../../lib/session/session';
import { ExplorerPageProps } from './types';

const CohortBuilder = dynamic(
  () => import('../../features/CohortBuilder/CohortBuilder'),
  { ssr: false },
);

interface ExplorerMainContentProps {
  configuration: CohortBuilderConfiguration | null;
  activeTab?: string | null;
  hideTabList?: boolean;
  onTabChange?: (value: string | null) => void;
  sharedFiltersMap: SharedFieldMapping | null;
  pageProblems?: readonly PageLoadProblem[];
}

export const ExplorerMainContent = ({
  configuration,
  activeTab,
  hideTabList,
  onTabChange,
  sharedFiltersMap,
  pageProblems = [],
}: ExplorerMainContentProps) => {
  const { status } = useSession();

  if (!configuration) return <PageLoadBoundary problems={pageProblems} />;
  if (status !== 'issued') return null;

  return (
    <CohortBuilder
      configuration={configuration}
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
  configuration,
  headerMetadata,
  sharedFiltersMap,
  pageProblems,
}: ExplorerPageProps): JSX.Element => {
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
        configuration={configuration}
        sharedFiltersMap={sharedFiltersMap}
        pageProblems={pageProblems}
      />
    </NavPageLayout>
  );
};

export default ExplorerPage;
