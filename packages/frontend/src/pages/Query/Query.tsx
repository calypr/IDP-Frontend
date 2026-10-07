import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import QueryPanel from '../../features/Query/QueryPanel';
import { QueryPageLayoutProps } from './types';

const QueryPage = ({
  headerProps,
  footerProps,
  configuration,
  pageProblems,
}: QueryPageLayoutProps): JSX.Element => {
  if (!configuration) {
    return (
      <NavPageLayout
        {...{ headerProps, footerProps, pageProblems }}
        layoutMode="viewport"
        headerMetadata={{
          title: 'Gen3 Query Page',
          content: 'Query page',
          key: 'gen3-query-page',
        }}
      >
        <div className="flex h-full min-h-0 items-center justify-center p-8 text-red-700">
          Query configuration is unavailable.
        </div>
      </NavPageLayout>
    );
  }
  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
      layoutMode="viewport"
      headerMetadata={{
        title: 'Gen3 Query Page',
        content: 'Query page',
        key: 'gen3-query-page',
        ...(configuration.headerMetadata ? configuration.headerMetadata : {}),
      }}
    >
      <div className="h-full min-h-0">
        <QueryPanel configuration={configuration} />
      </div>
    </NavPageLayout>
  );
};

export default QueryPage;
