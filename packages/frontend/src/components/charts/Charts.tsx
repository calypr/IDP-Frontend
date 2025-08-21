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
  // Determine the span based on the number of columns.
  // Mantine's Grid is 12 columns, so 12 / numCols will give equal width.
  const colSpan = 12 / numCols;

  const chartCard = (field: string, indexNum: number) => {
    if (Object.keys(data).length === 0) return null;

    if (Object.keys(data).length > 0 && !(field in data)) {
      return (
        <Grid.Col span={colSpan} key={`${indexNum}-charts-${field}-col`}>
          <ErrorCard message={`${field} not found in data`} />
        </Grid.Col>
      );
    }

    const dataKeys =
      field in data && data?.[field].length > 0
        ? Object.keys(data[field][0])
        : [];

    const chartTitle = charts[field].title ?? fieldNameToTitle(field);

    const numberOfDataItems = data?.[field] && data[field].length;
    const moreThanMaxRows = numberOfDataItems > MAX_LEGEND_ROWS;
    const [filterNoData, setFilterNoData] = useState(false); // Toggle state
    const hasNoData = data?.[field]?.some((item) => item.key === 'no data');

    return (
      <Grid.Col span={colSpan} key={`${indexNum}-charts-${field}-col`}>
        <Card shadow="md" withBorder={style === 'box'} className="h-full">
          <Card.Section inheritPadding py="xs" withBorder={style === 'box'}>
            <div className="flex justify-between align-middle">
              <Text fw={900}>
                {charts[field].title ?? fieldNameToTitle(field)}
              </Text>
              {hasNoData && (
                <div className="flex justify-between align-middle px-4">
                  <Text fw={500} className="mr-4">
                    {filterNoData ? "Show 'no data'" : "Hide 'no data'"}
                  </Text>
                  <Switch
                    classNames={{
                      track: `border border-black rounded-full h-8 w-12 ${filterNoData ? 'bg-secondary' : 'bg-white'}`,
                      thumb: `transform h-6 w-6 bg-black border-black ${filterNoData ? '-translate-x-[50%]' : 'translate-x-[0%]'}`,
                      label: 'font-content text-black',
                    }}
                    onChange={() => setFilterNoData(!filterNoData)}
                    checked={filterNoData}
                  />
                </div>
              )}
            </div>
          </Card.Section>
          <LoadingOverlay visible={!isSuccess} />
          {createChart(charts[field].chartType, {
            data:
              data && data[field]
                ? Object.entries(data[field])
                    .filter(([_, value]) => {
                      return filterNoData ? value.key !== 'no data' : true;
                    })
                    .map(([_, value]) => ({ ...value }))
                : [],
            total: counts ?? 1,
            valueType: charts[field].valueType ?? 'count',
            label: charts[field].label,
            showLegendInChart: charts[field].showLegendInChart,
          })}
          {numberOfDataItems > 0 && showLegends && (
            <Card.Section inheritPadding py="xs" withBorder={style === 'box'}>
              <div className="w-full">
                <Table
                  withRowBorders={false}
                  classNames={{
                    table: 'w-full table-fixed',
                    td: 'p-1 leading-3',
                    th: 'p-1 leading-3 [text-shadow:_1px_0_#000]',
                    thead: 'border-b',
                    tbody: "before:content-[''] before:block before:p-1",
                  }}
                >
                  <Table.Thead>
                    <Table.Tr>
                      {dataKeys.map((el, i) => (
                        <Table.Th key={i}>
                          {charts[field]?.dataLabels?.[el] || (
                            <React.Fragment>&nbsp;</React.Fragment>
                          )}
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {data === undefined ? (
                      ''
                    ) : (
                      <LegendRows data={data[field]} />
                    )}
                  </Table.Tbody>
                </Table>
              </div>
            </Card.Section>
          )}
          {showLegends && moreThanMaxRows && (
            <Card.Section
              inheritPadding
              withBorder={style === 'box'}
              className="text-right p-1"
            >
              <LegendOverflow
                chart={charts[field]}
                data={data[field]}
                chartTitle={chartTitle}
                counts={counts ?? 0}
              />
            </Card.Section>
          )}
        </Card>
      </Grid.Col>
    );
  };

  return (
    <Grid className="w-full mx-2" gutter="md">
      {data && Object.keys(charts)?.map(chartCard)}
    </Grid>
  );
};

export default Charts;
