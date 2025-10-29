import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type ConfiguratorProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const ConfiguratorPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const configuratorConfig: ConfiguratorProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/configurator.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      configuratorConfig: configuratorConfig,
    },
  };
};
