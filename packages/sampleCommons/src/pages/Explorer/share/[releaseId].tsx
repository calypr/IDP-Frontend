import React from 'react';
import {
  ExplorerPage,
  ExplorerPageGetServerSidePropsForRelease as getServerSideProps,
  type ExplorerPageProps,
} from '@gen3/frontend';

const SharedExplorerPage = (props: ExplorerPageProps): JSX.Element => (
  <ExplorerPage {...props} />
);

export default SharedExplorerPage;
export { getServerSideProps };
