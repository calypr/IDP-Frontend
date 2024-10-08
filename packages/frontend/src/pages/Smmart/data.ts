import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type SmmartProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const SmmartPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  try {
    const smmartConfig: SmmartProps = await ContentSource.get(
      `config/${GEN3_COMMONS_NAME}/smmartLandingPage.json`,
    );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        smmartConfig: smmartConfig ? smmartConfig : null,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        smmartConfig: undefined,
      },
    };
  }
};
