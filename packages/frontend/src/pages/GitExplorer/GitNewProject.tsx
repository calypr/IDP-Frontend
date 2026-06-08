import React, { useMemo } from 'react';
import { useRouter } from 'next/router';
import { useGetAuthzMappingsQuery } from '@gen3/core';
import ProtectedContent from '../../components/Protected/ProtectedContent';
import { NavPageLayout } from '../../features/Navigation';
import { CreateProjectModal } from './GitLanding';
import type { GitExplorerPageProps } from './types';

const isOrganizationMembershipResource = (
  resourcePath: string,
): { organization: string } | null => {
  const parts = resourcePath.split('/').filter(Boolean);
  if (parts[0] !== 'programs' || !parts[1]) {
    return null;
  }

  if (parts.length === 2) {
    return { organization: parts[1] };
  }

  if (parts.length === 3 && parts[2] === 'projects') {
    return { organization: parts[1] };
  }

  return null;
};

const isOrganizationMemberOrOwnerAction = (action: {
  readonly method: string;
  readonly service: string;
}): boolean =>
  action.service === 'arborist' &&
  (action.method === 'create-descendant' || action.method === 'manage-owners');

const GitNewProjectPage = ({
  headerProps,
  footerProps,
}: GitExplorerPageProps) => {
  const router = useRouter();
  const { data: authzMapping = {} } = useGetAuthzMappingsQuery();
  const selectedOrganization =
    typeof router.query.org === 'string' ? router.query.org : '';

  const membershipOrganizationOptions = useMemo(() => {
    const organizations = new Set<string>();
    Object.entries(authzMapping).forEach(([resource, perms]) => {
      const membershipResource = isOrganizationMembershipResource(resource);
      if (!membershipResource || !Array.isArray(perms)) {
        return;
      }
      if (perms.some(isOrganizationMemberOrOwnerAction)) {
        organizations.add(membershipResource.organization);
      }
    });
    return Array.from(organizations).sort((left, right) =>
      left.localeCompare(right),
    );
  }, [authzMapping]);

  const goBackToGit = () => {
    void router.push('/git');
  };

  return (
    <NavPageLayout
      {...{ headerProps, footerProps }}
      headerMetadata={{
        content: 'Create Gecko project',
        key: 'gecko-git-new-project',
        title: 'Create Project',
      }}
      mainProps={{ className: 'bg-[#f4f6f8]' }}
    >
      <ProtectedContent>
        <div className="min-h-screen bg-[#f4f6f8] px-4 py-6">
          <CreateProjectModal
            existingOrganizations={membershipOrganizationOptions}
            onClose={goBackToGit}
            onCreated={goBackToGit}
            opened
            organization={selectedOrganization}
            renderInline
          />
        </div>
      </ProtectedContent>
    </NavPageLayout>
  );
};

export default GitNewProjectPage;
