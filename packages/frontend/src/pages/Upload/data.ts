import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import { NavPageLayoutProps } from '../../features/Navigation';

export const UploadPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => ({
  props: {
    ...(await getNavPageLayoutPropsFromConfig()),
  },
});
