import { NavPageLayoutProps } from '../../features/Navigation';
import type { DirItem, ProjectItem } from '@gen3/core';
import type { FileActionsConfig } from '../../features/CohortBuilder/types';

interface BrowserConfig {
  readonly example: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface BrowserProps {
  browserConfig?: BrowserConfig;
}

export type BrowserPageProps = NavPageLayoutProps &
  BrowserProps & { errorStatus?: number; fileActions?: FileActionsConfig };

export type ColumnItem = DirItem | ProjectItem;
export type { FileActionsConfig };
