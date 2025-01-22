import { NavPageLayoutProps } from '../../features/Navigation';
import { SummaryTableColumn } from '../../features/CohortBuilder/ExplorerTable';

export interface FileSummaryProps {
  filesummaryConfig?: FilesummaryConfig;
}

export interface FilesummaryConfig {
  config: Record<string, SummaryTableColumn>;
  barChartColor: string;
  defaultProject: string;
  binslicePoints: number[];
  idField: string;
  index: string;
}

export type FileSummaryPageProps = NavPageLayoutProps & FileSummaryProps;
