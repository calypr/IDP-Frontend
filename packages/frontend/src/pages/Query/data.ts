import { GEN3_COMMONS_NAME } from '@gen3/core';
import { normalizeQueryConfiguration } from '../../features/Query/config';
import {
  loadNavigationFromContext,
} from '../../lib/common/staticProps';
import { definePageLoader } from '../../lib/pageLoader';
import { QueryConfigurationSchema } from './configurationSchema';
import type { QueryPageLayoutProps } from './types';

const QueryConfigurationDescriptor = {
  id: 'query',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/query.json`,
  schema: QueryConfigurationSchema,
};

export const QueryPageGetServerSideProps =
  definePageLoader<QueryPageLayoutProps>({
  name: 'Query',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: normalizeQueryConfiguration(
      await context.config.load(QueryConfigurationDescriptor),
    ),
  }),
  fallback: () => ({ configuration: null }),
  });
