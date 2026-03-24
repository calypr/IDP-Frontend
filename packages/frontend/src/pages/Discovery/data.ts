import { GetServerSideProps } from 'next';
import { DataLibraryStoreMode, GEN3_COMMONS_NAME } from '@gen3/core';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { type DiscoveryConfig } from '../../features/Discovery';
import type { NavPageLayoutProps } from '../../features/Navigation';
import { DataLibraryConfig } from '../../features/DataLibrary';
import { DiscoveryPageProps } from './types';

export const DiscoveryPageGetServerSideProps: GetServerSideProps<
  DiscoveryPageProps
> = async (context) => {
  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }
  try {
    const discoveryConfig: DiscoveryConfig =
      await ContentSource.getContentDatabase().get(
        `${GEN3_COMMONS_NAME}/discovery.json`,
        requestHeaders,
      );
    // need data library config for export from discovery using the DataLibrary
    const datalibraryConfig: DataLibraryConfig =
      await ContentSource.getContentDatabase().get(
        `${GEN3_COMMONS_NAME}/dataLibrary.json`,
        requestHeaders,
      );

    discoveryConfig.metadataConfig?.forEach((index) => {
      if (index.features.exportFromDiscovery)
        index.features.exportFromDiscovery.dataLibraryStoreMode =
          datalibraryConfig?.storageMode ?? DataLibraryStoreMode.ApiOnly;
    });

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        discoveryConfig: discoveryConfig,
      },
    };
  } catch (err: unknown) {
    const status = (err as any).status || 500;
    context.res.statusCode = status;
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        discoveryConfig: null as any,
        errorStatus: status,
      },
    };
  }
};
