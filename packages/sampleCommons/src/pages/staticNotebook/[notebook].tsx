import React from 'react';
import { NextRouter, useRouter } from 'next/dist/client/router';

import {
  NavPageLayout,
  NavPageLayoutProps,
  StaticNotebookIFrame,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

const StaticNotebookApp = ({
  headerProps,
  footerProps,
  pageProblems,
}: NavPageLayoutProps) => {
  const router = useRouter();
  const notebook = getNotebookName(router);

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Static Notebook Page',
        content: 'Static Notebook',
        key: 'gen3-static-notebook-page',
      }}
    >
      <StaticNotebookIFrame notebook={notebook} />
    </NavPageLayout>
  );
};

const getNotebookName = (router: NextRouter): string => {
  const { notebook } = router.query;
  if (typeof notebook === 'string') return notebook;
  else if (typeof notebook === 'object') return notebook[0];

  return 'notFound';
};

export const getServerSideProps = defineSamplePageLoader('StaticNotebook');

export default StaticNotebookApp;
