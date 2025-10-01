import { useRouter } from 'next/router';
import React from 'react';
import {
  NavPageLayout,
  ProtectedContent,
  type ReportsPageProps,
  MAReportsPageGetServerSideProps as getServerSideProps,
  MedicationAdministrationDetailPanel,
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
        <MedicationAdministrationDetailPanel
          id={Array.isArray(uuid) ? uuid[0] : uuid}
          tableConfig={reportsConfig.tableConfig}
        ></MedicationAdministrationDetailPanel>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default ReportsPage;

export { getServerSideProps };
