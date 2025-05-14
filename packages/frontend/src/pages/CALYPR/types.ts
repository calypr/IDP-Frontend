import { NavPageLayoutProps } from '../../features/Navigation';

interface CalyprConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface CalyprProps {
  calyprConfig?: CalyprConfig;
}

export type CalyprLandingPageProps = NavPageLayoutProps & CalyprProps;
