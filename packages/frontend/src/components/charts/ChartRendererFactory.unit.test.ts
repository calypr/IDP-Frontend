import ChartRendererFactory from './ChartRendererFactory';

describe('ChartRendererFactory', () => {
  it('registers the pie chart type emitted by Explorer Builder v2', () => {
    expect(ChartRendererFactory().rendererExists('chart', 'pie')).toBe(true);
  });
});
