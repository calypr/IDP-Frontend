import React from 'react';
import { NextRouter, useRouter } from 'next/dist/client/router';

import {
  NavPageLayout,
  NavPageLayoutProps,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

const AppsPage = ({ headerProps, footerProps, pageProblems }: NavPageLayoutProps) => {
  const router = useRouter();
  const notebook = getNotebookName(router);

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Notebook Page',
        content: 'Jupyter Notebook',
        key: 'gen3-notebook-page',
      }}
    >
      <div className="flex justify-items-center w-full">
        <iframe
          allow="cross-origin"
          src={`${router.basePath}/jupyter/lab/index.html?path=${notebook}`}
          width="100%"
          height="100%"
          title="client notebook"
        ></iframe>
      </div>
    </NavPageLayout>
  );
};

const getNotebookName = (router: NextRouter): string => {
  const { notebook } = router.query;
  if (typeof notebook === 'string') return notebook;
  else if (typeof notebook === 'object') return notebook[0];

  return 'notFound';
};

export const getServerSideProps = defineSamplePageLoader('Notebook');

export default AppsPage;
