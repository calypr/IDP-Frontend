import React from 'react';
import { useState } from 'react';
import {
  fieldNameToTitle,
  AggregationsData,
  HistogramDataArray,
} from '@gen3/core';
import { Icon } from '@iconify-icon/react';
import OverflowTooltippedLabel from '../OverflowTooltippedLabel';

import { useDisclosure } from '@mantine/hooks';
import {
  Center,
  Card,
  Grid,
  Group,
  Text,
  LoadingOverlay,
  Table,
  ColorSwatch,
  Modal,
  Switch,
  Button,
  useMantineTheme,
} from '@mantine/core';

import { createChart } from './createChart';
import { SummaryChart } from './types';

import { computeRowSpan } from './utils';
import ErrorCard from '../../components/MessageCards/ErrorCard';

const DEFAULT_COLS = 3;
const MAX_LEGEND_ROWS = 4;

interface ChartsProps {
  charts: Record<string, SummaryChart>;
  counts?: number;
  data: AggregationsData;
  isSuccess: boolean;
  isError?: boolean;
  numCols?: number;
  style?: 'tile' | 'box';
  showLegends?: boolean;
}
//Colors grabbed from echarts src/model/globalDefault.ts
const chartColors = [
  '#5470c6',
  '#91cc75',
  '#fac858',
  '#ee6666',
  '#73c0de',
  '#3ba272',
  '#fc8452',
  '#9a60b4',
  '#ea7ccc',
];

const LegendRows = ({ data }: { data: HistogramDataArray }) => {
  const moreThanMaxRows = data.length > MAX_LEGEND_ROWS;
  const limitedRows = moreThanMaxRows ? data.slice(0, MAX_LEGEND_ROWS) : data;

  return limitedRows.map((element, elIndex) => (
    <Table.Tr key={elIndex}>
      <Table.Td>
        <div className="flex flex-nowrap items-center overflow-hidden">
          <ColorSwatch
            className="inline-block mr-2 align-middle"
            size="1em"
            radius="xs"
            color={chartColors?.[elIndex % chartColors.length] || ''}
          />
          <OverflowTooltippedLabel label={element.key.toString()}>
            <span className="text-sm font-medium font-content">
              {element.key.toString()}
            </span>
          </OverflowTooltippedLabel>
        </div>
      </Table.Td>
      <Table.Td className="text-right">{element.count}</Table.Td>
    </Table.Tr>
  ));
};

const LegendOverflow = ({
  chart,
  data,
  chartTitle,
  counts,
}: {
  chart: SummaryChart;
  data: HistogramDataArray;
  chartTitle: string;
  counts: number;
}) => {
  const [openedMoreRows, { open: openMoreRows, close: closeMoreRows }] =
    useDisclosure(false);
  const theme = useMantineTheme();
  return (
    <React.Fragment>
      <Modal
        opened={openedMoreRows}
        onClose={closeMoreRows}
        title={chartTitle}
        size="xl"
      >
        <Grid>
          <Grid.Col span={6} key="modal-col-1">
            {createChart(chart.chartType, {
              data: data === undefined ? [] : data,
              total: counts ?? 1,
              valueType: chart.valueType ?? 'count',
              label: chart.label,
              showLegendInChart: chart.showLegendInChart,
            })}
          </Grid.Col>
          <Grid.Col span={6} key="modal-col-2">
            <div className="border-solid border-[1px] border-[var(--mantine-color-gray-3)] h-full p-1">
              <Table
                withRowBorders={false}
                classNames={{
                  table: 'w-full table-fixed',
                  td: 'p-1 leading-3',
                }}
              >
                <Table.Tbody>
                  {data.map((element, elIndex) => (
                    <Table.Tr key={elIndex}>
                      <Table.Td>
                        <div className="flex flex-nowrap items-center">
                          <ColorSwatch
                            className="inline-block mr-2 align-middle"
                            size="1em"
                            radius="xs"
                            color={
                              chartColors?.[elIndex % chartColors.length] || ''
                            }
                          />
                          <OverflowTooltippedLabel
                            label={element.key.toString()}
                          >
                            <span className="text-sm font-medium font-content">
                              {element.key.toString()}
                            </span>
                          </OverflowTooltippedLabel>
                        </div>
                      </Table.Td>
                      <Table.Td className="w-[10%] text-right">
                        {element.count}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Grid.Col>
        </Grid>
      </Modal>
      <Button
        variant="subtle"
        onClick={openMoreRows}
        leftSection={
          <Icon
            icon="gen3:open-in-modal"
            height={24}
            width={24}
            color={theme.colors.accent[5]}
          />
        }
        className="text-black hover:text-black"
      >
        {data.length - MAX_LEGEND_ROWS} more
      </Button>
    </React.Fragment>
  );
};

interface ChartItemProps {
  /** The key (field name) used to access data and chart config. */
  field: string;

  /** The specific chart configuration object for this field. */
  chartConfig: SummaryChart;

  /** The histogram data array specific to this field. */
  chartData: AggregationsData[string];

  /** The total record count (used for percentage calculations). */
  counts?: number;

  /** Indicates if data loading was successful. */
  isSuccess: boolean;

  /** The column span for the grid layout (e.g., 4 if numCols is 3). */
  colSpan: number;

  /** The styling mode for the card ('tile' or 'box'). */
  style?: 'tile' | 'box';

  /** Flag to determine if the legend should be displayed. */
  showLegends?: boolean;
}

const ChartItem = ({
  field,
  chartConfig,
  chartData,
  counts,
  isSuccess,
  colSpan,
  style,
  showLegends,
}: ChartItemProps) => {
  // You'll need to define ChartItemProps

  const [filterNoData, setFilterNoData] = useState(false);

  // All the logic from your original chartCard function goes here
  const chartTitle = chartConfig.title ?? fieldNameToTitle(field);
  const numberOfDataItems = chartData?.length ?? 0;
  const moreThanMaxRows = numberOfDataItems > MAX_LEGEND_ROWS;
  const hasNoData = chartData?.some((item) => item.key === 'no data');

  // ... rest of the render logic for the individual chart card (Card, Grid.Col, etc.)

  // Use the new, filtered data for createChart:
  const filteredData = chartData
    ? chartData.filter((value) =>
        filterNoData ? value.key !== 'no data' : true,
      )
    : [];

  return (
    <Grid.Col span={colSpan} key={`charts-${field}-col`}>
      <Card shadow="md" withBorder={style === 'box'} className="h-full">
        {/* ... Card.Section, LoadingOverlay, createChart, Legend, etc. */}
        {/* ... The Switch for filterNoData and its onChange prop ... */}
        {hasNoData && (
          <div className="flex justify-between align-middle px-4">
            <Text fw={500} className="mr-4">
              {filterNoData ? "Show 'no data'" : "Hide 'no data'"}
            </Text>
            <Switch
              // ... classNames ...
              onChange={() => setFilterNoData(!filterNoData)} // Correctly use the setter
              checked={filterNoData}
            />
          </div>
        )}
        {/* ... createChart using filteredData ... */}
        {createChart(chartConfig.chartType, {
          data: filteredData,
          total: counts ?? 1,
          // ... other props
        })}
      </Card>
    </Grid.Col>
  );
};

//The Charts component maps the data from ChartsProps into a grid of createChart() ReactNodes
const Charts = ({
  charts,
  data,
  counts,
  isSuccess,
  numCols = DEFAULT_COLS,
  style = 'tile',
  showLegends = false,
}: ChartsProps) => {
  const colSpan = 12 / numCols;

  return (
    <Grid className="w-full mx-2" gutter="md">
      {Object.entries(charts).map(([field, chartConfig], indexNum) => {
        // Skip if data is missing or empty for this field
        if (Object.keys(data).length === 0 || !(field in data)) {
          return null; // Or return the ErrorCard/loading state here
        }

        const chartData = data[field];

        return (
          <ChartItem
            key={field}
            field={field}
            chartConfig={chartConfig}
            chartData={chartData}
            counts={counts}
            isSuccess={isSuccess}
            colSpan={colSpan}
            style={style}
            showLegends={showLegends}
          />
        );
      })}
    </Grid>
  );
};

export default Charts;
