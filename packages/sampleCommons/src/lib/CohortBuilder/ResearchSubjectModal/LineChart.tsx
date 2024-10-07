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
  const data = lineChartData
    .filter(
      (obj) =>
        'specimen_indexed_collection_date_days' in obj &&
        'experimental_strategy' in obj,
    )
    .map(
      ({ specimen_indexed_collection_date_days, experimental_strategy }) => ({
        y: experimental_strategy,
        x: specimen_indexed_collection_date_days,
      }),
    );

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
              angle: data?.length > 10 ? 45 : 0,
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
          data={data}
          style={{
            data: { stroke: '#57af48', strokeWidth: 2 },
          }}
          name={'series-1'}
        />
        <VictoryScatter
          style={{ data: { fill: '#5797c4' } }}
          size={4}
          data={data}
        />
      </VictoryChart>
    </div>
  );
};
