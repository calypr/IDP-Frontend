import { NavPageLayoutProps } from '../../features/Navigation';

interface DashBoardConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface DashBoardProps {
  dashboardConfig?: DashBoardConfig;
}

export type DashBoardPageProps = NavPageLayoutProps & DashBoardProps;
