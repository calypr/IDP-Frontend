import '@gen3/core';

declare module '@gen3/core' {
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

  export interface SyfonBucketMetadata {
    bucket?: string;
    endpoint_url?: string;
    programs?: Array<string>;
    provider?: string;
    region?: string;
  }

  export interface SyfonBucketsResponse {
    S3_BUCKETS: Record<string, SyfonBucketMetadata>;
  }

  export interface SyfonBucket {
    bucket?: string;
    endpointUrl?: string;
    name: string;
    programs: Array<string>;
    provider?: string;
    region?: string;
    resources: Array<string>;
  }

  export interface SyfonSignedUrlResponse {
    url?: string;
  }

  export interface SyfonMultipartInitResponse {
    guid?: string;
    uploadId?: string;
  }

  export interface SyfonMultipartUploadUrlResponse {
    presigned_url?: string;
  }

  export interface SyfonMultipartPart {
    ETag: string;
    PartNumber: number;
  }

  export interface SyfonCreateUploadUrlArgs {
    bucket: string;
    expiresIn?: number;
    fileId: string;
    fileName?: string;
  }

  export interface SyfonUpsertBucketCredentialArgs {
    access_key?: string;
    bucket: string;
    endpoint?: string;
    organization: string;
    path?: string;
    project_id: string;
    provider?: string;
    region?: string;
    secret_key?: string;
  }

  export interface SyfonAddBucketScopeArgs {
    bucket: string;
    organization: string;
    path?: string;
    project_id: string;
  }

  export interface SyfonDeleteBucketScopeArgs {
    bucket: string;
    organization: string;
    project_id: string;
  }

  export interface SyfonDeleteProjectArgs {
    organization: string;
    project_id: string;
  }

  export interface SyfonDeleteProjectResponse {
    organization: string;
    project_id: string;
    deleted_objects: number;
    deleted_bucket_scopes: number;
  }

  export interface SyfonDrsObjectCandidate {
    access_methods?: Array<SyfonAccessMethod>;
    aliases?: Array<string>;
    checksums: Array<SyfonChecksum>;
    controlled_access?: Array<string>;
    mime_type?: string;
    name?: string;
    size: number;
  }

  export interface SyfonRegisterDrsObjectsRequest {
    candidates: Array<SyfonDrsObjectCandidate>;
  }

  export interface SyfonDrsObjectsByChecksumResponse {
    resolved_drs_object?: Array<SyfonDrsObject>;
  }

  export interface SyfonIndexRecord {
    access_methods?: Array<SyfonAccessMethod>;
    controlled_access?: Array<string>;
    created_time?: string;
    description?: string;
    did: string;
    file_name?: string;
    hashes?: Record<string, string>;
    id?: string;
    mime_type?: string;
    name?: string;
    organization?: string;
    project?: string;
    size?: number;
    updated_time?: string;
    version?: string;
  }

  export interface SyfonIndexDirectory {
    name: string;
    path: string;
  }

  export interface GetSyfonIndexRecordsArgs {
    readonly organization: string;
    readonly project: string;
    readonly limit?: number;
    readonly page?: number;
    readonly start?: string;
    readonly path?: string;
  }

  export interface SyfonIndexBrowseResponse {
    readonly directories: Array<SyfonIndexDirectory>;
    readonly records: Array<SyfonIndexRecord>;
  }

  export function createSyfonObjectKey(
    fileName: string,
    bucketPath?: string,
  ): string;
  export function normalizeSyfonBuckets(
    response: SyfonBucketsResponse | Record<string, SyfonBucketMetadata>,
  ): Array<SyfonBucket>;
  export function normalizeSyfonResourcePath(resource: string): string;
  export function buildSyfonCanonicalObjectUrl(
    bucket: string,
    objectKey: string,
    provider?: string,
  ): string;
  export function getSyfonAccessMethodType(provider?: string): string;
  export function shouldUseSyfonMultipartUpload(fileSize: number): boolean;
  export const SYFON_DEFAULT_MULTIPART_CONCURRENCY: number;
  export function getSyfonOptimalMultipartChunkSize(fileSize: number): number;
  export function buildSyfonFileUploadMetadata(file: File): Promise<{
    checksums: Array<SyfonChecksum>;
    mimeType: string;
    name: string;
    sha256: string;
    size: number;
  }>;
  export function mintSyfonObjectIdFromChecksum(
    checksum: string,
    controlledAccess: Array<string>,
  ): Promise<string>;
  export function useListSyfonBucketsQuery(
    arg?: void,
    options?: { skip?: boolean },
  ): {
    data?: SyfonBucketsResponse;
    isLoading: boolean;
    refetch: () => Promise<unknown>;
  };
  export function useUpsertSyfonBucketCredentialMutation(): [
    (
      args: SyfonUpsertBucketCredentialArgs,
    ) => { unwrap: () => Promise<void> },
    { isLoading: boolean },
  ];
  export function useAddSyfonBucketScopeMutation(): [
    (
      args: SyfonAddBucketScopeArgs,
    ) => { unwrap: () => Promise<void> },
    { isLoading: boolean },
  ];
  export function useDeleteSyfonBucketScopeMutation(): [
    (
      args: SyfonDeleteBucketScopeArgs,
    ) => { unwrap: () => Promise<void> },
    { isLoading: boolean },
  ];
  export function useDeleteSyfonProjectMutation(): [
    (
      args: SyfonDeleteProjectArgs,
    ) => { unwrap: () => Promise<SyfonDeleteProjectResponse> },
    { isLoading: boolean },
  ];
  export function useCreateSyfonUploadUrlMutation(): [
    (
      args: SyfonCreateUploadUrlArgs,
    ) => { unwrap: () => Promise<SyfonSignedUrlResponse> },
  ];
  export function useCreateSyfonMultipartUploadMutation(): [
    (args: {
      bucket?: string;
      fileId: string;
      fileName?: string;
    }) => { unwrap: () => Promise<SyfonMultipartInitResponse> },
  ];
  export function useCreateSyfonMultipartPartUploadUrlMutation(): [
    (args: {
      bucket?: string;
      fileId: string;
      partNumber: number;
      uploadId: string;
    }) => { unwrap: () => Promise<SyfonMultipartUploadUrlResponse> },
  ];
  export function useCompleteSyfonMultipartUploadMutation(): [
    (args: {
      bucket?: string;
      fileId: string;
      parts: Array<SyfonMultipartPart>;
      uploadId: string;
    }) => { unwrap: () => Promise<void> },
  ];
  export function useRegisterSyfonDrsObjectsMutation(): [
    (
      args: SyfonRegisterDrsObjectsRequest,
    ) => { unwrap: () => Promise<{ objects: Array<SyfonDrsObject> }> },
  ];
  export function useDeleteSyfonDrsObjectMutation(): [
    (
      objectId: string,
    ) => { unwrap: () => Promise<void> },
  ];
  export function useLazyGetSyfonDownloadUrlQuery(): [
    (
      objectId: string,
    ) => { unwrap: () => Promise<SyfonSignedUrlResponse> },
  ];
  export function useGetSyfonObjectsByChecksumQuery(
    checksum: string,
    options?: { skip?: boolean },
  ): {
    data?: SyfonDrsObjectsByChecksumResponse;
    isFetching: boolean;
    isLoading: boolean;
  };
  export function useLazyGetSyfonObjectsByChecksumQuery(): [
    (
      checksum: string,
    ) => { unwrap: () => Promise<SyfonDrsObjectsByChecksumResponse> },
  ];
  export function useGetSyfonIndexRecordsQuery(
    args: GetSyfonIndexRecordsArgs,
    options?: { skip?: boolean },
  ): {
    data?: SyfonIndexBrowseResponse;
    isFetching: boolean;
    isLoading: boolean;
  };
}

export {};
