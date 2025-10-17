import { NavPageLayoutProps } from '../../features/Navigation';
import { GraphQLSchema } from 'graphql';

/* boiler plate */
interface ConfiguratorConfig {
  readonly textBoxes: ReadonlyArray<{
    readonly box: string;
  }>;
}

export interface ConfiguratorProps {
  configuratorConfig?: ConfiguratorConfig;
}

export type ConfiguratorPageProps = NavPageLayoutProps & ConfiguratorProps;

/* Configurator Types */
export type TableItem = {
  id: number;
  field: string;
  label: string;
};

export type ChartItem = {
  id: number;
  field: string;
  title?: string;
  chartType: string;
};

export interface ApiResponse {
  success: boolean;
  error?: string;
}

export type ColumnProps<T extends 'table' | 'filters' | 'charts'> = {
  columnId: string;
  items: (TableItem | ChartItem)[];
  removeData: (tabId: string | number, entryId: number) => void;
  tabId: string | number;
  type: T;
};

export type FlexibleColumns = {
  col1: (ChartItem | TableItem)[];
  col2: (ChartItem | TableItem)[];
  col3: (ChartItem | TableItem)[];
  col4: (ChartItem | TableItem)[];
};

export type ColumnKey = 'col1' | 'col2' | 'col3' | 'col4';

export type FilterUnitProps<T extends 'table' | 'filters' | 'charts'> = {
  tabId: string | number;
  columns: FlexibleColumns;
  setColumns: (newColumns: FlexibleColumns) => void;
  index: number;
  type: T;
  schema: GraphQLSchema;
  tabType: string;
  title: string;
};

export type FilterUnitType<T extends 'table' | 'filters' | 'charts'> = {
  type: T;
  columns: FlexibleColumns;
  title: string;
};

export type Tab = {
  id: string | number;
  label: string;
  tabType: string;
  filterUnits: FilterUnitType<'table' | 'filters' | 'charts'>[];
};
