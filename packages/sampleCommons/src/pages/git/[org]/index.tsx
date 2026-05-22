import React, { type ComponentProps } from 'react';
import { useRouter } from 'next/router';
import {
  GitExplorerPageGetServerSideProps as getServerSideProps,
  GitLandingPage,
} from '@gen3/frontend';

const GitScopedPage = (props: ComponentProps<typeof GitLandingPage>) => {
  const router = useRouter();
  const selectedOrganization =
    typeof router.query.org === 'string' ? router.query.org : undefined;

  return (
    <GitLandingPage
      {...props}
      selectedOrganization={selectedOrganization}
    />
  );
};

export default GitScopedPage;
export { getServerSideProps };
