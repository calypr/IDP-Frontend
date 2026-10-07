import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const AppsPageGetServerSideProps = definePageLoader<PageProps>({
  name: 'Apps',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
