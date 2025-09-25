import { NavPageLayoutProps } from '../../features/Navigation';
import { SummaryTableColumn } from '../../features/CohortBuilder/ExplorerTable/types';

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
  EQ: { project_id: string };
}

export interface ContentTypeFilter {
  EQ: { document_reference_contentType: string };
}

export interface RangeFilter {
  AND: [
    { GTE: { document_reference_size: number } },
    { LT: { document_reference_size: number } },
  ];
}

export type Filter = ProjectFilter | ContentTypeFilter | RangeFilter;

export type FileSummaryPageProps = NavPageLayoutProps & FileSummaryProps;
