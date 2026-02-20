import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import { microserviceDb } from '../../lib/content'; // ← NEW: direct microservice
import type { AppsProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const AppsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const appsPageProps: AppsProps =
    await microserviceDb.get<AppsProps>('apps_page/1');

  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      appsConfig: appsPageProps,
    },
  };
};
