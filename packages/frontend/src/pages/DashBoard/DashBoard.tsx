import { Text, MantineProvider } from '@mantine/core';
import { DashBoardPageProps } from './types';
import { NavPageLayout } from '../../features/Navigation';

import React from 'react';

const DashBoardPage = ({
  headerProps,
  footerProps,
  dashboardConfig,
}: DashBoardPageProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 DashBoard Page',
        content: 'DashBoard',
        key: 'gen3-dashboard',
      }}
    >
      <MantineProvider withGlobalClasses>
        <div className="flex items-center gap-2">
          <Text> Dash Board Goes Here</Text>
        </div>
      </MantineProvider>
    </NavPageLayout>
  );
};

export default DashBoardPage;
