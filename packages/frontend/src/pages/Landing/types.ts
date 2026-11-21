import type { ConfigPageProps } from '../../lib/pageLoader';
import type { LandingPageProps as LandingContentConfiguration } from '../../components/Content/LandingPageContent';
import type { ResourcePageConfig } from '../../components/Content/ResourcePageContent';
import type { SmmartConfig } from '../Smmart/types';

export interface LandingConfiguration {
  landing: LandingContentConfiguration;
  smmart: SmmartConfig | null;
}

export type LandingPageProps = ConfigPageProps<LandingConfiguration>;
export type ResourcePageProps = ConfigPageProps<ResourcePageConfig>;
