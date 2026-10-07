import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { DataLibraryStoreMode, GEN3_COMMONS_NAME } from '@gen3/core';
import { DataLibraryConfig } from '../../features/DataLibrary';
import { DataLibraryConfigurationSchema } from './configurationSchema';
import type { DataLibraryPageProps } from './types';

const dataLibraryConfiguration = {
  id: 'data-library',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/dataLibrary.json`,
  schema: DataLibraryConfigurationSchema,
};

export const DataLibraryPageGetServerSideProps =
  definePageLoader<DataLibraryPageProps>({
    name: 'DataLibrary',
    loadNavigation: loadNavigationFromContext,
    load: async (context) => ({
      configuration: (await context.config.load(dataLibraryConfiguration)) as unknown as DataLibraryConfig,
    }),
    fallback: () => ({
      configuration: {
        storageMode: DataLibraryStoreMode.ApiOnly,
        actions: [],
      },
    }),
  });
