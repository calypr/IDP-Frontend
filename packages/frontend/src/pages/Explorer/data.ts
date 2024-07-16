import { GetServerSideProps } from 'next';
import { getNavPageLayoutPropsFromConfig } from '../../lib/common/staticProps';
import type { NavPageLayoutProps } from '../../features/Navigation';

export const ExplorerPageGetServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (_context) => {
  try {
    const response = await fetch(
      'http://10.43.124.240:9200/explorer_config/_doc/1',
    );

    if (!response.ok) {
      throw new Error('Failed to fetch data');
    }

    const explorerConfig = await response.json();

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        explorerConfig: explorerConfig.results,
      },
    };
  } catch (err) {
    console.error(err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        explorerConfig: undefined,
      },
    };
  }
};
