import { useState } from 'react';
import { Text, Loader, Center, Switch } from '@mantine/core';
import { MatchingTable } from '../../features/MatchingTable';
import { DonutSumChart, BarChart } from '../../components/charts';
import { NavPageLayout } from '../../features/Navigation';
import ProtectedContent from '../../components/Protected/ProtectedContent';

import { formatBytes } from '../../utils/labels';
import { convertSlicePointsToRangeMap } from './bindata';
import { FileSummaryPageProps } from './types';
import {
  useProjectsQuery,
  useFileAggsQuery,
  useFilesFromBinQuery,
  useFileTypesHistogramQuery,
} from './hooks';

export const FileSummaryPage = ({
  headerProps,
  footerProps,
  filesummaryConfig,
}: FileSummaryPageProps) => {
  const [barChartToggle, setbarChartToggle] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const { data, isLoading, isError } = useProjectsQuery();
  const [selectedProject, setSelectedProject] = useState<string>(
    filesummaryConfig?.defaultProject ?? '',
  );
  const [selectedRange, setSelectedRange] = useState<number[]>(
    filesummaryConfig?.binslicePoints.slice(0, 2) ?? [],
  );
  const { fdata, fisLoading, fisError } = useFileAggsQuery(
    filesummaryConfig?.binslicePoints ?? [],
    selectedProject,
  );

  const { fbindata, fbinisLoading, fbinisError } = useFilesFromBinQuery(
    selectedProject,
    selectedRange,
    filesummaryConfig?.config ?? {},
    selectedCategory,
  );

  const { ftdata, ftisLoading, ftisError } =
    useFileTypesHistogramQuery(selectedProject);

  if (isError || fisError || fbinisError || ftisError) {
    return <Text> Error occurred while fetching file metadata </Text>;
  }

  const handleProjectSelection = (projectName: string) => {
    setSelectedProject(projectName);
  };

  const rangeMapping = convertSlicePointsToRangeMap(
    filesummaryConfig?.binslicePoints ?? [],
  );
  const handleRangeSelection = (selectedRange: string) => {
    type ValidRange = keyof typeof rangeMapping;
    setSelectedRange(rangeMapping[selectedRange as ValidRange]);
    setSelectedCategory('');
  };

  const handleCategorySelection = (selectedCategory: string) => {
    setSelectedCategory(selectedCategory);
  };

  if (filesummaryConfig === undefined) {
    return (
      <Center maw={400} h={100} mx="auto">
        <div>filesummaryConfig config is not defined. Page disabled</div>
      </Center>
    );
  }
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR File Summary Page',
        content: 'File Summary',
        key: 'calypr-file-summary',
      }}
    >
      {fisLoading || isLoading || fbinisLoading || ftisLoading ? (
        <div className="fixed inset-0 flex justify-center items-center bg-gray-700 bg-opacity-50 z-50">
          <Loader size={30} />
        </div>
      ) : (
        <ProtectedContent>
          <div className="grid grid-cols-2 p-10">
            <div className="flex flex-col items-center p-4 bg-white shadow-lg rounded-lg">
              <Text>
                Total data stored:
                {' ' +
                  formatBytes(
                    data.reduce(
                      (sum: number, project: any) => sum + project.sum,
                      0,
                    ),
                  )}
              </Text>
              <DonutSumChart
                total={1}
                data={data}
                onClick={handleProjectSelection}
              />
            </div>
            <div className="flex flex-col p-4 bg-white shadow-lg rounded-lg">
              <div className="flex justify-between items-center w-full">
                <Text>
                  {barChartToggle ? 'File Size' : 'File Type'} Histogram for{' '}
                  {selectedProject}
                </Text>

                <div className="flex justify-between align-middle px-2">
                  <Text fw={500} className="mr-2">
                    {barChartToggle ? 'Sizes' : 'Types'}
                  </Text>

                  <Switch
                    classNames={{
                      track: `border border-black rounded-full h-8 w-12 ${barChartToggle ? 'bg-secondary' : 'bg-white'}`,
                      thumb: `transform h-6 w-6 bg-black border-black ${barChartToggle ? '-translate-x-[50%]' : 'translate-x-[0%]'}`,
                      label: 'font-content text-black',
                    }}
                    onChange={() => setbarChartToggle(!barChartToggle)}
                    checked={barChartToggle}
                  />
                </div>
              </div>

              {barChartToggle ? (
                <BarChart
                  total={1}
                  data={fdata}
                  onClick={handleRangeSelection}
                  colors={[filesummaryConfig.barChartColor]}
                />
              ) : (
                <BarChart
                  total={1}
                  data={ftdata}
                  onClick={handleCategorySelection}
                  colors={[filesummaryConfig.barChartColor]}
                />
              )}
            </div>
            <div className="col-span-2 m-6">
              <Text>
                {selectedCategory === ''
                  ? `Files from
                    ${formatBytes(selectedRange[0], 2)} -
                    ${formatBytes(selectedRange[1], 2)} `
                  : `Files of type ${selectedCategory} `}
                for {selectedProject}
              </Text>
              <div className="inline-block overflow-x-scroll">
                <div className="grid">
                  <MatchingTable
                    isLoading={fbinisLoading}
                    columns={filesummaryConfig?.config ?? {}}
                    index={filesummaryConfig?.index ?? ''}
                    idField={filesummaryConfig?.idField ?? ''}
                    data={fbindata}
                  />
                </div>
              </div>
            </div>
          </div>
        </ProtectedContent>
      )}
    </NavPageLayout>
  );
};

export default FileSummaryPage;
