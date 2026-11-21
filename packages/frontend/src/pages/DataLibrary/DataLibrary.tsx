import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import {
  DataLibrary,
} from '../../features/DataLibrary';
import type { DataLibraryPageProps } from './types';

const DataLibraryPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: DataLibraryPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 DataLibrary Page',
        content: 'DataLibrary Data',
        key: 'gen3-data-library-page',
      }}
    >
      {configuration && <DataLibrary {...configuration} />}
    </NavPageLayout>
  );
};

export default DataLibraryPage;
