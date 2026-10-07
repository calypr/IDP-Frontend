import { GEN3_COMMONS_NAME } from '@gen3/core';
import {
  AnalysisCenterConfiguration,
  AnalysisCenterWithSectionsConfiguration,
} from '../../features/Analysis/types';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { AnalysisConfigurationSchema } from './configurationSchema';
import type { AnalysisPageProps } from './types';

const analysisConfiguration = {
  id: 'analysis-tools',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/analysisTools.json`,
  schema: AnalysisConfigurationSchema,
};

export const AnalysisPageGetServerSideProps = definePageLoader<AnalysisPageProps>({
  name: 'Analysis',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: (await context.config.load(analysisConfiguration)) as
      | AnalysisCenterConfiguration
      | AnalysisCenterWithSectionsConfiguration,
  }),
  fallback: () => ({ configuration: null }),
});
