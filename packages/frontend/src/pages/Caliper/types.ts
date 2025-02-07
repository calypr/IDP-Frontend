import { NavPageLayoutProps } from '../../features/Navigation';

interface CaliperConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface CaliperProps {
  caliperConfig?: CaliperConfig;
}

export type CaliperLandingPageProps = NavPageLayoutProps & CaliperProps;
