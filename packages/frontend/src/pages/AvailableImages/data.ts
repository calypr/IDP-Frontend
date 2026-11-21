import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const AvailableImagesPageGetServerSideProps = definePageLoader<PageProps>({
  name: 'AvailableImages',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
