import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import QueryPanel from '../../features/Query/QueryPanel';
import { QueryPageLayoutProps } from './types';

const QueryPage = ({
  headerProps,
  footerProps,
  queryProps,
}: QueryPageLayoutProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Gen3 Query Page',
        content: 'Query page',
        key: 'gen3-query-page',
        ...(queryProps?.headerMetadata ? queryProps.headerMetadata : {}),
      }}
    >
      <div className="h-full min-h-0">
        <QueryPanel graphQLEndpoint={queryProps.graphQLEndpoint} />
      </div>
    </NavPageLayout>
  );
};

export default QueryPage;
