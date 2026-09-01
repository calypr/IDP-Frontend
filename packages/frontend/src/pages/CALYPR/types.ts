import type { ConfigPageProps } from '../../lib/pageLoader';

interface CalyprConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface CalyprProps {
  calyprConfig?: CalyprConfig;
  hasAuthenticatedSession?: boolean | null;
}

export type CalyprLandingPageProps = ConfigPageProps<
  CalyprProps,
  { hasAuthenticatedSession: boolean | null }
>;
