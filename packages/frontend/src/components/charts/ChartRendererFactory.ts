import { RenderFactoryTypedInstance } from '../../utils/RendererFactory';
import { CustomChartProps } from './types';
import BarChart from './echarts/BarChart';
import PieChart from './echarts/PieChart';
import DonutChart from './echarts/DonutChart';
import HorizontalBarChart from './echarts/HorizontalBarChart';

const DefaultChartCatalog = {
  chart: {
    bar: BarChart,
    horizontalStacked: HorizontalBarChart,
    fullPie: PieChart,
    donut: DonutChart,
  },
};

let instance: RenderFactoryTypedInstance<CustomChartProps> | undefined =
  undefined;

const ChartRendererFactory =
  (): RenderFactoryTypedInstance<CustomChartProps> => {
    if (!instance) {
      instance = new RenderFactoryTypedInstance<CustomChartProps>();
      instance.registerRendererCatalog(DefaultChartCatalog);
    }
    return instance;
  };

export default ChartRendererFactory;
