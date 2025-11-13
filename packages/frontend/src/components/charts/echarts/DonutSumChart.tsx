import React, { useMemo } from 'react';
import { truncateString } from '../utils';
import ReactECharts, { ReactEChartsProps } from './ReactECharts';
import { HistogramDataArray, HistogramData } from '@gen3/core';
import { CustomChartProps } from '../types';
import { formatBytes } from '../../../utils/labels';

interface DonutChartData {
  value: number;
  name: string;
}

const processChartData = (
  facetData: HistogramDataArray,
  maxBins = 100,
): DonutChartData[] => {
  if (!facetData) {
    return [];
  }
  const data = facetData.filter((d: HistogramData) => d.key !== '_missing');

  const results = data.slice(0, maxBins).map((d: any) => ({
    value: d.sum, // Keep value as number
    name: truncateString(d.key, 35),
  }));

  return results;
};

const tooltipFormatter = (params: any) => {
  const humanReadableValue = formatBytes(params.value);
  return `${params.name}: ${humanReadableValue}`;
};

const DonutChart = ({ data, onClick }: CustomChartProps) => {
  const chartDefinition = useMemo((): ReactEChartsProps['option'] => {
    return {
      legend: {
        type: 'scroll',
        orient: 'vertical',
        align: 'right',
        right: 10,
        top: 20,
        bottom: 20,
      },
      tooltip: {
        trigger: 'item',
        formatter: tooltipFormatter,
      },
      series: [
        {
          type: 'pie',
          radius: ['30%', '60%'],
          data: processChartData(data),
          label: {
            show: false,
            position: 'center',
          },
          labelLine: {
            show: false,
          },
        },
      ],
    };
  }, [data]);

  const handleClick = (params: any) => {
    console.log('Clicked item:', params.name);
    if (onClick) {
      onClick(params.name);
    }
  };

  return (
    <div className="w-full h-64">
      <ReactECharts option={chartDefinition} onClick={handleClick} />
    </div>
  );
};

export default DonutChart;
