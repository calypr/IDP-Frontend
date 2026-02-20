// src/pages/FileSummary/data.ts
import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import { microserviceDb } from '../../lib/content'; // ← NEW: direct microservice
import type { FileSummaryProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const FileSummaryPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  const summaryPageProps: FileSummaryProps =
    await microserviceDb.get<FileSummaryProps>('file_summary/1');

  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
      filesummaryConfig: summaryPageProps,
    },
  };
};
