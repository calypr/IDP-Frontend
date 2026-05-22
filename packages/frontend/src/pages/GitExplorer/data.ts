import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import type { GitExplorerPageProps } from './types';

export const GitExplorerPageGetServerSideProps: GetServerSideProps<
  GitExplorerPageProps
> = async () => ({
  props: {
    ...(await getNavPageLayoutPropsFromConfig()),
  },
});
