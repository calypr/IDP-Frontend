import { NavPageLayoutProps } from '../../features/Navigation';
import { Gen3AppConfigData } from '../../lib/content/types';

export interface SmmartConfig extends Gen3AppConfigData {
  readonly topText: ReadonlyArray<{
    readonly box: string;
  }>;
  readonly smmartCards: ReadonlyArray<{
    readonly title: string;
    readonly description: string;
    readonly icon: string;
    readonly href: string;
  }>;
}

export interface SmmartProps {
  smmartConfig?: SmmartConfig;
}

export type SmmartLandingPageProps = NavPageLayoutProps & SmmartProps;
