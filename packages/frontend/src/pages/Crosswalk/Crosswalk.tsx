import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import { CrosswalkPanel } from '../../features/Crosswalk';
import type { CrosswalkPageProps } from './types';

const CrosswalkPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: CrosswalkPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Crosswalk Page',
        content: 'Crosswalk Data',
        key: 'gen3-crosswalk-page',
        ...(configuration?.headerMetadata ? configuration.headerMetadata : {}),
      }}
    >
      {configuration && <CrosswalkPanel {...configuration} />}
    </NavPageLayout>
  );
};

export default CrosswalkPage;
