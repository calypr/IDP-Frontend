import React from 'react';
import { NavPageLayout } from '../../features/Navigation';
import { Profile } from '../../features/Profile';
import { ProfileConfig } from '../../components/Profile';
import type { ProfilePageProps } from './data';

const ProfilePage = ({
  headerProps,
  footerProps,
  configuration,
  pageProblems,
}: ProfilePageProps) => {
  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      pageProblems={pageProblems}
      headerMetadata={{
        title: 'Gen3 Profile Page',
        content: 'Profile page',
        key: 'gen3-profile-page',
        ...(configuration?.headerMetadata ? configuration.headerMetadata : {}),
      }}
    >
      <Profile profileConfig={configuration as ProfileConfig} />
    </NavPageLayout>
  );
};

export default ProfilePage;
