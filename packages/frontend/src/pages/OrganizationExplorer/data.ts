import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import type { OrganizationExplorerPageProps } from './types';

export const OrganizationExplorerPageGetServerSideProps: GetServerSideProps<
  OrganizationExplorerPageProps
> = async () => ({
  props: {
    ...(await getNavPageLayoutPropsFromConfig()),
  },
});
