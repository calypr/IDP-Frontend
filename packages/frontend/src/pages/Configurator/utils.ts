// utils.ts
import {
  type Tab,
  type TableItem,
  type ChartItem,
  type FlexibleColumns,
} from './types';
import {
  type CohortPanelConfiguration,
  SummaryTableColumn,
} from '../../features/CohortBuilder';
import { type SummaryChart } from '../../components/charts';
import { type FacetDefinition } from '@gen3/core';

export const buildConfigFromTabs = (
  tabs: Tab[],
): CohortPanelConfiguration[] => {
  return tabs.map((tab) => {
    const columnOrder = ['col1', 'col2', 'col3', 'col4'] as const;
    const tableItems: TableItem[] = [];
    const filterItems: TableItem[] = [];
    const chartItems: ChartItem[] = [];

    tab.filterUnits.forEach((unit) => {
      const flatItems: (TableItem | ChartItem)[] = [];
      const maxLength = Math.max(
        ...Object.values(unit.columns).map((col) => col.length),
      );
      for (let i = 0; i < maxLength; i++) {
        columnOrder.forEach((colId) => {
          if (unit.columns[colId][i]) flatItems.push(unit.columns[colId][i]);
        });
      }
      if (unit.type === 'table') tableItems.push(...(flatItems as TableItem[]));
      else if (unit.type === 'filters')
        filterItems.push(...(flatItems as TableItem[]));
      else if (unit.type === 'charts')
        chartItems.push(...(flatItems as ChartItem[]));
    });

    return {
      tabTitle: tab.label,
      guppyConfig: {
        dataType: tab.tabType,
        nodeCountTitle: `${tab.tabType} Count`,
        fieldMapping: [],
      },
      charts: chartItems.reduce((acc: Record<string, SummaryChart>, item) => {
        acc[item.field] = { chartType: item.chartType, title: item.title };
        return acc;
      }, {}),
      filters: {
        tabs: [
          {
            title: 'Filters',
            fields: filterItems.map((item) => item.field),
            fieldsConfig: filterItems.reduce(
              (acc: Record<string, FacetDefinition>, item) => {
                acc[item.field] = {
                  field: item.field,
                  dataField: '',
                  index: '',
                  label: item.label,
                  type: 'enum',
                };
                return acc;
              },
              {},
            ),
          },
        ],
      },
      table: {
        enabled: true,
        fields: tableItems.map((item) => item.field),
        columns: tableItems.reduce(
          (acc: Record<string, SummaryTableColumn>, item) => {
            acc[item.field] = { field: item.field, title: item.label };
            return acc;
          },
          {},
        ),
      },
      dropdowns: {},
      buttons: [],
      loginForDownload: false,
    };
  });
};

export const transformConfigToTabs = (
  content: CohortPanelConfiguration[],
): Tab[] => {
  return content.map((tabConfig: CohortPanelConfiguration, index: number) => {
    const tableItems = Object.entries(tabConfig?.table?.columns || {}).map(
      ([field, col]) => ({
        id: Date.now() + Math.random(),
        field,
        label: col.title,
      }),
    );

    const filterItems =
      tabConfig.filters?.tabs?.[0]?.fields?.map(
        (field: string, idx: number) => ({
          id: Date.now() + Math.random() + idx,
          field,
          // Safely access fieldsConfig[field]?.label, default to field if any part is undefined
          label:
            tabConfig?.filters?.tabs?.[0]?.fieldsConfig?.[field]?.label ||
            field,
        }),
      ) || []; // Default to empty array if filters/tabs/fields is undefined

    const chartItems = Object.entries(tabConfig.charts || {}).map(
      ([field, chart]) => ({
        id: Date.now() + Math.random(),
        field,
        title: chart.title,
        chartType: chart.chartType,
      }),
    );

    const distributeItems = (items: TableItem[] | ChartItem[]) => {
      const columns: FlexibleColumns = {
        col1: [],
        col2: [],
        col3: [],
        col4: [],
      };
      items.forEach((item, i) => {
        const colKey = `col${(i % 4) + 1}` as keyof FlexibleColumns;
        columns[colKey].push(item);
      });
      return columns;
    };

    return {
      id: index + 1,
      label: tabConfig.tabTitle,
      tabType: tabConfig.guppyConfig.dataType,
      filterUnits: [
        {
          title: 'Table Column Names',
          type: 'table',
          columns: distributeItems(tableItems),
        },
        {
          title: 'Filters',
          type: 'filters',
          columns: distributeItems(filterItems ?? []),
        },
        {
          title: 'Charts',
          type: 'charts',
          columns: distributeItems(chartItems),
        },
      ],
    };
  });
};
