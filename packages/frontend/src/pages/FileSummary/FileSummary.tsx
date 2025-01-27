import { useMemo, useState } from 'react';
import { Text, Loader, Center } from '@mantine/core';
import { MatchingTable } from '../../features/MatchingTable';
import { DonutSumChart, BarChart } from '../../components/charts';
import { NavPageLayout } from '../../features/Navigation';
import { SummaryTableColumn } from '../../features/CohortBuilder';
import ProtectedContent from '../../components/Protected/ProtectedContent';

import { useGeneralGQLQuery } from '@gen3/core';
import { isQueryResponse } from '../../features/CohortBuilder/ExplorerTable/ExploreTableDetails/QueryRowDetailsPanel';
import { extractData } from '../../utils/extractdata';
import { formatBytes } from '../../utils/labels';
import {
  convertSlicePointsToRangeMap,
  binDataWithCustomBoundaries,
} from './bindata';
import { FileSummaryPageProps } from './types';

export const useFileAggsQuery = (
  slicePoints: number[],
  selected_project: string,
) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
      file(filter: $filter, accessibility: all, first: 10000, sort: [{size: "desc"}]){
        source_path
        size
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            IN: {
              project_id: [selected_project],
            },
          },
        ],
      },
    },
  });

  const cachedfileData = useMemo(() => {
    if (data) {
      const project_data = isQueryResponse(data)
        ? extractData(data, 'file', '')
        : [];
      return binDataWithCustomBoundaries(project_data, slicePoints);
    }
    return [];
  }, [data]);

  return { fdata: cachedfileData, fisLoading: isLoading, fisError: isError };
};

export const useFilesFromBinQuery = (
  project: string,
  file_range: number[],
  config: Record<string, SummaryTableColumn>,
) => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
  		_aggregation{
        file(filter: $filter){
          _totalCount
        }
      }
      file(filter: $filter, accessibility: all, first: 10000, sort: [{size: "desc"}]){
        ${Object.keys(config).join('\n')}
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              project_id: project,
            },
          },
          {
            AND: [
              {
                GTE: {
                  size: file_range[0],
                },
              },
              {
                LT: {
                  size: file_range[1],
                },
              },
            ],
          },
        ],
      },
    },
  });

  const cachedfileData = useMemo(() => {
    if (data) {
      return data;
    }
  }, [data]);
  return {
    fbindata: cachedfileData,
    fbinisLoading: isLoading,
    fbinisError: isError,
  };
};

export const useProjectsQuery = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query ($nestedAggFields: JSON) {
      _aggregation {
        file(nestedAggFields: $nestedAggFields) {
          project_id {
            histogram {
              key
              termsFields {
                field
                terms {
                  key
                  count
                }
              }
            }
          }
        }
      }
    }`,
    variables: {
      nestedAggFields: {
        termsFields: ['size'],
      },
    },
  });

  const cachedData = useMemo(() => {
    if (data) {
      const project_data = isQueryResponse(data)
        ? extractData(data, 'file', 'project_id')
        : [];
      const result: any = project_data.map((project) => {
        const totalSum = project.termsFields.reduce(
          (fieldSum: number, field: any) => {
            return (
              fieldSum +
              field.terms.reduce((termSum: number, term: any) => {
                const key = parseFloat(term.key); // Convert key to number
                return termSum + key * term.count;
              }, 0)
            );
          },
          0,
        );

        return { key: project.key, sum: totalSum };
      });
      return result;
    }
    return [];
  }, [data]);

  return { data: cachedData, isLoading, isError };
};

export const FileSummaryPage = ({
  headerProps,
  footerProps,
  filesummaryConfig,
}: FileSummaryPageProps) => {
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
  );

  if (isError || fisError || fbinisError) {
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
      headerData={{
        title: 'Gen3 File Summary Page',
        content: 'File Summary',
        key: 'gen3-file-summary',
      }}
    >
      {fisLoading || isLoading || fbinisLoading ? (
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
            <div className="flex flex-col items-center p-4 bg-white shadow-lg rounded-lg">
              <Text> File Size Histogram for {selectedProject}</Text>
              <BarChart
                total={1}
                data={fdata}
                onClick={handleRangeSelection}
                colors={[filesummaryConfig.barChartColor]}
              />
            </div>
            <div className="col-span-2 m-6">
              <Text>
                Files from {'  '}
                {formatBytes(selectedRange[0], 2)} -
                {formatBytes(selectedRange[1], 2)}
                {'  '}
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
