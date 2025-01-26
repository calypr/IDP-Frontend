import { Grid, MantineProvider } from '@mantine/core';
import { AppsPageProps } from './types';
import { NavPageLayout } from '../../features/Navigation';

import AppCard from './AppCard';

const AppsPage = ({ headerProps, footerProps, appsConfig }: AppsPageProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Apps Page',
        content: 'Apps',
        key: 'gen3-apps',
      }}
    >
      <MantineProvider withGlobalClasses>
        <div className="flex items-center gap-2">
          <Grid gutter="md" className="p-3">
            {appsConfig?.appCards?.map((project, index) => (
              <Grid.Col key={index} span={4}>
                <AppCard
                  title={project.title}
                  description={project.description}
                  icon={project.icon}
                  href={project.href}
                />
              </Grid.Col>
            ))}
          </Grid>
        </div>
      </MantineProvider>
    </NavPageLayout>
  );
};

export default AppsPage;
