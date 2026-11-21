// should move this thing into _app.tsx and make a dedicated layout component after https://github.com/vercel/next.js/discussions/10949 is addressed
import { definePageLoader, type PageProps } from '../../lib/pageLoader';
import { loadNavigationFromContext } from '../../lib/common/staticProps';

export const NotebookLitePageGetServerSideProps = definePageLoader<PageProps>({
  name: 'NotebookLite',
  loadNavigation: loadNavigationFromContext,
  load: async () => ({}),
});
