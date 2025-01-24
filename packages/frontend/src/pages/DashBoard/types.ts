import { NavPageLayoutProps } from '../../features/Navigation';

interface DashBoardConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface DashBoardProps {
  dashboardProps?: DashBoardConfig;
}

export type DashBoardPageProps = NavPageLayoutProps & DashBoardProps;
