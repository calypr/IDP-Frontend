import { fieldNameToTitle, AggregationsData } from '@gen3/core';
import { useState } from 'react';
//import { MdClose as CloseIcon } from 'react-icons/md';
//import { useDeepCompareMemo } from 'use-deep-compare';

import {
  // ActionIcon,
  Card,
  Grid,
  Text,
  LoadingOverlay,
  Switch,
} from '@mantine/core';
import { createChart } from './createChart';
import { SummaryChart } from './types';

import { computeRowSpan } from './utils';

const DEFAULT_COLS = 3;

export type ChartDataConverter = (
  data: Record<string, number>,
) => Record<string, number>;

interface ChartsProps {
  index: string;
  charts: Record<string, SummaryChart>;
  counts?: number;
  data: AggregationsData;
  isSuccess: boolean;
  isError?: boolean;
  numCols?: number;
}

//The Charts component maps the data from ChartsProps into a grid of createChart() ReactNodes
const Charts = ({
  index,
  charts,
  data,
  counts,
  isSuccess,
  numCols = DEFAULT_COLS,
}: ChartsProps) => {
  const spans = computeRowSpan(charts, numCols);
  const [filterNoData, setFilterNoData] = useState(false); // Toggle state

  return (
    <Grid className="w-full mx-2">
      {data &&
        Object.keys(charts).map((field, index) => (
          <Grid.Col span={spans[index]} key={`${index}-charts-${field}-col`}>
            <Card shadow={'md'}>
              <Card.Section inheritPadding py="xs">
                <div className="flex justify-between align-middle">
                  <Text fw={900}>
                    {charts[field].title ?? fieldNameToTitle(field)}
                  </Text>
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

                  {/* // TODO: handle close/hide chart
                  <ActionIcon>
                    <CloseIcon size="1rem" />
                  </ActionIcon>
                   */}
                </div>
              </Card.Section>
              <LoadingOverlay visible={!isSuccess} />
              {createChart(charts[field].chartType, {
                data:
                  data && data[field]
                    ? Object.entries(data[field])
                        .filter(([key, value]) => {
                          return filterNoData ? value.key !== 'no data' : true;
                        })
                        .map(([key, value]) => ({ ...value }))
                    : [],
                total: counts ?? 1,
                valueType: charts[field].valueType ?? 'count',
              })}
            </Card>
          </Grid.Col>
        ))}
    </Grid>
  );
};

export default Charts;
