import {
  SyfonBucket,
  SyfonBucketsResponse,
  SyfonChecksum,
  SyfonFileUploadMetadata,
} from './types';

const LEGACY_PROGRAMS_SEGMENT = 'programs';
const LEGACY_PROJECTS_SEGMENT = 'projects';
const CANONICAL_ORGANIZATION_SEGMENT = 'organization';
const CANONICAL_PROJECT_SEGMENT = 'project';
const CALYPR_NAMESPACE_UUID = '468a0e14-baa7-3c83-8e2a-8747811465da';
const S3_PROVIDER = 's3';
const GCS_PROVIDER = 'gcs';
const AZURE_PROVIDER = 'azure';
const FILE_PROVIDER = 'file';
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;
const TB = 1024 * GB;

export const SYFON_SINGLEPART_UPLOAD_SIZE_LIMIT = 5 * GB;
export const SYFON_MULTIPART_UPLOAD_SIZE_LIMIT = 5 * TB;
export const SYFON_MIN_MULTIPART_CHUNK_SIZE = 10 * MB;
export const SYFON_MAX_MULTIPART_PARTS = 10000;
export const SYFON_DEFAULT_MULTIPART_CONCURRENCY = 4;

const scaleLinear = (
  size: number,
  minSize: number,
  maxSize: number,
  minChunk: number,
  maxChunk: number,
): number => {
  if (size <= minSize) return minChunk;
  if (size >= maxSize) return maxChunk;

  const ratio = (size - minSize) / (maxSize - minSize);
  const chunk = minChunk + ratio * (maxChunk - minChunk);
  const rounded = Math.floor(chunk / MB) * MB;

  if (rounded < minChunk) return minChunk;
  if (rounded > maxChunk) return maxChunk;
  return rounded;
};

export const shouldUseSyfonMultipartUpload = (
  fileSize: number,
): boolean => fileSize >= SYFON_SINGLEPART_UPLOAD_SIZE_LIMIT;

export const getSyfonOptimalMultipartChunkSize = (
  fileSize: number,
): number => {
  if (fileSize <= 0) {
    return 1 * MB;
  }

  if (fileSize <= 100 * MB) {
    return fileSize;
  }

  if (fileSize <= 1 * GB) {
    return 10 * MB;
  }

  if (fileSize <= 10 * GB) {
    return scaleLinear(fileSize, 1 * GB, 10 * GB, 25 * MB, 128 * MB);
  }

  if (fileSize <= 100 * GB) {
    return 256 * MB;
  }

  return scaleLinear(fileSize, 100 * GB, 1000 * GB, 512 * MB, 1024 * MB);
};

export const normalizeSyfonProvider = (provider?: string): string => {
  const normalized = provider?.trim().toLowerCase();
  switch (normalized) {
    case 'gs':
    case GCS_PROVIDER:
      return GCS_PROVIDER;
    case 'azblob':
    case AZURE_PROVIDER:
      return AZURE_PROVIDER;
    case FILE_PROVIDER:
      return FILE_PROVIDER;
    case S3_PROVIDER:
    case 'aws':
    case undefined:
    case '':
      return S3_PROVIDER;
    default:
      return normalized;
  }
};

export const getSyfonStorageScheme = (provider?: string): string => {
  switch (normalizeSyfonProvider(provider)) {
    case GCS_PROVIDER:
      return 'gs';
    case AZURE_PROVIDER:
      return 'azblob';
    case FILE_PROVIDER:
      return 'file';
    default:
      return 's3';
  }
};

export const getSyfonAccessMethodType = (provider?: string): string => {
  switch (normalizeSyfonProvider(provider)) {
    case GCS_PROVIDER:
      return 'gs';
    case AZURE_PROVIDER:
      return 'azblob';
    case FILE_PROVIDER:
      return 'file';
    default:
      return 's3';
  }
};

export const normalizeSyfonResourcePath = (resource: string): string => {
  const trimmed = resource.trim();

  if (!trimmed) return '';

  if (!trimmed.includes('/')) {
    return `/${CANONICAL_ORGANIZATION_SEGMENT}/${trimmed}`;
  }

  let path = trimmed;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      path = trimmed;
    }
  }

  const segments = path
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean);

  if (segments.length === 0) return '';

  const [head, organization, relation, projectId] = segments;

  if (
    (head === CANONICAL_ORGANIZATION_SEGMENT || head === 'organizations') &&
    organization
  ) {
    if (
      (relation === CANONICAL_PROJECT_SEGMENT || relation === 'projects') &&
      projectId
    ) {
      return `/${CANONICAL_ORGANIZATION_SEGMENT}/${organization}/${CANONICAL_PROJECT_SEGMENT}/${projectId}`;
    }

    return `/${CANONICAL_ORGANIZATION_SEGMENT}/${organization}`;
  }

  if (
    (head === 'program' || head === LEGACY_PROGRAMS_SEGMENT) &&
    organization
  ) {
    if (
      (relation === LEGACY_PROJECTS_SEGMENT ||
        relation === CANONICAL_PROJECT_SEGMENT) &&
      projectId
    ) {
      return `/${CANONICAL_ORGANIZATION_SEGMENT}/${organization}/${CANONICAL_PROJECT_SEGMENT}/${projectId}`;
    }

    return `/${CANONICAL_ORGANIZATION_SEGMENT}/${organization}`;
  }

  return path.startsWith('/') ? path : `/${path}`;
};

export const normalizeSyfonResourcePaths = (
  resources: Array<string> | undefined,
): Array<string> => {
  const unique = new Set<string>();

  for (const resource of resources ?? []) {
    const normalized = normalizeSyfonResourcePath(resource);
    if (normalized) unique.add(normalized);
  }

  return Array.from(unique);
};

export const createSyfonResourcePath = (
  organization: string,
  projectId?: string,
): string => {
  const org = organization.trim();
  const project = projectId?.trim();

  if (!org) {
    throw new Error('organization is required');
  }

  if (!project) {
    return `/${CANONICAL_ORGANIZATION_SEGMENT}/${org}`;
  }

  return `/${CANONICAL_ORGANIZATION_SEGMENT}/${org}/${CANONICAL_PROJECT_SEGMENT}/${project}`;
};

export const normalizeSyfonBuckets = (
  response: SyfonBucketsResponse | Record<string, SyfonBucketMetadataLike>,
): Array<SyfonBucket> => {
  const rawBuckets =
    'S3_BUCKETS' in response ? response.S3_BUCKETS : response;

  return Object.entries(rawBuckets).map(([name, metadata]) => ({
    bucket: metadata.bucket ?? name,
    name: metadata.bucket ?? name,
    endpointUrl: metadata.endpoint_url,
    programs: metadata.programs ?? [],
    provider: metadata.provider,
    region: metadata.region,
    resources: normalizeSyfonResourcePaths(metadata.programs),
  }));
};

interface SyfonBucketMetadataLike {
  bucket?: string;
  endpoint_url?: string;
  programs?: Array<string>;
  provider?: string;
  region?: string;
}

export const resolveSyfonBucketForScope = (
  buckets: Array<SyfonBucket>,
  {
    organization,
    projectId,
  }: {
    organization: string;
    projectId: string;
  },
): SyfonBucket => {
  const projectResource = createSyfonResourcePath(organization, projectId);
  const orgResource = createSyfonResourcePath(organization);

  const exactMatches = buckets.filter((bucket) =>
    bucket.resources.includes(projectResource),
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }
  if (exactMatches.length > 1) {
    throw new Error(
      `Multiple Syfon buckets matched project scope ${organization}/${projectId}`,
    );
  }

  const orgMatches = buckets.filter((bucket) =>
    bucket.resources.includes(orgResource),
  );
  if (orgMatches.length === 1) {
    return orgMatches[0];
  }
  if (orgMatches.length > 1) {
    throw new Error(
      `Multiple Syfon buckets matched organization scope ${organization}`,
    );
  }

  throw new Error(
    `No Syfon bucket matched scope ${organization}/${projectId}`,
  );
};

export const createSyfonObjectKey = (
  fileName: string,
  bucketPath?: string,
): string => {
  const sanitizedPath = bucketPath?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  return sanitizedPath ? `${sanitizedPath}/${fileName}` : fileName;
};

const parseUuid = (value: string): Uint8Array => {
  const bytes = value.replace(/-/g, '');
  return Uint8Array.from(
    bytes.match(/.{1,2}/g)?.map((part) => parseInt(part, 16)) ?? [],
  );
};

const formatUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
};

export const mintSyfonObjectIdFromChecksum = async (
  checksum: string,
  controlledAccess: Array<string>,
): Promise<string> => {
  const normalizedResources = normalizeSyfonResourcePaths(controlledAccess);
  if (normalizedResources.length === 0) {
    throw new Error('controlledAccess must contain at least one scope');
  }

  const seed = `sha256:${checksum}|${normalizedResources[0]}`;
  const namespaceBytes = parseUuid(CALYPR_NAMESPACE_UUID);
  const seedBytes = new TextEncoder().encode(seed);
  const input = new Uint8Array(namespaceBytes.length + seedBytes.length);
  input.set(namespaceBytes);
  input.set(seedBytes, namespaceBytes.length);

  const digest = new Uint8Array(await crypto.subtle.digest('SHA-1', input));
  digest[6] = (digest[6] & 0x0f) | 0x50;
  digest[8] = (digest[8] & 0x3f) | 0x80;

  return formatUuid(digest.slice(0, 16));
};

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

export const buildSyfonChecksum = async (file: File): Promise<SyfonChecksum> => {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return {
    checksum: toHex(new Uint8Array(digest)),
    type: 'sha256',
  };
};

export const buildSyfonFileUploadMetadata = async (
  file: File,
): Promise<SyfonFileUploadMetadata> => {
  const checksum = await buildSyfonChecksum(file);
  return {
    checksums: [checksum],
    mimeType: file.type || 'application/octet-stream',
    name: file.name,
    sha256: checksum.checksum,
    size: file.size,
  };
};

export const buildSyfonCanonicalObjectUrl = (
  bucket: string,
  objectKey: string,
  provider?: string,
): string => {
  const key = objectKey.replace(/^\/+/, '');
  return `${getSyfonStorageScheme(provider)}://${bucket}/${key}`;
};
