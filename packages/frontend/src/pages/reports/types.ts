import { type NavPageLayoutProps } from '../../features/Navigation';
import { SummaryTable } from '../../features/CohortBuilder/ExplorerTable/types';
import { HistogramData } from '@gen3/core';

export interface ReportsConfiguration {
  tableConfig: SummaryTable;
  Title: string;
}

export interface ReportsPageProps extends NavPageLayoutProps {
  reportsConfig: ReportsConfiguration;
}

// a definition of the query response
export interface HistData {
  histogram: Array<HistogramData>; // Replace 'any' with a more specific type if known
  [key: string]: Record<string, any>; // Allow any other properties with string keys
}

export interface AggregationData {
  [key: string]: HistData; // Each key maps to HistogramData
}

export interface QueryResponse {
  data: {
    _aggregation: AggregationData; // Flexible keys mapping to histogram data
    [key: string]: Record<string, any>; // Allow other keys in 'data' with any type
  };
}
// self-defined for processed queries

export type ResourceDict = Record<string, any>;

export type QueryContent = Array<ResourceDict>;

export interface QueryHookResponse {
  data: QueryResponse | QueryContent | Record<string, QueryContent>;
  isLoading: boolean;
  isError: boolean;
}
