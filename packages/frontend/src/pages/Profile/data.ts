import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { ProfileConfigurationSchema } from './configurationSchema';
import type { ProfileConfig } from '../../components/Profile';
import type { ConfigPageProps } from '../../lib/pageLoader';

export type ProfilePageProps = ConfigPageProps<ProfileConfig>;

export const ProfilePageGetServerSideProps = definePageLoader<ProfilePageProps>({
  name: 'Profile',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: await context.config.load({
      id: 'profile',
      source: 'content',
      resolvePath: () => `${GEN3_COMMONS_NAME}/profile.json`,
      schema: ProfileConfigurationSchema,
    }),
  }),
  fallback: () => ({ configuration: null }),
});
