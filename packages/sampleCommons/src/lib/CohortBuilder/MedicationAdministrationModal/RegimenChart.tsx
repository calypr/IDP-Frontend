import React from 'react';
import dynamic from 'next/dynamic';
const Plotly = dynamic(() => import('react-plotly.js'), { ssr: false });
export const RegimenChart = ({
  data,
  identifier,
}: {
  data: any;
  identifier: string;
}) => {
  const transformedData = data.map((item: any, index: number) => ({
    x: [item.Index_Date_Start_Days, item.Index_Date_End_Days],
    y: [index + 1, index + 1],
    mode: 'lines',
    name: item.Medication,
    line: { color: 'red', width: 4 },
  }));
  console.log('TRANS DATA: ', transformedData);

  const layout: Partial<Plotly.Layout> = {
    title: `Drug Usage Timeline for Patient ${identifier}`,
    showlegend: false,
    xaxis: {
      title: { text: 'Days old', font: { size: 16 } },
      tickmode: 'array',
      automargin: true,
      showgrid: true,
    },
    yaxis: {
      title: { text: 'Drug Regimen', standoff: 20 },
      tickmode: 'array',
      automargin: true,
      tickvals: Array.from({ length: data.length }, (_, index) => index + 1),
      ticktext: transformedData.map((item: any) => item.name),
    },
  };

  return (
    <Plotly
      data={transformedData}
      layout={layout}
      className="w-[800px] h-full m-2"
    />
  );
};
