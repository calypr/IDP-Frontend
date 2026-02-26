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
    const { headerProps, footerProps } = navigationConfigJSON;

    const headerMetadata: HeaderMetadata = {
      title: 'Gen3 Frontend Framework Page',
      content: 'Gen3 Frontend Framework Page',
      key: 'gen3-common-page',
    };

    return {
      headerProps,
      footerProps,
      headerMetadata,
    };
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
