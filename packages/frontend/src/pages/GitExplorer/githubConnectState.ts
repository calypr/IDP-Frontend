export const gitHubPendingProjectConnectKey =
  'gecko:git-pending-project-connect';

export type PendingProjectConnect = {
  readonly organization: string;
  readonly project: string;
  readonly previousRepositoryFullName?: string;
  readonly targetRepositoryFullName?: string;
};

export const normalizeRepositoryFullName = (
  repositoryFullName?: string | null,
): string | null => {
  if (typeof repositoryFullName !== 'string') {
    return null;
  }
  const trimmed = repositoryFullName
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');
  const [owner, repo] = trimmed.split('/', 2);
  const normalizedOwner = owner?.trim();
  const normalizedRepo = repo?.trim();
  if (!normalizedOwner || !normalizedRepo) {
    return null;
  }
  return `${normalizedOwner}/${normalizedRepo}`;
};

export const gitHubOwnerFromRepositoryFullName = (
  repositoryFullName?: string | null,
): string | null => {
  const normalized = normalizeRepositoryFullName(repositoryFullName);
  if (!normalized) {
    return null;
  }
  const [owner] = normalized.split('/', 1);
  return owner?.trim() || null;
};

export const repositoryFullNamesEqual = (
  left?: string | null,
  right?: string | null,
): boolean => {
  const normalizedLeft = normalizeRepositoryFullName(left);
  const normalizedRight = normalizeRepositoryFullName(right);
  return Boolean(
    normalizedLeft && normalizedRight && normalizedLeft === normalizedRight,
  );
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
  const previousRepositoryFullName =
    normalizeRepositoryFullName(pending.previousRepositoryFullName) ?? '';
  const targetRepositoryFullName =
    normalizeRepositoryFullName(pending.targetRepositoryFullName) ?? '';
  if (!previousRepositoryFullName && !targetRepositoryFullName) {
    return;
  }
  window.localStorage.setItem(
    gitHubPendingProjectConnectKey,
    JSON.stringify({
      organization: pending.organization,
      project: pending.project,
      previousRepositoryFullName,
      targetRepositoryFullName,
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
      previousRepositoryFullName?: string;
      targetRepositoryFullName?: string;
    };
    if (
      typeof parsed.organization !== 'string' ||
      typeof parsed.project !== 'string'
    ) {
      return null;
    }
    const organization = parsed.organization.trim();
    const project = parsed.project.trim();
    const previousRepositoryFullName =
      normalizeRepositoryFullName(parsed.previousRepositoryFullName) ?? undefined;
    const targetRepositoryFullName =
      normalizeRepositoryFullName(parsed.targetRepositoryFullName) ?? undefined;
    if (
      !organization ||
      !project ||
      (!previousRepositoryFullName && !targetRepositoryFullName)
    ) {
      return null;
    }
    return {
      organization,
      project,
      previousRepositoryFullName,
      targetRepositoryFullName,
    };
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
