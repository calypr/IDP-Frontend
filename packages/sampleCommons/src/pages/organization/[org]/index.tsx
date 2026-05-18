import type { ComponentProps } from 'react';
import { useRouter } from 'next/router';
import {
  OrganizationExplorerPageGetServerSideProps as getServerSideProps,
  OrganizationLandingPage,
} from '@gen3/frontend';

const OrganizationScopedPage = (props: ComponentProps<typeof OrganizationLandingPage>) => {
  const router = useRouter();
  const selectedOrganization =
    typeof router.query.org === 'string' ? router.query.org : undefined;

  return (
    <OrganizationLandingPage
      {...props}
      selectedOrganization={selectedOrganization}
    />
  );
};

export default OrganizationScopedPage;
export { getServerSideProps };
