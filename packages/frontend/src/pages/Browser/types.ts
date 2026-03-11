import { NavPageLayoutProps } from '../../features/Navigation';
import type { DirItem, ProjectItem } from '@gen3/core';

interface BrowserConfig {
  readonly example: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface BrowserProps {
  browserConfig?: BrowserConfig;
}

export type BrowserPageProps = NavPageLayoutProps &
  BrowserProps & { errorStatus?: number };

export type ColumnItem = DirItem | ProjectItem;
