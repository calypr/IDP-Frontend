import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const DefaultGetServerSideProps = definePageLoader<PageProps>({
  name: 'DefaultPage',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
