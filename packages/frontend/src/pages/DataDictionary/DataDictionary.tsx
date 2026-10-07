import React from 'react';
import { DictionaryWithContext } from '../../features/Dictionary';
import { NavPageLayout } from '../../features/Navigation';
import { DictionaryPageProps } from './types';

const DictionaryPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: DictionaryPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps, pageProblems, layoutMode: 'viewport' as const }}
      headerMetadata={{
        title: 'Gen3 DataDictionary Page',
        content: 'Data Dictionary',
        key: 'gen3-data-dictionary-page',
        ...(configuration?.headerMetadata ? configuration.headerMetadata : {}),
      }}
    >
      {configuration && <DictionaryWithContext config={configuration} />}
    </NavPageLayout>
  );
};

export default DictionaryPage;
