import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { ConfiguratorProps } from './types';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const ConfiguratorPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (_context) => {
  try {
    const configuratorPageProps: ConfiguratorProps =
      await ContentSource.getContentDatabase().get(
        `config/${GEN3_COMMONS_NAME}/configurator.json`,
      );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        configuratorConfig: configuratorPageProps,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        configuratorConfig: undefined,
      },
    };
  }
};
