import { GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { ConfiguratorConfigurationSchema } from './configurationSchema';
import type { ConfiguratorConfig, ConfiguratorPageProps } from './types';

const configuratorConfiguration = {
  id: 'configurator',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/configurator.json`,
  schema: ConfiguratorConfigurationSchema,
};

export const ConfiguratorPageGetServerSideProps =
  definePageLoader<ConfiguratorPageProps>({
    name: 'Configurator',
    loadNavigation: loadNavigationFromContext,
    load: async (context) => ({
      configuration: (await context.config.load(configuratorConfiguration)) as ConfiguratorConfig,
    }),
    fallback: () => ({ configuration: null }),
  });
