import {
  VictoryLine,
  VictoryChart,
  VictoryTheme,
  VictoryAxis,
  VictoryLabel,
  VictoryScatter,
} from 'victory';

export const VicLineChart = ({
  lineChartData,
}: {
  lineChartData: Array<Record<string, any>>;
}) => {
  return (
    <div style={{ height: '70vh', width: '100%' }}>
      <VictoryChart
        theme={VictoryTheme.material}
        animate={{ duration: 1 }}
        title="Assays over time"
      >
        <VictoryAxis
          offsetY={45}
          tickLabelComponent={
            <VictoryLabel
              textAnchor={'middle'}
              style={[
                {
                  fontSize: 10,
                  fontFamily: 'Noto Sans, sans-serif',
                },
              ]}
            />
          }
          style={{
            grid: { stroke: 'none' },
            tickLabels: {
              fontSize: 18,
              angle: lineChartData?.length > 10 ? 45 : 0,
              padding: 10,
            },
          }}
        />

        <VictoryAxis
          dependentAxis
          offsetX={45}
          tickLabelComponent={
            <VictoryLabel
              style={[{ fontSize: 12, fontFamily: 'Noto Sans, sans-serif' }]}
            />
          }
          style={{
            grid: { stroke: 'none' },
            axisLabel: { padding: 30, fontSize: 20, fontWeight: 'bold' },
            tickLabels: { fontSize: 18 },
          }}
          tickCount={3}
          crossAxis={false}
        />

        <VictoryLine
          data={lineChartData}
          style={{
            data: { stroke: '#57af48', strokeWidth: 2 },
          }}
          name={'series-1'}
        />
        <VictoryScatter
          style={{ data: { fill: '#5797c4' } }}
          size={4}
          data={lineChartData}
        />
      </VictoryChart>
    </div>
  );
};
