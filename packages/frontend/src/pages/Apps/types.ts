import { NavPageLayoutProps } from '../../features/Navigation';

export type AppsPageProps = NavPageLayoutProps;

export interface AppCardProps {
  title: string;
  description: string;
  icon: string;
  href: string;
}
