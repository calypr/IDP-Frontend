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
    endpoint_url?: string;
    programs?: Array<string>;
    provider?: string;
    region?: string;
  }

  export interface SyfonBucketsResponse {
    S3_BUCKETS: Record<string, SyfonBucketMetadata>;
  }

  export interface SyfonBucket {
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
  export function useListSyfonBucketsQuery(): {
    data?: SyfonBucketsResponse;
    isLoading: boolean;
  };
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
}

export {};
