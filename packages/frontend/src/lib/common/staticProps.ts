import {
  type HeaderMetadata,
  type NavPageLayoutProps,
} from '../../features/Navigation';
import { microserviceDb } from '../content';

/**
 * Retrieves navigation page layout properties from configuration.
 * Note: GEN3_COMMONS_NAME depends on siteConfig.json value in the data commons package
 * @returns A Promise resolving to an object containing header and footer props.
 */
export const getNavPageLayoutPropsFromConfig = async (
  headers?: Record<string, string>,
) => {
  try {
    const navigationConfigJSON = await microserviceDb.get<NavPageLayoutProps>(
      'nav/1',
      headers,
    );

    const { headerProps, footerProps, fileActions, dynamicProps } =
      navigationConfigJSON;
    const normalizedTopBarItems = headerProps.topBar.items.map((item) =>
      item.href === '/organization'
        ? {
            ...item,
            href: '/git',
            leftIcon: 'mdi:git',
            name: 'Git',
            openInNewTab: false,
            tooltip: 'Manage Git-backed Calypr projects',
          }
        : item,
    );
    (headerProps.topBar as any).items = normalizedTopBarItems;

    const hasGitTopBarItem = normalizedTopBarItems.some(
      (item) => item.href === '/git',
    );

    if (!hasGitTopBarItem) {
      headerProps.topBar.items.unshift({
        href: '/git',
        leftIcon: 'mdi:git',
        name: 'Git',
        openInNewTab: false,
        tooltip: 'Manage Git-backed Calypr projects',
      } as any);
    }

    const headerMetadata: HeaderMetadata = {
      title: 'Gen3 Frontend Framework Page',
      content: 'Gen3 Frontend Framework Page',
      key: 'gen3-common-page',
    };

    const result: any = {
      headerProps,
      footerProps,
      headerMetadata,
    };
    if (fileActions !== undefined) {
      result.fileActions = fileActions;
    }
    if (dynamicProps !== undefined) {
      result.dynamicProps = dynamicProps;
    }
    return result;
  } catch (err: unknown) {
    console.warn(
      'Failed to fetch navigation configuration from microservice:',
      err,
    );
    // Return minimal skeleton properties to keep page rendering possible so logic can show login modal
    return {
      headerProps: {
        topBar: {
          items: [],
          loginButtonVisibility: 'hidden' as any,
        },
        navigation: { items: [] },
        banners: [],
        leftnav: [],
        basePage: false,
      },
      footerProps: {
        rightSection: { columns: [], basePage: false },
        basePage: false,
      },
      headerMetadata: {
        title: 'Gen3',
        content: 'Gen3',
        key: 'gen3-common-page',
      },
    };
  }
};
