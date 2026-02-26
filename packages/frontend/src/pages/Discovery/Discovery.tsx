import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import Discovery from '../../features/Discovery/Discovery';
import { DiscoveryPageProps } from './types';
import {
  registerDiscoveryDefaultCellRenderers,
  registerDiscoveryDefaultStudyPreviewRenderers,
} from '../../features/Discovery';
import { Center } from '@mantine/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { useSession } from '../../lib/session/session';


registerDiscoveryDefaultCellRenderers();
registerDiscoveryDefaultStudyPreviewRenderers();

export const DiscoveryMainContent = ({ discoveryConfig }: any) => {
  const { status, pending } = useSession();
  if (pending || status !== 'issued') {
    return null;
  }
  if (!discoveryConfig) {
    return (
      <Center maw={400} h={100} mx="auto">
        <div>Discovery config is not defined. Page disabled</div>
      </Center>
    );
  }
  return <Discovery discoveryConfig={discoveryConfig} />;
};

const DiscoveryPage = ({
  headerProps,
  footerProps,
  discoveryConfig,
  errorStatus,
}: DiscoveryPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        title: 'Gen3 Discovery Page',
        content: 'Discovery Data',
        key: 'gen3-discovery-page',
        ...(discoveryConfig?.headerMetadata
          ? discoveryConfig.headerMetadata
          : {}),
      }}
    >
      <ProtectedContent errorStatus={errorStatus}>
        <DiscoveryMainContent discoveryConfig={discoveryConfig} />
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default DiscoveryPage;
