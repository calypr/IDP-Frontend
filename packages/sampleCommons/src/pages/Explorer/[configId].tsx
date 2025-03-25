import {
  getNavPageLayoutPropsFromConfig,
  NavPageLayout,
  NavPageLayoutProps,
} from '@gen3/frontend';
import React from 'react';
import { CohortBuilder, ExplorerPageProps } from '@gen3/frontend';
import { Center } from '@mantine/core';
import { GetServerSideProps } from 'next';
import { GEN3_API } from '@gen3/core';

const CohortBuilderPage = ({
  headerProps,
  footerProps,
  explorerConfig,
}: ExplorerPageProps): JSX.Element => {
  if (explorerConfig === null) {
    // Changed from undefined to null
    return (
      <Center maw={400} h={100} mx="auto">
        <div>Cohort config is not defined. Page disabled</div>
      </Center>
    );
  }

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Cohort Builder Page',
        content: 'Cohort Builder',
        key: 'gen3-cohort-builder-page',
      }}
    >
      <CohortBuilder explorerConfig={explorerConfig} />
    </NavPageLayout>
  );
};

export const getServerSideProps: GetServerSideProps<
  NavPageLayoutProps
> = async (context) => {
  const configId = context.query.configId as string;
  const baseUrl = `${GEN3_API}/ExplorerConfig`;
  const configUrl = `${baseUrl}/${configId}`;
  console.log('CONFIG URL: ', configUrl);

  try {
    const response = await fetch(configUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch config: ${response.status}`);
    }

    const config = await response.json();
    console.log('RESP: ', config);

    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        explorerConfig: config['content'],
      },
    };
  } catch (err) {
    console.error('Error fetching explorer config:', err);
    return {
      props: {
        ...(await getNavPageLayoutPropsFromConfig()),
        explorerConfig: null, // Changed from undefined to null
      },
    };
  }
};

export default CohortBuilderPage;
