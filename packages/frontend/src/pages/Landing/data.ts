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
export const LandingPageGetServerSideProps: GetServerSideProps = async () => {
  let navPageLayoutProps: NavPageLayoutProps | null = null;
  let landingPage: any | null = null;
  let smmartConfig: SmmartConfig | null = null;

  try {
    // This function likely has an incorrect path to 'cbds/headerMetadata.json'.
    // The fix for that will need to be made inside the 'getNavPageLayoutPropsFromConfig' function itself.
    navPageLayoutProps = await getNavPageLayoutPropsFromConfig();
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
    smmartConfig = await ContentSource.getContentDatabase().get(
      `${smmartConfigPath}`,
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
