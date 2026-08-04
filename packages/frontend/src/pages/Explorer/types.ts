import type { SharedFieldMapping } from '@gen3/core';
import type { PageProps } from '../../lib/pageLoader';
import type { CohortBuilderConfiguration } from '../../features/CohortBuilder';

export interface ExplorerPageData {
  configuration: CohortBuilderConfiguration | null;
  sharedFiltersMap: SharedFieldMapping | null;
}

export type ExplorerPageProps = PageProps<ExplorerPageData>;
