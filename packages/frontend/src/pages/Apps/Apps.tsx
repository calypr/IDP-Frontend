import React, { useState } from 'react';
import { MantineProvider, Loader, Alert } from '@mantine/core';
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
import EqualHeightCards from './EqualHeightCards';
import { useHasAccess } from '../../components/Protected/NoAccessOverlay';

export function SummaryStatsBanner({
  len_access_projects,
  fileCount,
  isLoading,
  isError,
}: {
  len_access_projects: number;
  fileCount: number | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const [visible, setVisible] = useState(true);

  // Don't bother with displaying Banner if query errors out
  if (!visible || isError) return null;

  const message =
    'Welcome to CALYPR! You have access to' +
    ` ${len_access_projects} project${len_access_projects === 1 ? '' : 's'}` +
    ` and ${!isLoading ? fileCount : 0} file${fileCount === 1 ? '' : 's'}`;

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
      onClose={() => setVisible(false)}
      title={message}
    ></Alert>
  );
}

const AppsPage = ({ headerProps, footerProps, appsConfig }: AppsPageProps) => {
  // define the content to be returned
  const { data: authzMapping = {}, isLoading: isAuthZLoading } =
    useGetAuthzMappingsQuery();

  const {
    len_access_projects,
    fileCount,
    isLoading: isFileCountLoading,
    isError: isFileCountError,
  } = useHasAccess(authzMapping);

  const content = (
    <EqualHeightCards>
      <div>
        <div className="flex flex-col">
          <SummaryStatsBanner
            len_access_projects={len_access_projects}
            fileCount={fileCount}
            isLoading={isFileCountLoading}
            isError={isFileCountError}
          />
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
    </EqualHeightCards>
  );

  // return with protected and general page navbar
  return (
    <ProtectedContent>
      <NavPageLayout
        {...{ headerProps, footerProps }}
        headerMetadata={{
          title: 'CALYPR Homepage',
          content: 'Apps',
          key: 'gen3-apps',
        }}
      >
        <MantineProvider withGlobalClasses>{content}</MantineProvider>
      </NavPageLayout>
    </ProtectedContent>
  );
};

export default AppsPage;
