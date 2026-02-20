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

export function SummaryStatsBanner(authz: any) {
  const [visible, setVisible] = useState(true);
  const { data, isLoading, isError } = useFileTotalCountQuery();

  // Don't bother with displaying Banner if query errors out
  if (!visible || isError) return null;
  const authzMap = authz?.authz ?? {};
  const len_access_projects = Object.entries(authzMap).filter(
    ([resource, perms]) => {
      // normalize and split, remove empty segments so both "/programs/..." and "programs/..." work
      const parts = String(resource).split('/').filter(Boolean);

      // expect ["programs", "<programId>", "projects", "<projectId>"]
      if (parts.length !== 4) return false;
      if (parts[0] !== 'programs' || parts[2] !== 'projects') return false;
      if (!Array.isArray(perms)) return false;

      // require an explicit { method: "read", service: "*" } entry in the perms array
      return perms.some((p: any) => p?.method === 'read' && p?.service === '*');
    },
  ).length;

  const message =
    'Welcome to CALYPR! You have access to' +
    ` ${len_access_projects} project${len_access_projects === 1 ? '' : 's'}` +
    ` and ${!isLoading ? data : 0} file${data === 1 ? '' : 's'}`;

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
  const content = isAuthZLoading ? (
    <div className="fixed inset-0 flex justify-center items-center bg-gray-700 bg-opacity-50 z-50">
      <Loader size={30} />
    </div>
  ) : (
    <EqualHeightCards>
      <div>
        <div className="flex flex-col">
          <SummaryStatsBanner authz={authzMapping} />
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
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'CALYPR Homepage',
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
