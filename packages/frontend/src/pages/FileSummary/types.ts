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

export interface ProjectFilter {
  type: 'project';
  EQ: { project_id: string };
}

export interface ContentTypeFilter {
  type: 'content';
  EQ: { contentType: string };
}

export interface RangeFilter {
  type: 'range';
  AND: [{ GTE: { size: number } }, { LT: { size: number } }]; // Tuple
}

export type Filter = ProjectFilter | ContentTypeFilter | RangeFilter;

export type FileSummaryPageProps = NavPageLayoutProps & FileSummaryProps;
