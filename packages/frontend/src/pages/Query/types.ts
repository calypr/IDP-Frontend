import { NavPageLayoutProps } from '../../features/Navigation';
import type { QueryConfiguration } from '../../features/Query/types';

export interface QueryPageLayoutProps extends NavPageLayoutProps {
  configuration: QueryConfiguration | null;
}

export type { QueryConfiguration } from '../../features/Query/types';
