// should move this thing into _app.tsx and make a dedicated layout component after https://github.com/vercel/next.js/discussions/10949 is addressed
import type { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';

export const NotebookLitePageGetServerSideProps: GetServerSideProps =
  async () => {
    const navPageLayoutProps = await getNavPageLayoutPropsFromConfig();
    return {
      props: {
        ...navPageLayoutProps,
      },
    };
  };
