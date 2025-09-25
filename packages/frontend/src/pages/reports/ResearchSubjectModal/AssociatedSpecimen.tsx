import ErrorCard from '../../../components/ErrorCard';
import { PieChart } from '../../../components/charts';
import { Stack, LoadingOverlay, Title } from '@mantine/core';
import { useMemo } from 'react';
import { useFilesQuery } from './AssociatedFiles';
import { QueryContent, ResourceDict } from '../types';

export const SpecimenAggregationCountsChart = ({
  aggField, // top-level file count aggregation
  countField, // file count sub-aggregation
  title,
  specimenIds,
}: {
  aggField: string;
  countField: string;
  title: string;
  specimenIds: string[];
}) => {
  // retrieve files associated with specimen ids (+ any groups with that specimen in it)
  const { data, isLoading, isError } = useFilesQuery(specimenIds, false);

  // convert Guppy response into format needed for PieChart component
  // ie get file counts by `countField` (eg sample family ID) grouped by `aggField` (eg assay)
  const pieChartData = useMemo(() => {
    if (!data) return [];

    // for each file-specimen JSON, get
    const aggregatedMap = (data as QueryContent).reduce(
      (countsMap: Record<string, Set<string>>, d: ResourceDict) => {
        const aggValue = d[aggField];
        if (aggValue in countsMap) {
          countsMap[aggValue].add(d[countField]);
        } else {
          countsMap[aggValue] = new Set([d[countField]]);
        }
        return countsMap;
      },
      {},
    );

    // convert into pie chart data format
    return Object.keys(aggregatedMap).map((key) => ({
      key: key,
      count: aggregatedMap[key].size,
    }));
  }, [data, aggField, countField]);

  // render component with data if successfully loaded
  if (isError) {
    return <ErrorCard message={'Error occurred while fetching data'} />;
  }

  return (
    specimenIds &&
    specimenIds.length !== 0 &&
    pieChartData &&
    pieChartData.length !== 0 && (
      <div className="flex flex-col">
        <Title order={4} className="text-center pt-5">
          {title}
        </Title>
        <div className="flex-grow">
          <Stack>
            <LoadingOverlay visible={isLoading} />
            <PieChart total={1} data={pieChartData} />
          </Stack>
        </div>
      </div>
    )
  );
};
