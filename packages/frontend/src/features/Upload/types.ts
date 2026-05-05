import { SyfonDrsObject } from '@gen3/core';

export type UploadItemStatus =
  | 'queued'
  | 'hashing'
  | 'uploading'
  | 'registering'
  | 'complete'
  | 'error';

export interface UploadQueueItem {
  error?: string;
  file: File;
  id: string;
  objectId?: string;
  objectKey?: string;
  progress: number;
  status: UploadItemStatus;
  uploadedBytes: number;
  drsObject?: SyfonDrsObject;
}

export interface UploadScopeOption {
  label: string;
  value: string;
}
