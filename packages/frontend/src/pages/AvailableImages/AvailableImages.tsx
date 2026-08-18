import React, { useMemo } from 'react';
import { Text } from '@mantine/core';
import {
  useGeneralGQLQuery,
} from '@gen3/core';
import { MatchingTable } from '../../features/MatchingTable';
import { NavPageLayout } from '../../features/Navigation';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import type { AppsPageProps } from '../Apps/types';
import { type SummaryTableColumn } from '../../features/CohortBuilder/ExplorerTable/types';
import {
  type FileActionsConfig,
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
  pageProblems,
}: AppsPageProps) => {
  const { data, isLoading, isError } = useFileTypesFiles();
  // Explorer configuration is Loom-owned; legacy Gecko config documents no
  // longer provide image file actions. The page remains usable with its
  // built-in actions until a dedicated image policy is introduced.
  const fileActionsMap: Record<string, FileActionsConfig> = {};

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
      pageProblems={pageProblems}
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
