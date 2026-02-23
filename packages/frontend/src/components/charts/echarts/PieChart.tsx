import React, { useMemo } from 'react';
import { HistogramDataArray, HistogramData } from '@gen3/core';
import { processLabel, truncateString } from '../utils';
import ReactECharts, { ReactEChartsProps } from './ReactECharts';
import { CustomChartProps } from '../types';

interface PieChartData {
  value: number;
  name: string;
}

const processChartData = (
  facetData: HistogramDataArray,
  maxBins = 100,
): PieChartData[] => {
  if (!facetData) {
    return [];
  }

  const data = facetData.filter((d: HistogramData) => d.key !== '_missing');

  const results = data.slice(0, maxBins).map((d: HistogramData) => ({
    value: d.count,
    name: truncateString(processLabel(d.key as string), 35),
  }));
  return results;
};

const PieChart = ({ data, label }: CustomChartProps) => {
  const chartDefinition = useMemo((): ReactEChartsProps['option'] => {
    return {
      emphasis: {
        label: {
          show: true,
          fontSize: '14',
        },
      },
      tooltip: {
        trigger: 'item',
      },
      series: [
        {
          type: 'pie',
          radius: '60%',
          data: processChartData(data),
          label: {
            show: label?.show !== undefined ? label.show : true,
            fontSize: '14',
            fontWeight: 'bold',
            overflow: 'break',
          },
        },
      ],
    };
  }, [data]);

  return (
    <div className="w-full h-64">
      <ReactECharts option={chartDefinition} />
    </div>
  );
};

export default PieChart;
