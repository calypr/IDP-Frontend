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
export const getNavPageLayoutPropsFromConfig = async () => {
  const navigationConfigJSON =
    await microserviceDb.get<NavPageLayoutProps>('nav/1');
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
};
