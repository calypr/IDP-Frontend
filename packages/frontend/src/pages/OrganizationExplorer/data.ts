import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import type { OrganizationExplorerPageProps } from './types';

export const OrganizationExplorerPageGetServerSideProps = definePageLoader<
  OrganizationExplorerPageProps
>({
  name: 'OrganizationExplorer',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({
  }),
});
