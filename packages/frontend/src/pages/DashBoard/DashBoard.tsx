import { Text, MantineProvider } from '@mantine/core';
import { DashBoardPageProps } from './types';

const DashBoardPage = ({
  headerProps,
  footerProps,
  dashboardProps,
}: DashBoardPageProps) => {
  return (
    <MantineProvider withGlobalClasses>
      <div className="flex items-center gap-2">
        <Text> Dash Board Goes Here</Text>
      </div>
    </MantineProvider>
  );
};

export default DashBoardPage;
