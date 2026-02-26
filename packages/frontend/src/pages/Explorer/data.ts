import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import {
  CohortBuilderConfiguration,
  CohortBuilderProps,
  CohortPanelConfiguration,
} from '../../features/CohortBuilder';
import {
  fetchJSONDataFromURL,
  GEN3_COMMONS_NAME,
  GEN3_GUPPY_API,
  groupSharedFields,
  HttpMethod,
  SharedFieldMapping,
} from '@gen3/core';
import { isArray } from 'lodash';
import type { NavPageLayoutProps } from '../../features/Navigation';
import {
  AccessControlConfiguration,
  GuppyDataAccessMode,
} from '../../features/CohortBuilder/types';
import { microserviceDb } from '../../lib/content';

const DefaultHeaderMetadata = {
  title: 'Gen3 Explorer Page',
  content: 'Explorer Page',
  key: 'gen3-explorer-page',
};

const GetSharedFieldMapping = async (
  cohortBuilderConfiguration: CohortBuilderConfiguration,
) => {
  let sharedFiltersMap: SharedFieldMapping | null = null;

  if (cohortBuilderConfiguration?.sharedFilters) {
    if (cohortBuilderConfiguration?.sharedFilters?.autoCreate) {
      const indices = cohortBuilderConfiguration?.explorerConfig.map(
        (tab) => tab.guppyConfig.dataType,
      );

      try {
        const data = await fetchJSONDataFromURL<any>(
          `${GEN3_GUPPY_API}/graphql`,
          true,
          HttpMethod.POST,
          { query: `{ _mapping { ${indices.join(' ')} }}`, variables: {} },
        );
        if ('_mapping' in data.data) {
          sharedFiltersMap = groupSharedFields(data.data['_mapping']);
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          console.warn('Unable to get mapping data from guppy:', err);
        }
      }
    }
    if (cohortBuilderConfiguration?.sharedFilters?.defined) {
      sharedFiltersMap = cohortBuilderConfiguration?.sharedFilters?.defined;
    }
    if (sharedFiltersMap) {
      const indexToAlias = Object.values(
        cohortBuilderConfiguration?.explorerConfig,
      ).reduce(
        (acc: Record<string, string>, panel: CohortPanelConfiguration) => {
          acc[panel.guppyConfig.dataType] = panel.tabTitle;
          return acc;
        },
        {},
      );

      const updatedSharedFiltersMap: SharedFieldMapping = {};
      for (const [field, values] of Object.entries(sharedFiltersMap)) {
        updatedSharedFiltersMap[field] = values.map((x) => ({
          ...x,
          indexAlias: indexToAlias[x.index],
        }));
      }
      sharedFiltersMap = updatedSharedFiltersMap;
    }
  }

  return sharedFiltersMap;
};

const DefaultAccessControlConfiguration: AccessControlConfiguration = {
  dataMode: GuppyDataAccessMode.REGULAR,
  tierLimit: -1,
  showAccessLevelControl: false,
};

export const ExplorerPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps | CohortBuilderProps | { errorStatus?: number }
> = async (context) => {
  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }
  try {
    const cohortBuilderConfiguration: CohortBuilderConfiguration =
      await ContentSource.getContentDatabase().get(
        `${GEN3_COMMONS_NAME}/explorer.json`,
        requestHeaders,
      );

    if (isArray(cohortBuilderConfiguration)) {
      return {
        props: {
          ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
          explorerConfig: cohortBuilderConfiguration,
          headerMetadata: cohortBuilderConfiguration?.headerMetadata
            ? cohortBuilderConfiguration.headerMetadata
            : DefaultHeaderMetadata,
        },
      };
    }

    const sharedFiltersMap = await GetSharedFieldMapping(
      cohortBuilderConfiguration,
    );

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        sharedFiltersMap: sharedFiltersMap,
        tabsLayout: cohortBuilderConfiguration?.tabsLayout ?? 'left',
        explorerConfig: cohortBuilderConfiguration.explorerConfig,
        accessControl: {
          ...DefaultAccessControlConfiguration,
          ...(cohortBuilderConfiguration.accessControl ?? {}),
        },
      },
    };
  } catch (err: unknown) {
    const status = (err as any).status || 500;
    context.res.statusCode = status;
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        explorerConfig: null,
        errorStatus: status,
      },
    };
  }
};

export const ExplorerPageGetServerSidePropsForConfigId: GetServerSideProps<
  NavPageLayoutProps | CohortBuilderProps | { errorStatus?: number }
> = async (context) => {
  const configId = context.query.configId as string;

  const cookieHeader = context.req.headers.cookie;
  const requestHeaders: Record<string, string> = {};
  if (cookieHeader) {
    requestHeaders['Cookie'] = cookieHeader;
  }

  try {
    const cohortBuilderConfiguration: CohortBuilderConfiguration =
      await microserviceDb.get<CohortBuilderConfiguration>(
        `explorer/${configId}`,
        requestHeaders,
      );

    if (isArray(cohortBuilderConfiguration)) {
      return {
        props: {
          ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
          explorerConfig: cohortBuilderConfiguration,
          headerMetadata: cohortBuilderConfiguration?.headerMetadata
            ? cohortBuilderConfiguration.headerMetadata
            : DefaultHeaderMetadata,
        },
      };
    }

    const sharedFiltersMap = await GetSharedFieldMapping(
      cohortBuilderConfiguration,
    );

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        sharedFiltersMap: sharedFiltersMap,
        tabsLayout: cohortBuilderConfiguration?.tabsLayout ?? 'left',
        explorerConfig: cohortBuilderConfiguration.explorerConfig,
        accessControl: {
          ...DefaultAccessControlConfiguration,
          ...(cohortBuilderConfiguration.accessControl ?? {}),
        },
      },
    };
  } catch (err: unknown) {
    const status = (err as any).status || 500;
    context.res.statusCode = status;
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig(requestHeaders)),
        explorerConfig: null,
        errorStatus: status,
      },
    };
  }
};
