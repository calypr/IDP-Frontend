import { GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import type { DictionaryConfig } from '../../features/Dictionary/types';
import {
  KEY_FOR_SEARCH_HISTORY,
  MAX_SEARCH_HISTORY,
} from '../../features/Dictionary/constants';
import { DictionaryConfigurationSchema } from './configurationSchema';
import type { DictionaryPageProps } from './types';

const dictionaryConfiguration = {
  id: 'dictionary',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/dictionary.json`,
  schema: DictionaryConfigurationSchema,
};

export const DictionaryPageGetServerSideProps =
  definePageLoader<DictionaryPageProps>({
    name: 'DataDictionary',
    loadNavigation: loadNavigationFromContext,
    load: async (context) => ({
      configuration: (await context.config.load(dictionaryConfiguration)) as DictionaryConfig,
    }),
    fallback: () => ({
      configuration: {
        showGraph: false,
        showDownloads: false,
        historyStorageId: KEY_FOR_SEARCH_HISTORY,
        maxHistoryItems: MAX_SEARCH_HISTORY,
      },
    }),
  });
