import {
  SYFON_API,
  normalizeSyfonResourcePath,
  type SyfonIndexRecord,
} from '@gen3/core';
import { deriveScopeLabelFromResource } from '../../features/Upload/utils';
import type {
  AccessibleOrganizationProject,
  OrganizationGroup,
  RepoListingEntry,
  SyfonRepoFile,
} from './types';

const compareByName = (left: string, right: string): number =>
  left.localeCompare(right, undefined, { sensitivity: 'base' });

const normalizePathSegments = (value: string): Array<string> =>
  value
    .split('/')
    .map((segment) => decodeURIComponent(segment).trim())
    .filter(Boolean);

const buildFallbackFileName = (record: SyfonIndexRecord): string =>
  record.file_name?.trim() || record.name?.trim() || record.did;

const getPreferredRootLevelFileName = (
  record: SyfonIndexRecord,
): string | undefined =>
  record.file_name?.trim() || record.name?.trim() || undefined;

const getPathLikeField = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || !trimmed.includes('/')) return undefined;
  return trimmed.replace(/^\/+/, '');
};

const getStableFileNameFromAccessMethod = (
  record: SyfonIndexRecord,
): string | undefined => {
  const firstUrl = record.access_methods?.[0]?.access_url?.url?.trim();
  if (!firstUrl) return undefined;

  try {
    const parsedUrl = new URL(firstUrl);
    const segments = normalizePathSegments(parsedUrl.pathname);
    return segments[segments.length - 1];
  } catch {
    return undefined;
  }
};

export const buildExactProjectScope = (
  organization: string,
  project: string,
): string =>
  normalizeSyfonResourcePath(`/organization/${organization}/project/${project}`);

export const extractAccessibleProjects = (
  authzMapping: Record<string, unknown>,
): Array<AccessibleOrganizationProject> => {
  const uniqueProjects = new Map<string, AccessibleOrganizationProject>();

  Object.keys(authzMapping).forEach((resourcePath) => {
    const scope = deriveScopeLabelFromResource(resourcePath);
    if (!scope.organization || !scope.project) return;

    const normalized = buildExactProjectScope(scope.organization, scope.project);
    uniqueProjects.set(normalized, {
      organization: scope.organization,
      project: scope.project,
      resourcePath: normalized,
    });
  });

  return Array.from(uniqueProjects.values()).sort((left, right) => {
    const organizationComparison = compareByName(
      left.organization,
      right.organization,
    );

    if (organizationComparison !== 0) {
      return organizationComparison;
    }

    return compareByName(left.project, right.project);
  });
};

export const groupProjectsByOrganization = (
  projects: Array<AccessibleOrganizationProject>,
): Array<OrganizationGroup> => {
  const groups = new Map<string, Array<AccessibleOrganizationProject>>();

  projects.forEach((project) => {
    const group = groups.get(project.organization) ?? [];
    group.push(project);
    groups.set(project.organization, group);
  });

  return Array.from(groups.entries())
    .sort(([left], [right]) => compareByName(left, right))
    .map(([organization, groupedProjects]) => ({
      organization,
      projects: groupedProjects.sort((left, right) =>
        compareByName(left.project, right.project),
      ),
    }));
};

export const normalizeSyfonIndexRecordToRepoFile = (
  record: SyfonIndexRecord,
): SyfonRepoFile => {
  const pathCandidate =
    getPathLikeField(record.file_name) ??
    getPathLikeField(record.name) ??
    getPreferredRootLevelFileName(record) ??
    getStableFileNameFromAccessMethod(record) ??
    buildFallbackFileName(record);

  const pathSegments = normalizePathSegments(pathCandidate);
  const canonicalFilename =
    pathSegments.join('/') || buildFallbackFileName(record);
  const displayName =
    record.name?.trim() ||
    pathSegments[pathSegments.length - 1] ||
    buildFallbackFileName(record);

  return {
    accessMethods: record.access_methods ?? [],
    canonicalFilename,
    checksums: record.hashes ?? {},
    controlledAccess: (record.controlled_access ?? []).map((resource: string) =>
      normalizeSyfonResourcePath(resource),
    ),
    createdTime: record.created_time,
    description: record.description,
    did: record.did,
    displayName,
    mimeType: record.mime_type,
    pathSegments:
      pathSegments.length > 0 ? pathSegments : [buildFallbackFileName(record)],
    record,
    size: record.size,
    updatedTime: record.updated_time,
    version: record.version,
  };
};

const hasPathPrefix = (
  candidate: Array<string>,
  prefix: Array<string>,
): boolean =>
  prefix.every((segment, index) => candidate[index] === segment);

export const buildRepoListingEntries = (
  files: Array<SyfonRepoFile>,
  currentPath: Array<string>,
): Array<RepoListingEntry> => {
  const directories = new Map<
    string,
    { itemCount: number; name: string; pathSegments: Array<string> }
  >();
  const visibleFiles: Array<RepoListingEntry> = [];

  files.forEach((file) => {
    if (!hasPathPrefix(file.pathSegments, currentPath)) {
      return;
    }

    const remainingSegments = file.pathSegments.slice(currentPath.length);
    if (remainingSegments.length === 1) {
      visibleFiles.push({
        file,
        name: file.displayName,
        type: 'file',
      });
      return;
    }

    const directoryName = remainingSegments[0];
    const directorySegments = [...currentPath, directoryName];
    const key = directorySegments.join('/');
    const existing = directories.get(key);

    if (existing) {
      existing.itemCount += 1;
      return;
    }

    directories.set(key, {
      itemCount: 1,
      name: directoryName,
      pathSegments: directorySegments,
    });
  });

  const directoryEntries: Array<RepoListingEntry> = Array.from(
    directories.values(),
  )
    .sort((left, right) => compareByName(left.name, right.name))
    .map((directory) => ({
      ...directory,
      type: 'directory' as const,
    }));

  const fileEntries = visibleFiles.sort((left, right) =>
    compareByName(left.name, right.name),
  );

  return [...directoryEntries, ...fileEntries];
};

export const parsePathQueryValue = (
  value: string | Array<string> | undefined,
): Array<string> => {
  if (Array.isArray(value)) {
    return normalizePathSegments(value.join('/'));
  }

  if (typeof value !== 'string') {
    return [];
  }

  return normalizePathSegments(value);
};

export const getSyfonRepoDownloadUrl = (did: string): string =>
  `${SYFON_API}/download/${did}?redirect=true`;

export const truncateDescription = (
  description: string | undefined,
  maxLength = 80,
): string | undefined => {
  if (!description) return undefined;
  if (description.length <= maxLength) return description;
  return `${description.slice(0, maxLength - 1).trimEnd()}...`;
};
