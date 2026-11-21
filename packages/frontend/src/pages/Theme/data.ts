import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const ColorThemePageGetServerSideProps = definePageLoader<PageProps>({
  name: 'Theme',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
