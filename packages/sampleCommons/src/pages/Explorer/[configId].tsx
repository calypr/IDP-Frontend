import React from 'react';
import {
  NavPageLayout,
} from '@gen3/frontend';
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
  fileActions,
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
          fileActions={fileActions}
        />
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default CohortBuilderPage;

export { getServerSideProps };
