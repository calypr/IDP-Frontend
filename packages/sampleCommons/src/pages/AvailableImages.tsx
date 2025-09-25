import { useMemo } from 'react';
import {
  NavPageLayout,
  ProtectedContent,
  getNavPageLayoutPropsFromConfig,
  NavPageLayoutProps,
  MatchingTable,
  type SummaryTableColumn,
} from '@gen3/frontend';
import { Text } from '@mantine/core';
import { GetServerSideProps } from 'next';

import { useGeneralGQLQuery } from '@gen3/core';

export const useFileTypesFiles = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
      document_reference(filter: $filter, first: 10000){
        document_reference_id
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
    isLoading: isLoading,
    isError: isError,
  };
};

const AvailableImagesPage = ({
  headerProps,
  footerProps,
}: NavPageLayoutProps) => {
  const { data, isLoading, isError } = useFileTypesFiles();

  const imageViewerTableConfig: Record<string, SummaryTableColumn> = {
    document_reference_id: {
      title: 'Download / View',
      field: 'document_reference_id',
      type: 'link',
      accessorPath: 'document_reference_id',
      cellRenderFunction: 'DicomLink',
      width: 32,
      params: {
        baseURL: '/image-viewer/view',
      },
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
  };

  if (isError) {
    return <Text> Error in underlying query detected </Text>;
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
        <div className="flex justify-center w-screen">
          <div className="col-span-2 m-6">
            <div className="pt-10 pb-10 text-3xl font-bold text-black">
              Available .ome.tiff images
            </div>
            <div className="grid">
              <MatchingTable
                isLoading={isLoading}
                columns={imageViewerTableConfig ?? {}}
                index={'document_reference'}
                idField={''}
                data={data}
              />
            </div>
          </div>
        </div>
      </ProtectedContent>
    </NavPageLayout>
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

export default AvailableImagesPage;
