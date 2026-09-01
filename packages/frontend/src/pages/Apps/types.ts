import type { PageProps } from '../../lib/pageLoader';

export type AppsPageProps = PageProps;

export interface AppCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
}
