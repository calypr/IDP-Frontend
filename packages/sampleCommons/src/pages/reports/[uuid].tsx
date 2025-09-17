import { useRouter } from 'next/router';
import React from 'react';
import {
  NavPageLayout,
  ProtectedContent,
  type ReportsPageProps,
  ReportsPageGetServerSideProps as getServerSideProps,
  ResearchSubjectDetailsPanel,
} from '@gen3/frontend';

const ReportsPage = ({
  headerProps,
  footerProps,
  reportsConfig,
}: ReportsPageProps) => {
  const router = useRouter();
  const { uuid } = router.query;

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Gen3 Cohort Builder Page',
        content: 'Cohort Builder',
        key: 'gen3-cohort-builder-page',
      }}
    >
      <ProtectedContent>
        <ResearchSubjectDetailsPanel
          id={uuid}
          tableConfig={reportsConfig.tableConfig}
        ></ResearchSubjectDetailsPanel>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default ReportsPage;

export { getServerSideProps };
