import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import Discovery from '../../features/Discovery/Discovery';
import { DiscoveryPageProps } from './types';
import {
  registerDiscoveryDefaultCellRenderers,
  registerDiscoveryDefaultStudyPreviewRenderers,
} from '../../features/Discovery';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { useSession } from '../../lib/session/session';


registerDiscoveryDefaultCellRenderers();
registerDiscoveryDefaultStudyPreviewRenderers();

export const DiscoveryMainContent = ({
  configuration,
}: Pick<DiscoveryPageProps, 'configuration'>) => {
  const { status, pending } = useSession();
  if (pending || status !== 'issued') {
    return null;
  }
  return configuration ? <Discovery discoveryConfig={configuration} /> : null;
};

const DiscoveryPage = ({
  headerProps,
  footerProps,
  pageProblems,
  configuration,
}: DiscoveryPageProps): JSX.Element => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Discovery Page',
        content: 'Discovery Data',
        key: 'gen3-discovery-page',
        ...(configuration?.headerMetadata
          ? configuration.headerMetadata
          : {}),
      }}
    >
      <ProtectedContent>
        <DiscoveryMainContent configuration={configuration} />
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default DiscoveryPage;
