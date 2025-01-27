import { Grid, MantineProvider, Loader } from '@mantine/core';
import { AppsPageProps } from './types';
import { NavPageLayout } from '../../features/Navigation';
import {
  useGetAuthzMappingsQuery,
  userHasMethodForServiceOnResource,
  resourcePathFromProjectID,
} from '@gen3/core';

import AppCard from './AppCard';
import { ProtectedContent } from '../../components/Protected';

const AppsPage = ({ headerProps, footerProps, appsConfig }: AppsPageProps) => {
  const { data: authzMapping = {}, isLoading: isAuthZLoading } =
    useGetAuthzMappingsQuery();

  const content = isAuthZLoading ? (
    <div className="fixed inset-0 flex justify-center items-center bg-gray-700 bg-opacity-50 z-50">
      <Loader size={30} />
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Grid gutter="md" className="p-3">
        {appsConfig?.appCards
          ?.filter(
            (proj) =>
              proj?.perms == null ||
              userHasMethodForServiceOnResource(
                'read',
                '*',
                resourcePathFromProjectID(proj?.perms ?? ''),
                authzMapping,
              ),
          )
          .map((project, index) => (
            <Grid.Col key={index} span={4}>
              <AppCard
                title={project.title}
                description={project.description}
                icon={project.icon}
                href={project.href}
                perms={project.perms}
              />
            </Grid.Col>
          ))}
      </Grid>
    </div>
  );

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerData={{
        title: 'Gen3 Apps Page',
        content: 'Apps',
        key: 'gen3-apps',
      }}
    >
      <ProtectedContent>
        <MantineProvider withGlobalClasses>{content}</MantineProvider>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default AppsPage;
