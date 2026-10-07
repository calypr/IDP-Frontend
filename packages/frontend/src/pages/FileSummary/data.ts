// src/pages/FileSummary/data.ts
import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import { microserviceDb } from '../../lib/content'; // ← NEW: direct microservice
import type { FileSummaryProps } from './types';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const FileSummaryPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (context) => {
  const requestHeaders: Record<string, string> = {};
  if (context.req.headers.cookie) {
    requestHeaders['Cookie'] = context.req.headers.cookie;
  }
  if (context.req.headers.host) {
    requestHeaders['Host'] = context.req.headers.host;
  }

  const [summaryPageProps, navPageLayoutProps] = await Promise.all([
    microserviceDb.get<FileSummaryProps>('file_summary/1', requestHeaders),
    getNavPageLayoutPropsFromConfig(requestHeaders),
  ]);

  return {
    props: {
      ...navPageLayoutProps,
      filesummaryConfig: summaryPageProps,
    },
  };
};
