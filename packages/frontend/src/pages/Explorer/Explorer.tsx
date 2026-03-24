import React from 'react';
import dynamic from 'next/dynamic';
import { NavPageLayout } from '../../features/Navigation';
import { ExplorerPageProps } from './types';
import { Center } from '@mantine/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';

const CohortBuilder = dynamic(
  () => import('../../features/CohortBuilder/CohortBuilder'),
  {
    ssr: false,
  },
);

import { useSession } from '../../lib/session/session';
import { CohortBuilderProps } from '../../features/CohortBuilder';

export const ExplorerMainContent = ({
  explorerConfig,
  tabsLayout,
  sharedFiltersMap,
  fileActions,
}: CohortBuilderProps) => {
  const { status } = useSession();
  


  if (status !== 'issued') {
    return null;
  }
  if (!explorerConfig) {
    return (
      <Center maw={400} h={100} mx="auto">
        <div>Explorer config is not defined. Page disabled</div>
      </Center>
    );
  }
  return (
    <CohortBuilder
      tabsLayout={tabsLayout}
      explorerConfig={explorerConfig}
      sharedFiltersMap={sharedFiltersMap}
      fileActions={fileActions}
    />
  );
};

import { useRouter } from 'next/router';

const ExplorerPage = ({
  headerProps,
  footerProps,
  explorerConfig,
  headerMetadata,
  tabsLayout,
  sharedFiltersMap,
  fileActions,
  errorStatus,
}: ExplorerPageProps): JSX.Element => {
  const pageHeaderMetadata = {
    title: 'Gen3 Explorer Page',
    content: 'Explorer Page',
    key: 'gen3-explorer-page',
    ...(headerMetadata ? headerMetadata : {}),
  };
  const router = useRouter();

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={pageHeaderMetadata}
    >
      <ProtectedContent errorStatus={errorStatus}>
        <ExplorerMainContent
          key={router.asPath}
          explorerConfig={explorerConfig}
          tabsLayout={tabsLayout}
          sharedFiltersMap={sharedFiltersMap}
          fileActions={fileActions}
        />
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default ExplorerPage;
