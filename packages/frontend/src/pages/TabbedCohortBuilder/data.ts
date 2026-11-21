import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { TabbedCohortBuilderConfiguration } from '../../features/CohortBuilder/TabbedCohortBuilder';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { TabbedCohortBuilderPageProps } from './types';
import { TabbedCohortBuilderConfigurationSchema } from './configurationSchema';

export const TabbedCohortBuilderPageGetServerSideProps = definePageLoader<TabbedCohortBuilderPageProps>({
  name: 'TabbedCohortBuilder',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: await context.config.load({
      id: 'tabbedCohortBuilder',
      source: 'content',
      resolvePath: () => `${GEN3_COMMONS_NAME}/tabbedCohortBuilder.json`,
      schema: TabbedCohortBuilderConfigurationSchema,
    }) as TabbedCohortBuilderConfiguration,
  }),
  fallback: () => ({ configuration: null }),
});
