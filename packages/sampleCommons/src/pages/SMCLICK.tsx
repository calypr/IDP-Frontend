import React from 'react';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import {
  MantineProvider,
  Container,
  Text,
  Image,
  LoadingOverlay,
  Button,
} from '@mantine/core';
import ReactECharts from 'echarts-for-react';

import {
  NavPageLayout,
  NavPageLayoutProps,
  ProtectedContent,
  ErrorCard,
  getNavPageLayoutPropsFromConfig,
} from '@gen3/frontend';

import { useGeneralGQLQuery } from '@gen3/core';
import { title } from 'process';

interface SamplePageProps {
  headerProps: any;
  footerProps: any;
}

const isQueryResponse = (obj: any): obj is QueryResponse => {
  return (
    typeof obj === 'object' &&
    (obj.data === undefined || typeof obj.data === 'object')
  );
};

interface HistogramData {
  key: string;
  count: number;
}

interface Observation {
  [key: string]: {
    histogram: HistogramData[];
    _cardinalityCount?: number;
  };
}

interface QueryResponse {
  data?: Record<string, Observation[]>;
  countsProperty?: string;
}

const extractData = (
  data: QueryResponse,
  countsProperty: string,
  returnType: 'histogram' | 'totalCounts',
): HistogramData[] | number => {
  if (!data || !data.data || !data.data._aggregation || !countsProperty) {
    return returnType === 'histogram' ? [] : 0;
  }

  const allObservations = Object.values(data.data._aggregation).flat();
  const targetObservation = allObservations.find(
    (observation) => observation[countsProperty],
  );

  if (!targetObservation) {
    return returnType === 'histogram' ? [] : 0;
  }

  if (returnType === 'histogram') {
    return Array.isArray(targetObservation[countsProperty].histogram)
      ? targetObservation[countsProperty].histogram.slice(0, 20)
      : [];
  } else if (targetObservation && targetObservation[countsProperty]) {
    const cardinalityCount =
      targetObservation[countsProperty]!._cardinalityCount;
    if (typeof cardinalityCount === 'number') {
      return cardinalityCount;
    }
  }
  return 0;
};

const HorizontalBarChart = ({ headerProps, footerProps }: SamplePageProps) => {
  const summaryCountsQuery = (countsProperty: string) => {
    const summary_counts_query = {
      query: `query ($filter: JSON){
      _aggregation {
        observation(filter: $filter, accessibility: all) {
          ${countsProperty} {
            _cardinalityCount
            }
          }
        }
      }`,
      variables: {
        filter: {
          AND: [
            {
              IN: {
                project_id: ['cbds-smmart_labkey_demo'],
              },
            },
          ],
        },
      },
    };
    return summary_counts_query;
  };

  const countsQuery = (countsProperty: string) => {
    const props_query = {
      query: `query ($filter: JSON) {
        _aggregation{
          observation(filter: $filter accessibility:all) {
            ${countsProperty}{
              histogram {
                key
                count
              }
            }
          }
        }
      }`,
      variables: {
        filter: {
          AND: [
            {
              IN: {
                project_id: ['cbds-smmart_labkey_demo'],
              },
            },
          ],
        },
      },
    };
    return props_query;
  };

  const SummaryCounts = (countsProperty: string) => {
    const { data, isLoading, isError } = useGeneralGQLQuery(
      summaryCountsQuery(countsProperty),
    );
    const totalCountsData = isQueryResponse(data)
      ? extractData(data, countsProperty, 'totalCounts')
      : 0;
    if (isError) {
      return <ErrorCard message={'Error occurred while fetching data'} />;
    }
    return isLoading ? (
      <div>loading...</div>
    ) : (
      <div className="text-2xl font-bold">
        {typeof totalCountsData === 'number' ? (
          totalCountsData
        ) : (
          <>{'missing data'}</>
        )}
      </div>
    );
  };

  const Echart = (countsProperty: string) => {
    const { data, isLoading, isError } = useGeneralGQLQuery(
      countsQuery(countsProperty),
    );
    const queryData = isQueryResponse(data)
      ? extractData(data, countsProperty, 'histogram')
      : [];
    if (isError) {
      return <ErrorCard message={'Error occurred while fetching data'} />;
    }
    const option = {
      title: {
        text: countsProperty,
        right: 50,
      },
      yAxis: {
        type: 'category',
        data: Array.isArray(queryData) ? queryData.map((item) => item.key) : [],
        axisLabel: {
          interval: 0,
        },
      },
      xAxis: {
        type: 'value',
      },
      grid: {
        containLabel: true,
      },
      series: [
        {
          data: Array.isArray(queryData)
            ? queryData.map((item) => item.count)
            : [],
          type: 'bar',
          barCategoryGap: '50%',
        },
      ],
    };
    const chart = (
      <div className="w-full h-full">
        <LoadingOverlay visible={isLoading} />
        <ReactECharts
          option={option}
          style={{ height: '100%', minHeight: '500px' }}
        />
      </div>
    );
    return chart;
  };
  const router = useRouter();

  return (
    <ProtectedContent>
      <NavPageLayout headerProps={headerProps} footerProps={footerProps}>
        <MantineProvider withGlobalStyles>
          <div className="pt-5">
            <div className="bg-cbds-primary pt-[1.5%] pb-[1.5%]">
              <Container className="bg-cbds-monoprimary text-center">
                <span className="flex items-center space-x-4">
                  <div className="p-5 flex-shrink-0">
                    <Image src={'/icons/SMMART.svg'} alt={'logo'} />
                  </div>
                  <Text className="whitespace-nowrap text-center text-white text-5xl font-bold">
                    SMMART Clinical Trials Platform
                  </Text>
                </span>
              </Container>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-10">
              <div className="col-span-1 p-10">
                <h1 className="prose sm:prose-base 2xl:prose-lg mb-5 !mt-0">
                  Overview of SMMART and datasets, what can be found in this
                  project
                </h1>
                <Button
                  onClick={() => {
                    router.push('/Explorer');
                  }}
                  className="bg-cbds-monoprimary text-white py-2 px-4 rounded"
                >
                  Explore Datasets
                </Button>
              </div>

              <div className="col-span-2 grid grid-cols-2 gap-4">
                {Echart('condition_code')}

                {Echart('product_notes_project_id')}
              </div>
            </div>
            <div className="text-center mx-auto bg-gray-200 py-5">
              <div className="flex justify-center space-x-8">
                <div className="text-center">
                  {SummaryCounts('patient_id')}
                  <div className="text-sm">Donors</div>
                </div>
                <div className="text-center">
                  {SummaryCounts('specimen_identifier')}
                  <div className="text-sm">Samples</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">1</div>
                  <div className="text-sm">Datasets</div>
                </div>
                <div className="text-center">
                  {SummaryCounts('condition_code')}

                  <div className="text-sm">Cancers</div>
                </div>
                <div className="text-center">
                  {SummaryCounts('specimen_collection_concept')}
                  <div className="text-sm">Collection Types</div>
                </div>
              </div>
            </div>
          </div>
        </MantineProvider>
      </NavPageLayout>
    </ProtectedContent>
  );
};

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async () => {
  return {
    props: {
      ...(await getNavPageLayoutPropsFromConfig()),
    },
  };
};

export default HorizontalBarChart;
