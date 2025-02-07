import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type CaliperProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const CaliperPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  try {
    const caliperConfig: CaliperProps = await ContentSource.get(
      `config/${GEN3_COMMONS_NAME}/caliperLandingPage.json`,
    );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        caliperConfig: caliperConfig ? caliperConfig : null,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        caliperConfig: undefined,
      },
    };
  }
};
