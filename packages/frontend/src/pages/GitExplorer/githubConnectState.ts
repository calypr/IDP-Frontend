export const gitHubPendingProjectConnectKey =
  'gecko:git-pending-project-connect';

export type PendingProjectConnect = {
  readonly organization: string;
  readonly project: string;
  readonly repositoryFullName: string;
};

export const gitHubOwnerFromRepositoryFullName = (
  repositoryFullName?: string | null,
): string | null => {
  if (typeof repositoryFullName !== 'string') {
    return null;
  }
  const trimmed = repositoryFullName.trim().replace(/^https?:\/\/github\.com\//i, '');
  const [owner] = trimmed.split('/', 2);
  const normalizedOwner = owner?.trim();
  return normalizedOwner ? normalizedOwner : null;
};

export const organizationFromGitHubState = (
  githubState?: string | null,
): string | null => {
  if (typeof githubState !== 'string') {
    return null;
  }
  const trimmed = githubState.trim();
  if (!trimmed) {
    return null;
  }
  const withoutQuery = trimmed.split('?', 1)[0] || '';
  const match = withoutQuery.match(/^\/git\/([^/]+)(?:\/|$)/);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
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
