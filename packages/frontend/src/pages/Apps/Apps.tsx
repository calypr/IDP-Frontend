import { useState } from 'react';
import {
  Grid,
  MantineProvider,
  Loader,
  Alert,
  CloseButton,
  Text,
} from '@mantine/core';
import { AppsPageProps } from './types';
import { NavPageLayout } from '../../features/Navigation';
import {
  useGetAuthzMappingsQuery,
  userHasMethodForServiceOnResource,
  resourcePathFromProjectID,
} from '@gen3/core';

import AppCard from './AppCard';
import { ProtectedContent } from '../../components/Protected';
import { useFileTotalCountQuery } from './fetchFileCounts';

export function SummaryStatsBanner(authz: any) {
  const [visible, setVisible] = useState(true);
  const { data, isLoading, isError } = useFileTotalCountQuery();

  // Don't bother with displaying Banner if query errors out
  if (!visible || isError) return null;
  const len_access_projects = Object.keys(authz.authz).filter(
    (resource) => resource.split('/')?.length === 5,
  ).length;
  return (
    <Alert className="bg-secondary" variant="filled">
      <div className="flex justify-between items-center">
        <Text>
          Welcome to Caliper! You have access to {len_access_projects} project
          {len_access_projects > 1 ? 's' : ''} and{' '}
          {!isLoading ? data + ' ' : 0 + ' '} files
        </Text>
        <CloseButton
          className="bg-base-max"
          onClick={() => setVisible(false)}
        />
      </div>
    </Alert>
  );
}
const AppsPage = ({ headerProps, footerProps, appsConfig }: AppsPageProps) => {
  const { data: authzMapping = {}, isLoading: isAuthZLoading } =
    useGetAuthzMappingsQuery();

  const content = isAuthZLoading ? (
    <div className="fixed inset-0 flex justify-center items-center bg-gray-700 bg-opacity-50 z-50">
      <Loader size={30} />
    </div>
  ) : (
    <div>
      <div className="flex flex-col gap-4 pt-2">
        <SummaryStatsBanner authz={authzMapping} />
        <Alert className="bg-primary" variant="filled">
          <div className="text-3xl text-center font-semibold">Apps</div>
        </Alert>
      </div>
      <div className="grid grid-cols-4 pt-2">
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
            <AppCard
              title={project.title}
              description={project.description}
              icon={project.icon}
              href={project.href}
              perms={project.perms}
            />
          ))}
      </div>
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
