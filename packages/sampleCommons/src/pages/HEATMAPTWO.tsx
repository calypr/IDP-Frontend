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

const Heatmap = ({ data }) => {
  console.log('DATA', data);
  const groupedData = data.reduce((acc, item) => {
    if (!acc[item.patient_identifier]) {
      acc[item.patient_identifier] = [];
    }
    acc[item.patient_identifier].push(item);
    return acc;
  }, {});

  // Create `geneDict` and `patientDict` dictionaries
  const geneDict = [...new Set(data.map((x) => x.gene))]
    .reverse()
    .reduce((acc, gene, index) => {
      acc[gene] = index;
      return acc;
    }, {});

  const patientDict = Object.keys(groupedData).reduce((acc, patient, index) => {
    acc[patient] = index;
    return acc;
  }, {});

  // Initialize a 2D `z` array (genes x unique patients) with zeros
  const array = Array(Object.keys(geneDict).length)
    .fill()
    .map(() => Array(Object.keys(patientDict).length).fill(0));

  // Fill the `z` array based on consolidated data
  for (const [patient, entries] of Object.entries(groupedData)) {
    const patientIndex = patientDict[patient];
    for (const entry of entries) {
      const geneIndex = geneDict[entry.gene];
      if (entry.copy_number_result === 'GAIN') {
        array[geneIndex][patientIndex] = 1;
      } else if (entry.copy_number_result === 'LOSS') {
        array[geneIndex][patientIndex] = 0.66;
      } else {
        array[geneIndex][patientIndex] = 0.33;
      }
    }
  }

  const colorscale = [
    [0, 'rgb(255, 255, 255)'],
    [0.33, 'rgb(0, 12, 255)'],
    [0.66, 'rgb(255, 0, 12)'],
    [1, 'rgb(12, 255, 0)'],
  ];

  // Generate `ticktext` based on the merged unique patient data
  const ticktext = Object.keys(groupedData).map((patient) => {
    const firstEntry = groupedData[patient][0]; // Use the first entry's `index_date_run_days`
    return `${patient}-${firstEntry.index_date_run_days}`;
  });

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
            showscale: true,
            colorbar: {
              tickvals: [0, 0.33, 0.66, 1],
              ticktext: [
                'No variation',
                'DNA sequence variation',
                'Copy Number LOSS',
                'Copy Number GAIN',
              ],
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
            tickvals: Array.from(
              { length: Object.keys(patientDict).length },
              (_, i) => i,
            ),
            ticktext: ticktext,
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
                sort: [{gene: "desc"},{patient_identifier: "desc"}]) {
                  observation_code
                  patient_identifier
                  index_date_run_days
                  copy_number_result
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

  return { resData: cachedData, isLoading, isError };
};

const SamplePage = ({ headerProps, footerProps }: NavPageLayoutProps) => {
  const { resData, isLoading, isError } = useSeqVarQuery();
  if (isError) {
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
        <LoadingOverlay visible={isLoading} />
        <Heatmap data={resData} />
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
