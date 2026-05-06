export interface SyfonBucketMetadata {
  endpoint_url?: string;
  provider?: string;
  region?: string;
  programs?: Array<string>;
}

export interface SyfonBucketsResponse {
  S3_BUCKETS: Record<string, SyfonBucketMetadata>;
}

export interface SyfonBucket {
  name: string;
  endpointUrl?: string;
  provider?: string;
  region?: string;
  programs: Array<string>;
  resources: Array<string>;
}

export interface SyfonChecksum {
  checksum: string;
  type: string;
}

export interface SyfonAccessUrl {
  url: string;
  headers?: Array<string>;
}

export interface SyfonAccessMethod {
  access_id?: string;
  access_url?: SyfonAccessUrl;
  available?: boolean;
  cloud?: string;
  region?: string;
  type: string;
}

export interface SyfonDrsObject {
  access_methods?: Array<SyfonAccessMethod>;
  aliases?: Array<string>;
  checksums: Array<SyfonChecksum>;
  controlled_access?: Array<string>;
  created_time: string;
  description?: string;
  id: string;
  mime_type?: string;
  name?: string;
  self_uri: string;
  size: number;
  updated_time?: string;
  version?: string;
}

export interface SyfonDrsObjectCandidate {
  access_methods?: Array<SyfonAccessMethod>;
  aliases?: Array<string>;
  checksums: Array<SyfonChecksum>;
  controlled_access?: Array<string>;
  description?: string;
  mime_type?: string;
  name?: string;
  size: number;
  version?: string;
}

export interface SyfonDrsObjectsByChecksumResponse {
  resolved_drs_object?: Array<SyfonDrsObject>;
}

export interface SyfonDrsRegisterResponse {
  objects: Array<SyfonDrsObject>;
}

export interface SyfonSignedUrlResponse {
  url?: string;
}

export interface SyfonMultipartInitArgs {
  bucket?: string;
  fileId: string;
  fileName?: string;
}

export interface SyfonMultipartInitResponse {
  guid?: string;
  uploadId?: string;
}

export interface SyfonMultipartUploadUrlArgs {
  bucket?: string;
  fileId: string;
  partNumber: number;
  uploadId: string;
}

export interface SyfonMultipartUploadUrlResponse {
  presigned_url?: string;
}

export interface SyfonMultipartPart {
  ETag: string;
  PartNumber: number;
}

export interface SyfonCompleteMultipartUploadArgs {
  bucket?: string;
  fileId: string;
  parts: Array<SyfonMultipartPart>;
  uploadId: string;
}

export interface SyfonCreateUploadUrlArgs {
  bucket: string;
  fileId: string;
  fileName?: string;
  expiresIn?: number;
}

export interface SyfonRegisterDrsObjectsRequest {
  candidates: Array<SyfonDrsObjectCandidate>;
}

export interface SyfonFileUploadMetadata {
  checksums: Array<SyfonChecksum>;
  mimeType: string;
  name: string;
  sha256: string;
  size: number;
}

export interface SyfonUploadAndRegisterFileArgs {
  bucket?: string;
  bucketPath?: string;
  description?: string;
  file: File;
  organization: string;
  projectId: string;
}

export interface SyfonUploadAndRegisterFileResult {
  bucket: string;
  checksum: string;
  downloadUrl?: string;
  drsObject: SyfonDrsObject;
  objectId: string;
  objectKey: string;
  resourcePath: string;
  uploadMethod: 'multipart' | 'singlepart';
  uploadUrl?: string;
  uploadUrls?: Array<string>;
}
