import { NavPageLayoutProps } from '../../features/Navigation';
import { SummaryTableColumn } from '../../features/CohortBuilder/ExplorerTable/types';

export interface FileSummaryProps {
  filesummaryConfig?: FilesummaryConfig;
}

export interface FilesummaryConfig {
  barChartColor?: string;
  binslicePoints?: number[];
  config?: Record<string, SummaryTableColumn>;
  defaultPath?: string;
  defaultProject?: string;
  idField?: string;
  index?: string;
  maxTraversalPages?: number;
}

export type FileSummaryPageProps = NavPageLayoutProps & FileSummaryProps;
