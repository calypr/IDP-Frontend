export interface AuthzAction {
  readonly method: string;
  readonly service: string;
}

export const actionMatches = (
  action: AuthzAction,
  service: string,
  method: string,
): boolean =>
  (action.service === service || action.service === '*') &&
  (action.method === method || action.method === '*');

export const hasProjectMembershipOrAccess = (
  authzMapping: Record<string, Array<AuthzAction>>,
  organization: string,
  project: string,
): boolean => {
  const projectPath = `/programs/${organization}/projects/${project}`;
  return (authzMapping[projectPath] ?? []).some((action) =>
    actionMatches(action, 'arborist', 'read'),
  );
};

export const hasOrganizationMembership = (
  authzMapping: Record<string, Array<AuthzAction>>,
  organization: string,
): boolean => {
  const candidatePaths = [
    `/programs/${organization}/projects`,
    `/programs/${organization}`,
  ];

  return candidatePaths.some((path) =>
    (authzMapping[path] ?? []).some(
      (action) =>
        action.service === 'arborist' &&
        (action.method === 'create-descendant' ||
          action.method === 'manage-owners' ||
          action.method === '*'),
    ),
  );
};
