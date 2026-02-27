import { NavPageLayoutProps } from '../../features/Navigation';
import type { DirItem, ProjectItem } from '@gen3/core';

interface MillerConfig {
  readonly example: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface MillerProps {
  millerConfig?: MillerConfig;
}

export type MillerPageProps = NavPageLayoutProps &
  MillerProps & { errorStatus?: number };

export type ColumnItem = DirItem | ProjectItem;
