import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { definePageLoader } from '../../../lib/pageLoader';
import { loadNavigationFromContext } from '../../../lib/common/staticProps';
import { convertUserYAMLToAuthz } from '../../../features/Authz';
import { AdminAuthzConfigurationSchema } from './configurationSchema';
import type { ConfigPageProps } from '../../../lib/pageLoader';
import type { Authz } from '../../../features/Authz';

type AdminAuthzPageProps = ConfigPageProps<Authz>;

export const AdminAuthZPageGetServerSideProps = definePageLoader<AdminAuthzPageProps>({
  name: 'AdminAuthz',
  loadNavigation: loadNavigationFromContext,
  load: async () => {
  const rootPath = `${GEN3_COMMONS_NAME}/`;
  const filepath = 'user.yaml';
  let data: Record<string, any> = {};

  try {
    const contents = fs.readFileSync(path.join(rootPath, filepath), 'utf8');
    data = await YAML.parse(contents);
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(error.message);
    }
    throw new Error(`Cannot process ${rootPath}${filepath}`);
  }
  const configuration = AdminAuthzConfigurationSchema.parse(data);
  return {
    configuration: convertUserYAMLToAuthz(
      configuration.fence?.USER_YAML as unknown as Parameters<
        typeof convertUserYAMLToAuthz
      >[0],
    ),
  };
  },
  fallback: () => ({ configuration: null }),
});
