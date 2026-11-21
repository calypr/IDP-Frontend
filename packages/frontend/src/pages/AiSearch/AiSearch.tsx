import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import type { PageProps } from '../../lib/pageLoader';
import AiSearch from '../../features/Discovery/Search/AiSearch';

const AISearchPage = ({
  headerProps,
  footerProps,
  pageProblems,
}: PageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems }}
      headerMetadata={{
        title: 'Gen3 AI Search Page',
        content: 'AI Search',
        key: 'gen3-ai-search-page',
      }}
    >
      <div className="p-5 w-full">
        <AiSearch />
      </div>
    </NavPageLayout>
  );
};

export default AISearchPage;
