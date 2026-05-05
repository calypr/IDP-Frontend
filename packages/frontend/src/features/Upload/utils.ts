import {
  SyfonBucket,
  createSyfonObjectKey,
  getSyfonAccessMethodType,
  normalizeSyfonBuckets,
  normalizeSyfonResourcePath,
} from '@gen3/core';
import { UploadScopeOption } from './types';

export const normalizeUploadSubdirectory = (
  subdirectory: string | undefined,
): string => subdirectory?.trim().replace(/^\/+|\/+$/g, '') ?? '';

export const createUploadItemId = (file: File, index: number): string =>
  `${file.name}-${file.size}-${file.lastModified}-${index}`;

export interface UploadScopeLabel {
  organization?: string;
  project?: string;
}

export const deriveScopeLabelFromResource = (
  resourcePath: string,
): UploadScopeLabel => {
  const normalized = normalizeSyfonResourcePath(resourcePath);
  const segments = normalized.split('/').filter(Boolean);

  if (segments[0] !== 'organization' || !segments[1]) {
    return {};
  }

  if (segments[2] === 'project' && segments[3]) {
    return {
      organization: segments[1],
      project: segments[3],
    };
  }

  return {
    organization: segments[1],
  };
};

export const buildUploadObjectKey = (
  fileName: string,
  subdirectory?: string,
): string => createSyfonObjectKey(fileName, normalizeUploadSubdirectory(subdirectory));

export const buildControlledAccessForUpload = (
  organization: string | undefined,
  project: string | undefined,
): Array<string> => {
  const normalizedOrganization = organization?.trim();
  const normalizedProject = project?.trim();
  if (normalizedOrganization && normalizedProject) {
    return [
      `/organization/${normalizedOrganization}/project/${normalizedProject}`,
    ];
  }

  if (normalizedOrganization) {
    return [`/organization/${normalizedOrganization}`];
  }

  return ['/data_file'];
};

export const buildUploadOrganizationOptions = (
  rawBuckets: Parameters<typeof normalizeSyfonBuckets>[0] | undefined,
): Array<UploadScopeOption> => {
  const seen = new Set<string>();
  return normalizeSyfonBuckets(rawBuckets ?? { S3_BUCKETS: {} })
    .flatMap((bucket) => bucket.resources)
    .map((resource) => deriveScopeLabelFromResource(resource).organization)
    .filter((organization): organization is string => !!organization)
    .filter((organization) => {
      if (seen.has(organization)) return false;
      seen.add(organization);
      return true;
    })
    .sort((left, right) => left.localeCompare(right))
    .map((organization) => ({
      label: organization,
      value: organization,
    }));
};

export const buildUploadProjectOptions = (
  rawBuckets: Parameters<typeof normalizeSyfonBuckets>[0] | undefined,
  organization: string | undefined,
): Array<UploadScopeOption> => {
  if (!organization) return [];

  const seen = new Set<string>();
  return normalizeSyfonBuckets(rawBuckets ?? { S3_BUCKETS: {} })
    .flatMap((bucket) => bucket.resources)
    .map((resource) => deriveScopeLabelFromResource(resource))
    .filter((scope) => scope.organization === organization && !!scope.project)
    .map((scope) => scope.project as string)
    .filter((project) => {
      if (seen.has(project)) return false;
      seen.add(project);
      return true;
    })
    .sort((left, right) => left.localeCompare(right))
    .map((project) => ({
      label: project,
      value: project,
    }));
};

export const resolveUploadBucketName = (
  rawBuckets: Parameters<typeof normalizeSyfonBuckets>[0] | undefined,
  organization: string,
  project?: string,
): SyfonBucket => {
  const normalizedBuckets = normalizeSyfonBuckets(rawBuckets ?? { S3_BUCKETS: {} });
  const projectResource = project
    ? `/organization/${organization}/project/${project}`
    : '';
  const organizationResource = `/organization/${organization}`;

  if (projectResource) {
    const projectMatches = normalizedBuckets.filter((bucket) =>
      bucket.resources.includes(projectResource),
    );
    if (projectMatches.length === 1) {
      return projectMatches[0];
    }
    if (projectMatches.length > 1) {
      throw new Error(
        `Multiple Syfon buckets matched project scope ${organization}/${project}`,
      );
    }
  }

  const organizationMatches = normalizedBuckets.filter((bucket) =>
    bucket.resources.includes(organizationResource),
  );
  if (organizationMatches.length === 1) {
    return organizationMatches[0];
  }
  if (organizationMatches.length > 1) {
    throw new Error(
      `Multiple Syfon buckets matched organization scope ${organization}`,
    );
  }

  throw new Error(
    project
      ? `No Syfon bucket matched scope ${organization}/${project}`
      : `No Syfon bucket matched organization ${organization}`,
  );
};

export const getUploadAccessMethodType = (bucket: SyfonBucket): string =>
  getSyfonAccessMethodType(bucket.provider);
