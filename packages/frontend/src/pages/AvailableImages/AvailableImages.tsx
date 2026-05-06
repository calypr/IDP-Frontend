import React, { useEffect, useMemo, useState } from 'react';
import { Text } from '@mantine/core';
import { useDispatch } from 'react-redux';
import {
  explorerConfigApi,
  useGeneralGQLQuery,
  useGetConfigListQuery,
} from '@gen3/core';
import { MatchingTable } from '../../features/MatchingTable';
import { NavPageLayout } from '../../features/Navigation';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { type NavPageLayoutProps } from '../../features/Navigation';
import { type SummaryTableColumn } from '../../features/CohortBuilder/ExplorerTable/types';
import {
  buildDeterministicFileActionsMap,
  type FileActionsConfig,
  sortConfigIds,
} from './AvailableImages.utils';

export const useFileTypesFiles = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
      document_reference(filter: $filter, first: 10000){
        document_reference_id
        document_reference_identifier
        document_reference_source_path
        document_reference_size
        project_id
      }
    }`,
    variables: {
      filter: {
        AND: [
          {
            EQ: {
              document_reference_contentType: 'image/tiff',
            },
          },
          {
            '!=': {
              document_reference_size: null,
            },
          },
          {
            GT: {
              document_reference_size: 0,
            },
          },
          {
            '!=': {
              document_reference_size: null,
            },
          },
          {
            GT: {
              document_reference_size: 0,
            },
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
    data: cachedfileData,
    isLoading,
    isError,
  };
};

const AvailableImagesPage = ({
  headerProps,
  footerProps,
}: NavPageLayoutProps) => {
  const { data, isLoading, isError } = useFileTypesFiles();
  const dispatch = useDispatch();
  const { data: configList } = useGetConfigListQuery();
  const [fileActionsMap, setFileActionsMap] = useState<
    Record<string, FileActionsConfig>
  >({});

  useEffect(() => {
    if (configList?.data && Array.isArray(configList.data)) {
      const fetchConfigs = async () => {
        const configResults = await Promise.all(
          sortConfigIds(configList.data).map(async (configId: string) => {
            try {
              const result: any = await (dispatch as any)(
                explorerConfigApi.endpoints.getConfigContent.initiate(configId),
              ).unwrap();
              const configData = result?.data;
              if (configData?.fileActions) {
                const projectIds = configData.preFilters?.project_id;
                const normalizedProjectIds = Array.isArray(projectIds)
                  ? projectIds.filter((projectId: unknown): projectId is string =>
                      typeof projectId === 'string' && projectId.length > 0,
                    )
                  : [];

                return {
                  configId,
                  fileActions: configData.fileActions as FileActionsConfig,
                  projectIds:
                    normalizedProjectIds.length > 0
                      ? normalizedProjectIds
                      : [configId],
                };
              }
            } catch (error: unknown) {
              console.error(
                `Failed to fetch config ${configId}`,
                error instanceof Error ? error.message : String(error),
              );
            }

            return null;
          }),
        );

        setFileActionsMap(
          buildDeterministicFileActionsMap(
            configResults.filter(
              (
                config,
              ): config is {
                configId: string;
                fileActions: FileActionsConfig;
                projectIds: Array<string>;
              } => config !== null,
            ),
          ),
        );
      };

      fetchConfigs();
    }
  }, [configList, dispatch]);

  const imageViewerTableConfig: Record<string, SummaryTableColumn> = useMemo(
    () => ({
      document_reference_identifier: {
        title: 'Download / View',
        field: 'document_reference_identifier',
        type: 'string',
        accessorPath: 'document_reference_identifier',
        cellRenderFunction: 'fileActions',
        width: 32,
        params: { fileActionsMap },
      },
      project_id: {
        title: 'Project Id',
        field: 'project_id',
      },
      document_reference_source_path: {
        title: 'Source Path',
        field: 'document_reference_source_path',
      },
      document_reference_size: {
        title: 'File Size',
        field: 'document_reference_size',
        accessorPath: 'document_reference_size',
        cellRenderFunction: 'HumanReadableString',
        type: 'string',
      },
    }),
    [fileActionsMap],
  );

  if (isError) {
    return <Text>Error in underlying query detected</Text>;
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR Image Viewer Page',
        content: 'CALYPR Image Viewer Page',
        key: 'available-images-page',
      }}
    >
      <ProtectedContent>
        <div className="w-full">
          <div className="mx-auto w-full max-w-[1600px] px-6 py-10 lg:px-8">
            <div className="pb-10 text-3xl font-bold text-black">
              Available .ome.tiff images
            </div>
            <div className="w-full overflow-x-auto">
              <MatchingTable
                isLoading={isLoading}
                columns={imageViewerTableConfig}
                index="document_reference"
                idField=""
                data={data}
              />
            </div>
          </div>
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default AvailableImagesPage;
