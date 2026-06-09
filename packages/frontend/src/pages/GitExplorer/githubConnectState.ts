export const gitHubPendingProjectConnectKey =
  'gecko:git-pending-project-connect';

export type PendingProjectConnect = {
  readonly organization: string;
  readonly project: string;
  readonly repositoryFullName: string;
};

export const savePendingProjectConnect = (
  pending: PendingProjectConnect,
): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(
    gitHubPendingProjectConnectKey,
    JSON.stringify({
      organization: pending.organization,
      project: pending.project,
      repositoryFullName: pending.repositoryFullName,
      timestamp: Date.now(),
    }),
  );
};

export const loadPendingProjectConnect = (): PendingProjectConnect | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(gitHubPendingProjectConnectKey);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as {
      organization?: string;
      project?: string;
      repositoryFullName?: string;
    };
    if (
      typeof parsed.organization !== 'string' ||
      typeof parsed.project !== 'string' ||
      typeof parsed.repositoryFullName !== 'string'
    ) {
      return null;
    }
    const organization = parsed.organization.trim();
    const project = parsed.project.trim();
    const repositoryFullName = parsed.repositoryFullName.trim();
    if (!organization || !project || !repositoryFullName) {
      return null;
    }
    return { organization, project, repositoryFullName };
  } catch {
    return null;
  }
};

export const clearPendingProjectConnect = (): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(gitHubPendingProjectConnectKey);
};
