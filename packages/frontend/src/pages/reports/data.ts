import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type ReportsPageProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const ReportsPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const reportsConfig: ReportsPageProps =
    await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/reportsPage.json`,
    );
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      reportsConfig: reportsConfig ? reportsConfig : null,
    },
  };
};
