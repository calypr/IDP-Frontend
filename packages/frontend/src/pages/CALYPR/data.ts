import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type CalyprProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const CalyprPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const calyprConfig: CalyprProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/calyprLandingPage.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      calyprConfig: calyprConfig ? calyprConfig : null,
    },
  };
};
