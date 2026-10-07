import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { FileSummaryConfigurationSchema } from './configurationSchema';
import type { FileSummaryPageProps, FilesummaryConfig } from './types';

const fileSummaryConfiguration = {
  id: 'file-summary',
  source: 'gecko' as const,
  resolvePath: () => 'file_summary/1',
  schema: FileSummaryConfigurationSchema,
};

export const FileSummaryPageGetServerSideProps =
  definePageLoader<FileSummaryPageProps>({
    name: 'FileSummary',
    loadNavigation: loadNavigationFromContext,
    load: async (context) => ({
      configuration: (await context.config.load(fileSummaryConfiguration)) as FilesummaryConfig,
    }),
    fallback: () => ({ configuration: null }),
  });
