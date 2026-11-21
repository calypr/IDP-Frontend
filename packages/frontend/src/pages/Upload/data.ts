import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const UploadPageGetServerSideProps = definePageLoader<PageProps>({
  name: 'Upload',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
