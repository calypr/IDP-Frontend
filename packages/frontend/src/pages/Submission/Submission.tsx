import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import SubmissionPanel from '../../features/Submission/SubmissionPanel';
import { SubmissionsPageLayoutProps } from './types';

const SubmissionPage = ({
  configuration,
  headerProps,
  footerProps,
  pageProblems,
}: SubmissionsPageLayoutProps): JSX.Element => {
  return (
    <NavPageLayout
      footerProps={footerProps}
      headerProps={headerProps}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Submission Page',
        content: 'Submission page',
        key: 'gen3-submission-page',
      }}
    >
      <SubmissionPanel config={configuration ?? undefined} />
    </NavPageLayout>
  );
};

export default SubmissionPage;
