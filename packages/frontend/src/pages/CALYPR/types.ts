import { NavPageLayoutProps } from '../../features/Navigation';

interface CalyprConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface CalyprProps {
  calyprConfig?: CalyprConfig;
  hasAuthenticatedSession?: boolean | null;
}

export type CalyprLandingPageProps = NavPageLayoutProps & CalyprProps;
