import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type AppsProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const AppsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  try {
    const appsPageProps: AppsProps = await ContentSource.get(
      `config/${GEN3_COMMONS_NAME}/appsPage.json`,
    );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        appsConfig: appsPageProps,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        appsConfig: undefined,
      },
    };
  }
};
