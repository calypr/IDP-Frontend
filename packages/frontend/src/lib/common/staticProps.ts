import {
  type HeaderMetadata,
  type NavPageLayoutProps,
} from '../../features/Navigation';
import { microserviceDb } from '../content';

import type { AppsProps } from '../../pages/Apps/types';

/**
 * Retrieves navigation page layout properties from configuration.
 * Note: GEN3_COMMONS_NAME depends on siteConfig.json value in the data commons package
 * @returns A Promise resolving to an object containing header and footer props.
 */
export const getNavPageLayoutPropsFromConfig = async (
  headers?: Record<string, string>,
) => {
  try {
    const [navigationConfigJSON, appsPageProps] = await Promise.all([
      microserviceDb.get<NavPageLayoutProps>('nav/1', headers),
      microserviceDb
        .get<AppsProps>('apps_page/1', headers)
        .catch(() => ({ appsConfig: { appCards: [] } })),
    ]);

    const { headerProps, footerProps, fileActions, dynamicProps } = navigationConfigJSON;

    // Map appCards to subItems for the "Explorers" menu item
    // Handle both { appsConfig: { appCards: [...] } } and { appCards: [...] } formats
    const appCards =
      appsPageProps?.appsConfig?.appCards || (appsPageProps as any)?.appCards;

    if (appCards && Array.isArray(appCards)) {
      const explorerItems = appCards
        .filter((card: any) => card?.href?.toLowerCase() !== '/upload')
        .map((card: any) => {
        const item: any = {
          title: card.title || card.name,
          description: card.description || '',
          icon: card.icon || '/icons/apps/gen3_app.svg',
          href: card.href,
          perms: card.perms || '',
        };
        if (card.dynamicProps !== undefined) {
          item.dynamicProps = card.dynamicProps;
        }
        return item;
        });

      // Find the Explorers item or add it if it doesn't exist
      const explorersIndex = headerProps.leftnav.findIndex(
        (item) =>
          item.title.toLowerCase() === 'explorers' ||
          item.title.toLowerCase() === 'apps',
      );

      if (explorersIndex !== -1) {
        headerProps.leftnav[explorersIndex] = {
          ...headerProps.leftnav[explorersIndex],
          subItems: explorerItems,
        };
      } else {
        headerProps.leftnav.unshift({
          title: 'Explorers',
          description: 'Explore available applications',
          icon: '/icons/apps/gen3_app.svg',
          href: '/Apps',
          perms: '',
          subItems: explorerItems,
        });
      }
    } else {
      console.warn('No appCards found in apps_page/1 response:', appsPageProps);
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
    console.warn('Failed to fetch navigation configuration from microservice:', err);
    // Return minimal skeleton properties to keep page rendering possible so logic can show login modal
    return {
      headerProps: {
        topBar: {
          items: [],
          loginButtonVisibility: 'hidden' as any,
          onToggle: () => {
            /* do nothing */
          },
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
