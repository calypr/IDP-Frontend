import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type AppsProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const AppsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const appsPageProps: AppsProps = await ContentSource.getContentDatabase().get(
    `${GEN3_COMMONS_NAME}/appsPage.json`,
  );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      appsConfig: appsPageProps,
    },
  };
};
