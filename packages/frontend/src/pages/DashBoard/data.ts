import { GetServerSideProps } from 'next';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type DashBoardProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const DashBoardPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  try {
    const dashboardPageProps: DashBoardProps = await ContentSource.get(
      `config/${GEN3_COMMONS_NAME}/dashboardPage.json`,
    );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        dashboardConfig: dashboardPageProps,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        dashboardConfig: undefined,
      },
    };
  }
};
