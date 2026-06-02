import { GetServerSideProps } from 'next';
import path from 'path'; // Import the path module to resolve file paths
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import ContentSource from '../../lib/content';
import { GEN3_COMMONS_NAME } from '@gen3/core';
import { type SmmartProps } from '../Smmart/types';
import { NavPageLayoutProps } from '../../features/Navigation';
import { SmmartConfig } from '../Smmart/types';

/**
 * Fetches the necessary data for the landing page from content sources.
 * It handles potential file-not-found errors gracefully by returning null for missing configs.
 * @returns {Promise<{ props: { ... } }>} The props for the landing page component.
 */
export const LandingPageGetServerSideProps: GetServerSideProps = async (
  context,
) => {
  let navPageLayoutProps: NavPageLayoutProps | null = null;
  let landingPage: any | null = null;
  let smmartConfig: SmmartConfig | null = null;
  const requestHeaders: Record<string, string> = {};
  const cookieHeader = context.req.headers.cookie;
  const authorizationHeader = context.req.headers.authorization;
  const hasAuthenticatedSession =
    (typeof authorizationHeader === 'string' && authorizationHeader.length > 0) ||
    (typeof cookieHeader === 'string' &&
      /(?:^|;\s*)(?:access_token|credentials_token)=/i.test(cookieHeader));

  if (typeof cookieHeader === 'string' && cookieHeader) {
    requestHeaders.Cookie = cookieHeader;
  }
  if (typeof authorizationHeader === 'string' && authorizationHeader) {
    requestHeaders.Authorization = authorizationHeader;
  }

  try {
    navPageLayoutProps = await getNavPageLayoutPropsFromConfig(requestHeaders);
    if (!hasAuthenticatedSession) {
      navPageLayoutProps.headerProps.topBar.items =
        navPageLayoutProps.headerProps.topBar.items.filter(
          (item) => item.href !== '/git',
        );
    }
  } catch (err) {
    console.error('Error fetching NavPageLayoutProps:', err);
  }

  try {
    // Fetch the landing page config.
    // Assuming getContentDatabase().get() expects a path relative to the content root.
    landingPage = await ContentSource.getContentDatabase().get(
      `${GEN3_COMMONS_NAME}/landingPage.json`,
    );
  } catch (err) {
    console.error('Error fetching landingPage config:', err);
  }

  try {
    // Correcting the file path: The original error 'config/config/...'
    // suggests the path passed to getContentDatabase().get() was redundant.
    const smmartConfigPath = path.join(
      GEN3_COMMONS_NAME,
      'smmartLandingPage.json',
    );
    smmartConfig =
      await ContentSource.getContentDatabase().get<SmmartConfig>(
        smmartConfigPath,
      );
  } catch (err) {
    // Gracefully handle the error if the config file is not found.
    console.error('Error fetching smmartConfig:', err);
  }

  return {
    props: {
      ...navPageLayoutProps,
      landingPage,
      smmartConfig,
    },
  };
};
