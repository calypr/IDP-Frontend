export interface ProjectStorageOption {
  readonly value: string;
  readonly label: string;
  readonly organization: string;
  readonly project: string;
}

export interface StoragePathRow {
  readonly downloadCount: number;
  readonly fileCount: number;
  readonly lastDownload?: string;
  readonly lastUpdated?: string;
  readonly name: string;
  readonly path: string;
  readonly recordCount: number;
  readonly sizeBytes: number;
  readonly type: 'directory' | 'file';
}

export interface StoragePathSummary {
  readonly childCount: number;
  readonly downloadCount: number;
  readonly fileCount: number;
  readonly hasMore: boolean;
  readonly lastDownload?: string;
  readonly lastUpdated?: string;
  readonly nextCursor?: string;
  readonly path: string;
  readonly recordCount: number;
  readonly rows: Array<StoragePathRow>;
  readonly sizeBytes: number;
  readonly truncated: boolean;
}

export const buildProjectSelectionValue = (
  organization: string,
  project: string,
): string => `${organization}/${project}`;

export const normalizeStoragePath = (value?: string): string =>
  value?.trim().replace(/^\/+|\/+$/g, '') ?? '';

export const splitProjectSelectionValue = (
  value: string,
): { organization: string; project: string } | null => {
  const [organization, ...projectParts] = value.split('/');
  const project = projectParts.join('/').trim();
  if (!organization?.trim() || !project) {
    return null;
  }
  return {
    organization: organization.trim(),
    project,
  };
};

export const sortStorageRows = (
  rows: Array<StoragePathRow>,
): Array<StoragePathRow> =>
  [...rows].sort((left, right) => {
    if (right.sizeBytes !== left.sizeBytes) {
      return right.sizeBytes - left.sizeBytes;
    }
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    });
  });

export const buildProjectOptions = (
  projectSummary: Array<{ organization: string; project: string }>,
): Array<ProjectStorageOption> =>
  [...projectSummary]
    .map((record) => ({
      label: `${record.organization}/${record.project}`,
      organization: record.organization,
      project: record.project,
      value: buildProjectSelectionValue(record.organization, record.project),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
