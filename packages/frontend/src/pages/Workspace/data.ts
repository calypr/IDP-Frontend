import { definePageLoader, type ConfigDescriptor } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import type { WorkspaceConfig } from '../../features/Workspace';
import { WorkspaceConfigurationSchema } from './configurationSchema';
import type { WorkspacePageProps } from './types';

const workspaceConfiguration: ConfigDescriptor<WorkspaceConfig> = {
  id: 'workspace',
  source: 'content',
  resolvePath: () => `${GEN3_COMMONS_NAME}/workspace.json`,
  schema:
    WorkspaceConfigurationSchema as unknown as ConfigDescriptor<WorkspaceConfig>['schema'],
};

export const WorkspacePageGetServerSideProps =
  definePageLoader<WorkspacePageProps>({
    name: 'Workspace',
    loadNavigation: loadNavigationFromContext,
    load: async (context) => ({
      configuration: await context.config.load(workspaceConfiguration),
    }),
    fallback: () => ({ configuration: null }),
  });

export const WorkspaceNoAccessPageServerSideProps = definePageLoader({
  name: 'WorkspaceNoAccess',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
