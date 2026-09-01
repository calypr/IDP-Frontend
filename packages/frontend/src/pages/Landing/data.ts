import { definePageLoader, type ServerPageContext } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { LandingConfigurationSchema } from './configurationSchema';
import { SmmartConfigurationSchema } from '../Smmart/configurationSchema';
import type { LandingConfiguration, LandingPageProps } from './types';

const landingConfiguration = {
  id: 'landing-page',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/landingPage.json`,
  schema: LandingConfigurationSchema,
};

const smmartConfiguration = {
  id: 'smmart-landing-page',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/smmartLandingPage.json`,
  schema: SmmartConfigurationSchema,
};

const hasAuthenticatedSession = (context: ServerPageContext): boolean =>
  Boolean(context.headers.Authorization) ||
  /(?:^|;\s*)(?:access_token|credentials_token)=/i.test(
    context.headers.Cookie ?? '',
  );

const loadLandingNavigation = async (context: ServerPageContext) => {
  const navigation = await loadNavigationFromContext(context);
  if (hasAuthenticatedSession(context)) return navigation;

  return {
    ...navigation,
    headerProps: {
      ...navigation.headerProps,
      topBar: {
        ...navigation.headerProps.topBar,
        items: navigation.headerProps.topBar.items.filter(
          (item: { href: string }) => item.href !== '/git',
        ),
      },
    },
  };
};

/**
 * Fetches the necessary data for the landing page from content sources.
 * It handles potential file-not-found errors gracefully by returning null for missing configs.
 * @returns {Promise<{ props: { ... } }>} The props for the landing page component.
 */
export const LandingPageGetServerSideProps = definePageLoader<LandingPageProps>({
  name: 'Landing',
  loadNavigation: loadLandingNavigation,
  load: async (context) => ({
    configuration: ( {
      landing: await context.config.load(landingConfiguration),
      smmart: await context.config.optional(smmartConfiguration),
    } as unknown) as LandingConfiguration,
  }),
  fallback: () => ({ configuration: null }),
});
