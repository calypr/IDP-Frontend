import { NavPageLayoutProps } from '../../features/Navigation';

interface CalyprConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface CalyprProps {
  calyprConfig?: CalyprConfig;
  hasAuthenticatedSession?: boolean | null;
  loginError?: 'no_project_access' | 'access_check_unavailable';
}

export type CalyprLandingPageProps = NavPageLayoutProps & CalyprProps;
