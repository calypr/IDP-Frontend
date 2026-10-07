import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { LoginConfig } from '../../components/Login';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { LoginConfigurationSchema } from './configurationSchema';
import type { LoginPageLayoutProps } from './types';

const loginConfiguration = {
  id: 'login',
  source: 'content' as const,
  resolvePath: () => `${GEN3_COMMONS_NAME}/login.json`,
  schema: LoginConfigurationSchema,
};

export const LoginPageGetServerSideProps = definePageLoader<LoginPageLayoutProps>({
  name: 'Login',
  loadNavigation: loadNavigationFromContext,
  load: async (context) => ({
    configuration: (await context.config.load(loginConfiguration)) as LoginConfig,
  }),
  fallback: () => ({ configuration: null }),
});
