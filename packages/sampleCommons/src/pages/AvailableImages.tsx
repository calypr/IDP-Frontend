import { useMemo } from 'react';
import {
  NavPageLayout,
  ProtectedContent,
  getNavPageLayoutPropsFromConfig,
  NavPageLayoutProps,
  MatchingTable,
} from '@gen3/frontend';
import { Text } from '@mantine/core';

import { useGeneralGQLQuery } from '@gen3/core';

export const useFileTypesFiles = () => {
  const { data, isLoading, isError } = useGeneralGQLQuery({
    query: `query($filter:JSON){
      file(filter: $filter, accessibility: all, first: 10000, sort: [{size: "desc"}]){
        id
        title
        size
      }
    }`,
    variables: {
      filter: {
        AND: {
          EQ: {
            contentType: 'image/tiff',
          },
        },
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
  const imageViewerTableConfig = {
    id: {
      title: 'View Image',
      type: 'link',
      accessorPath: 'id',
      cellRenderFunction: 'DiacomLink',
      width: '32px',
      params: {
        baseURL: '/image-viewer/view',
      },
      field: 'id',
    },
    project_id: {
      title: 'Project Id',
      field: 'project_id',
    },
    title: {
      title: 'Title',
      field: 'title',
    },
    size: {
      title: 'File Size',
      field: 'size',
    },
  };

  if (isError) {
    return <Text> Error in underlying query detected </Text>;
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Discovery Page',
        content: 'Discovery Page',
        key: 'discovery-page',
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
                index={'file'}
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
