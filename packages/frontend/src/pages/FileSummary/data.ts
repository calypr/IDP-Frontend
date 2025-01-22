import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { FileSummaryProps } from './types';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const FileSummaryPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (_context) => {
  try {
    const summaryPageProps: FileSummaryProps = await ContentSource.get(
      `config/${GEN3_COMMONS_NAME}/filesummary.json`,
    );
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        filesummaryConfig: summaryPageProps,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        filesummaryConfig: undefined,
      },
    };
  }
};
