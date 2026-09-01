import { GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { SmmartConfigurationSchema } from './configurationSchema';
import type { SmmartLandingPageProps, SmmartConfig } from './types';

export const SmmartPageGetServerSideProps = definePageLoader<SmmartLandingPageProps>({
  name: 'Smmart',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: await context.config.load({
      id: 'smmartLandingPage',
      source: 'content',
      resolvePath: () => `${GEN3_COMMONS_NAME}/smmartLandingPage.json`,
      schema: SmmartConfigurationSchema,
    }) as SmmartConfig,
  }),
  fallback: () => ({ configuration: null }),
});
