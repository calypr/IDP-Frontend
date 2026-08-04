import { GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { CrosswalkConfigurationSchema } from './configurationSchema';
import {
  type CrosswalkConfig,
  type CrosswalkName,
} from '../../features/Crosswalk';
import type { CrosswalkPageProps } from './types';

interface InitialCrosswalkInfo extends CrosswalkName {
  dataPath: string;
}

export interface InitialCrosswalkConfig extends Omit<
  CrosswalkConfig,
  'mapping'
> {
  mapping: {
    source: CrosswalkName;
    external: Array<InitialCrosswalkInfo>;
  };
}

const crosswalkConfiguration = {
  id: 'crosswalk',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/crosswalk.json`,
  schema: CrosswalkConfigurationSchema,
};

export const CrosswalkPageGetServerSideProps = definePageLoader<CrosswalkPageProps>({
  name: 'Crosswalk',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => {
    const initialConfig = (await context.config.load(crosswalkConfiguration)) as InitialCrosswalkConfig;
    const regex = /->/g;
    const processedConfig = {
      showSubmittedIdInTable: initialConfig.showSubmittedIdInTable,
      idEntryPlaceholderText:
        initialConfig?.idEntryPlaceholderText ||
        'Enter IDs, one per line.\nExample:\nD334343\nC343433',
      mapping: {
        source: initialConfig.mapping.source,
        external: initialConfig.mapping.external.map((entry) => ({
          ...entry,
          dataPath: entry.dataPath
            .split(regex)
            .map((x) => JSON.stringify([x]))
            .join('.'), // To Support JSONPath when a key is a URL
        })),
      },
    };

    return { configuration: processedConfig as unknown as CrosswalkConfig };
  },
  fallback: () => ({ configuration: null }),
});
