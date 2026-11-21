import {
  type HeaderMetadata,
  type NavPageLayoutProps,
} from '../../features/Navigation';
import type { ServerPageContext } from '../pageLoader';
import { NavPageLayoutConfigurationSchema } from '../config/schemas';

/**
 * Retrieves navigation page layout properties from configuration.
 * Note: GEN3_COMMONS_NAME depends on siteConfig.json value in the data commons package
 * @returns A Promise resolving to an object containing header and footer props.
 */
const prepareNavigation = (
  navigationConfigJSON: NavPageLayoutProps,
): NavPageLayoutProps => {
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

  const hasGitTopBarItem = normalizedTopBarItems.some(
    (item) => item.href === '/git',
  );

  const topBarItems = hasGitTopBarItem
    ? normalizedTopBarItems
    : [
        {
        href: '/git',
        leftIcon: 'mdi:git',
        name: 'Git',
        openInNewTab: false,
        tooltip: 'Manage Git-backed Calypr projects',
        } as any,
        ...normalizedTopBarItems,
      ];

  const headerMetadata: HeaderMetadata = {
    title: 'Gen3 Frontend Framework Page',
    content: 'Gen3 Frontend Framework Page',
    key: 'gen3-common-page',
  };

  return {
    headerProps: {
      ...headerProps,
      topBar: {
        ...headerProps.topBar,
        items: topBarItems,
      },
    },
    footerProps,
    headerMetadata,
    ...(fileActions !== undefined ? { fileActions } : {}),
    ...(dynamicProps !== undefined ? { dynamicProps } : {}),
  };
};

export const loadNavigationFromContext = async (
  context: ServerPageContext,
): Promise<NavPageLayoutProps> =>
  prepareNavigation(
    NavPageLayoutConfigurationSchema.parse(
      await context.gecko.get<NavPageLayoutProps>('nav/1'),
    ) as unknown as NavPageLayoutProps,
  );
