import React from 'react';
import { Center, Text, Paper } from '@mantine/core';
import {
  NavPageLayout,
  NavPageLayoutProps,
} from '@gen3/frontend';
import { defineSamplePageLoader } from '@/lib/content/pageLoader';

const SamplePage = ({ headerProps, footerProps, pageProblems }: NavPageLayoutProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Construction Page',
        content: 'Construction Page',
        key: 'gen3-construction-page',
      }}
    >
      <div className="w-full m-10">
        <Center>
          <Paper shadow="md" p="xl" withBorder>
            <Text>This page is under construction.</Text>
          </Paper>
        </Center>
      </div>
    </NavPageLayout>
  );
};

export const getServerSideProps = defineSamplePageLoader('Construction');

export default SamplePage;
