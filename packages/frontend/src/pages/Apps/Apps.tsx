import { useState } from 'react';
import {
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

  const message = 'Welcome to CALIPER! You have access to'
    + ` ${len_access_projects} project${len_access_projects === 1 ? '' : 's'}`
    + ` and ${!isLoading ? data : 0} file${data === 1 ? '' : 's'}`;

  return (
    <Alert
      classNames={{
        root: 'rounded-lg mx-8 my-4 py-4',
        wrapper: 'flex items-center',
        title: 'text-base font-normal',
      }}
      color="secondary.0"
      variant="filled"
      withCloseButton
      title={message}
    >
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
      <div className="flex flex-col">
        <SummaryStatsBanner authz={authzMapping} />
        <Alert className="bg-base-max" variant="filled">
          <div className="text-black text-4xl text-center font-semibold">
            Apps
          </div>
        </Alert>
      </div>
      <div className="grid grid-cols-4 gap-6 px-8 my-4 auto-rows-auto">
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
          .map((project) => (
            <AppCard
              key={project.title}
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
