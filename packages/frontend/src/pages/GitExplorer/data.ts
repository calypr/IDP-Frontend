import { definePageLoader } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';
import type { GitExplorerPageProps } from './types';

export const GitExplorerPageGetServerSideProps = definePageLoader<GitExplorerPageProps>({
  name: 'GitExplorer',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
