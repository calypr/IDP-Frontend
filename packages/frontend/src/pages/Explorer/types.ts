import type { ExplorerRuntimeV1, SharedFieldMapping } from '@gen3/core';
import type { PageProps } from '../../lib/pageLoader';

export interface ExplorerPageData {
  runtime: ExplorerRuntimeV1 | null;
  project?: string;
  sharedFiltersMap: SharedFieldMapping | null;
}

export type ExplorerPageProps = PageProps<ExplorerPageData>;
