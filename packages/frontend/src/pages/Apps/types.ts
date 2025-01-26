import { NavPageLayoutProps } from '../../features/Navigation';

export interface AppsConfig {
  readonly appCards: ReadonlyArray<{
    readonly title: string;
    readonly description: string;
    readonly icon: string;
    readonly href: string;
  }>;
}

export type AppCardProps = AppsConfig['appCards'][number];

export interface AppsProps {
  appsConfig?: AppsConfig;
}

export type AppsPageProps = NavPageLayoutProps & AppsProps;
