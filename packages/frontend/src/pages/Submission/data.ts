import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { SubmissionConfig } from '../../features/Submission/types';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { SubmissionsPageLayoutProps } from './types';
import { SubmissionConfigurationSchema } from './configurationSchema';

export const SubmissionPageGetServerSideProps = definePageLoader<SubmissionsPageLayoutProps>({
  name: 'Submission',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: await context.config.load({
      id: 'submission',
      source: 'content',
      resolvePath: () => `${GEN3_COMMONS_NAME}/submission.json`,
      schema: SubmissionConfigurationSchema,
    }) as SubmissionConfig,
  }),
  fallback: () => ({ configuration: null }),
});
