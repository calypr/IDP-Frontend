import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });
import { Text, LoadingOverlay } from '@mantine/core';
import {
  NavPageLayout,
  NavPageLayoutProps,
  getNavPageLayoutPropsFromConfig,
} from '@gen3/frontend';
import { useGeneralGQLQuery } from '@gen3/core';
import { GetServerSideProps } from 'next';
import {
  isQueryResponse,
  extractData,
} from '../lib/CohortBuilder/ResearchSubjectModal/tools';

const Heatmap = ({ data, copyNumberData }) => {
  console.log('copyNumberData', copyNumberData);
  console.log('DATA', data);

  const totalData = data.concat(copyNumberData);
  const geneDict = [...new Set(totalData.map((x) => x.gene))]
    .reverse()
    .reduce((acc, gene, index) => {
      acc[gene] = index;
      return acc;
    }, {});

  // Initialize a 2D array (genes x samples) with zeros
  const array = Array(Object.keys(geneDict).length)
    .fill()
    .map(() => Array(data.length).fill(0));

  // Fill the array with 1s based on the data mapping
  for (const [index, value] of data.entries()) {
    array[geneDict[value.gene]][index] = 1;
  }

  const xArr = Array(copyNumberData.length).fill(0);
  const yArr = Array(copyNumberData.length).fill(0);
  for (const [index, value] of copyNumberData.entries()) {
    if (geneDict[value.gene] !== undefined) {
      yArr[index] = geneDict[value.gene]; // Gene index for the y-axis
      xArr[index] = index; // Use the index for the x-axis (or modify as needed)
    }
  }

  const colorscale = [
    [0, 'rgb(255, 255, 255)'], // Color for 0s
    [1, 'rgb(50, 205, 50)'], // Color for 1s
  ];

  return (
    <div>
      <Plot
        data={[
          {
            z: array,
            type: 'heatmap',
            colorscale: colorscale,
            zmin: 0,
            zmax: 1,
            showscale: false,
            colorbar: {
              title: 'Values / Categories',
              tickvals: [0, 1],
              ticktext: ['0', '1'],
            },
          },
          {
            x: xArr,
            y: yArr,
            textposition: 'top center',
            mode: 'markers+text',
            marker: {
              symbol: 'circle',
              size: 10,
            },
          },
        ]}
        layout={{
          title: {
            text: 'Gene Heatmap',
            font: { size: 36 },
          },
          xaxis: {
            title: {
              text: 'Patient Identifier - Index Date Run Days',
              standoff: 20,
              font: { size: 24 },
            },
            automargin: true,
            tickvals: Array.from({ length: totalData.length }, (_, i) => i),
            ticktext: totalData.map(
              (x) => `${x.patient_identifier}-${x.index_date_run_days}`,
            ),
          },
          yaxis: {
            title: {
              text: 'Genes',
              font: { size: 24 },
              standoff: 10,
            },
            automargin: true,
            tickvals: Object.values(geneDict),
            ticktext: Object.keys(geneDict),
          },
        }}
        style={{ width: '100%', height: '1200px', margin: '10px' }}
      />
    </div>
  );
};

export const useSeqVarQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              specimen (filter: $filter, accessibility: all, first: 10000,
                sort: [{ gene: "desc"}]) {
                  patient_identifier
                  index_date_run_days
                  gene
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              ['observation_code']: [
                'DNA analysis discrete sequence variation panel',
              ],
            },
          },
        ],
      },
    },
  });

  const cachedData = useMemo(() => {
    if (data) {
      const extractedData = isQueryResponse(data)
        ? extractData(data, 'specimen', '')
        : [];
      return extractedData;
    }
    return [];
  }, [data]);

  return { resData: cachedData, isLoading, isError };
};

export const useCopyNumberQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($filter: JSON) {
              specimen (filter: $filter, accessibility: all, first: 10000,
                sort: [{ gene: "desc"}]) {
                  patient_identifier
                  index_date_run_days
                  gene
              }
            }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              ['observation_code']: [
                'Copy number variation analysis in Blood or Tissue by Sequencing',
              ],
            },
          },
        ],
      },
    },
  });

  const cachedData = useMemo(() => {
    if (data) {
      const extractedData = isQueryResponse(data)
        ? extractData(data, 'specimen', '')
        : [];
      return extractedData;
    }
    return [];
  }, [data]);

  return {
    copyNumberData: cachedData,
    copyNumberLoading: isLoading,
    copyNumberError: isError,
  };
};

const SamplePage = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  const { resData, isLoading, isError } = useSeqVarQuery();
  const { copyNumberData, copyNumberLoading, copyNumberError } =
    useCopyNumberQuery();
  if (isError || copyNumberError) {
    return <Text> Error occurred while fetching file metadata </Text>;
  }
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Sample Page',
        content: 'Sample Data',
        key: 'gen3-sample-page',
      }}
    >
      <div className="w-full h-full">
        <LoadingOverlay visible={isLoading || copyNumberLoading} />
        <Heatmap data={resData} copyNumberData={copyNumberData} />
      </div>
    </NavPageLayout>
  );
};

// TODO: replace this with a custom getServerSideProps function
export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default SamplePage;
