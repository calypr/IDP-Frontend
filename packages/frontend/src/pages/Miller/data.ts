import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type MillerProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const MillerPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const millerPageProps: MillerProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/millerPage.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      millerConfig: millerPageProps,
    },
  };
};
