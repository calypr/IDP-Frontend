import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const AISearchPageGetServerSideProps = definePageLoader<PageProps>({
  name: 'AiSearch',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
