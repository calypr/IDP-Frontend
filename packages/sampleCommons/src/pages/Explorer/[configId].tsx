import {
  getNavPageLayoutPropsFromConfig,
  ExplorerPageGetServerSidePropsForConfigId,
  NavPageLayout,
  NavPageLayoutProps,
} from '@gen3/frontend';
import React from 'react';
import {
  ProtectedContent,
  ExplorerMainContent,
  ExplorerPageProps,
  ExplorerPageGetServerSidePropsForConfigId as getServerSideProps,
} from '@gen3/frontend';

const CohortBuilderPage = ({
  headerProps,
  footerProps,
  explorerConfig,
  tabsLayout,
  sharedFiltersMap,
  errorStatus,
}: ExplorerPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Gen3 Cohort Builder Page',
        content: 'Cohort Builder',
        key: 'gen3-cohort-builder-page',
      }}
    >
      <ProtectedContent errorStatus={errorStatus}>
        <ExplorerMainContent
          tabsLayout={tabsLayout}
          explorerConfig={explorerConfig}
          sharedFiltersMap={sharedFiltersMap}
        />
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default CohortBuilderPage;

export { getServerSideProps };
