import React from 'react';
import { RenderFactoryTypedInstance, RendererFunction } from '../../../utils/RendererFactory';
import BarComparison from './BarComparison';
import { ComparisonChartProps } from './types';
import RadarComparison from './RadarComparison';

let instance: RenderFactoryTypedInstance<ComparisonChartProps> | undefined =
  undefined;

export const DefaultComparisonChart = () => {
  return <div>Chart not configured</div>;
};

const DefaultRendererCatalog = {
  comparison: {
    default: DefaultComparisonChart as RendererFunction<ComparisonChartProps>,
    barComparison: BarComparison as RendererFunction<ComparisonChartProps>,
    radarComparison: RadarComparison as RendererFunction<ComparisonChartProps>,
  },
};

const CohortSimilarityChartsFactory =
  (): RenderFactoryTypedInstance<ComparisonChartProps> => {
    if (!instance) {
      instance = new RenderFactoryTypedInstance<ComparisonChartProps>();
      instance.registerRendererCatalog(DefaultRendererCatalog);
    }
    return instance;
  };

export default CohortSimilarityChartsFactory;
