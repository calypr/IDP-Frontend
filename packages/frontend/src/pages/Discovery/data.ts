import { DataLibraryStoreMode, GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { type DiscoveryConfig } from '../../features/Discovery';
import { DataLibraryConfig } from '../../features/DataLibrary';
import { DiscoveryConfigurationSchema } from './configurationSchema';
import { DataLibraryConfigurationSchema } from '../DataLibrary/configurationSchema';
import type { DiscoveryPageProps } from './types';

const discoveryConfiguration = {
  id: 'discovery',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/discovery.json`,
  schema: DiscoveryConfigurationSchema,
};

const dataLibraryConfiguration = {
  id: 'discovery-data-library',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/dataLibrary.json`,
  schema: DataLibraryConfigurationSchema,
};

export const DiscoveryPageGetServerSideProps =
  definePageLoader<DiscoveryPageProps>({
    name: 'Discovery',
    loadNavigation: loadNavigationFromContext,
    load: async (context) => {
      const discoveryConfig = (await context.config.load(discoveryConfiguration)) as unknown as DiscoveryConfig;
      const dataLibraryConfig = (await context.config.load(dataLibraryConfiguration)) as unknown as DataLibraryConfig;

      discoveryConfig.metadataConfig?.forEach((index) => {
        if (index.features.exportFromDiscovery) {
          index.features.exportFromDiscovery.dataLibraryStoreMode =
            dataLibraryConfig.storageMode ?? DataLibraryStoreMode.ApiOnly;
        }
      });

      return { configuration: discoveryConfig };
    },
    fallback: () => ({ configuration: null }),
  });
