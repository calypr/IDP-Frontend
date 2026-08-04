import type { ConfigPageProps } from '../../lib/pageLoader';
import {
  type AnalysisCenterConfiguration,
  type AnalysisCenterWithSectionsConfiguration,
} from '../../features/Analysis/types';

export type AnalysisConfiguration =
  | AnalysisCenterConfiguration
  | AnalysisCenterWithSectionsConfiguration;

export type AnalysisPageProps = ConfigPageProps<AnalysisConfiguration>;
export type AnalysisPageLayoutProps = AnalysisPageProps;
