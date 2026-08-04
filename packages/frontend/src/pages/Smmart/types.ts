import { Gen3AppConfigData } from '../../lib/content/types';
import type { ConfigPageProps } from '../../lib/pageLoader';

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

export type SmmartLandingPageProps = ConfigPageProps<SmmartConfig>;
