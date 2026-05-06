import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type SyfonDrsObject,
  buildSyfonCanonicalObjectUrl,
  buildSyfonFileUploadMetadata,
  getSyfonAccessMethodType,
  isErrorWithMessage,
  isFetchBaseQueryError,
  mintSyfonObjectIdFromChecksum,
  shouldUseSyfonMultipartUpload,
  useCompleteSyfonMultipartUploadMutation,
  useCreateSyfonMultipartPartUploadUrlMutation,
  useCreateSyfonMultipartUploadMutation,
  useCreateSyfonUploadUrlMutation,
  useDeleteSyfonDrsObjectMutation,
  useLazyGetSyfonDownloadUrlQuery,
  useListSyfonBucketsQuery,
  useRegisterSyfonDrsObjectsMutation,
} from '@gen3/core';
import {
  UploadScopeOption,
  UploadItemStatus,
  UploadQueueItem,
} from './types';
import {
  buildControlledAccessForUpload,
  buildUploadObjectKey,
  buildUploadOrganizationOptions,
  buildUploadProjectOptions,
  createUploadItemId,
  resolveUploadBucketName,
} from './utils';
import {
  uploadFileWithProgress,
  uploadMultipartFileWithProgress,
} from './uploadService';

const updateItem = (
  items: Array<UploadQueueItem>,
  id: string,
  patch: Partial<UploadQueueItem>,
): Array<UploadQueueItem> =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

const extractUploadErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (isErrorWithMessage(error) && error.message.trim()) {
    return error.message.trim();
  }

  if (isFetchBaseQueryError(error)) {
    if (typeof error.data === 'string' && error.data.trim()) {
      return error.data.trim();
    }

    if (error.data && typeof error.data === 'object') {
      const data = error.data as {
        detail?: string;
        error?: string;
        message?: string;
      };
      const candidate =
        data.message?.trim() || data.error?.trim() || data.detail?.trim();
      if (candidate) {
        return candidate;
      }
    }

    if ('error' in error && typeof error.error === 'string' && error.error.trim()) {
      return error.error.trim();
    }
  }

  return fallback;
};

interface UploadControllerResult {
  addFiles: (files: Array<File>) => void;
  canStartUpload: boolean;
  clearFinishedItems: () => void;
  hasBuckets: boolean;
  isBucketsLoading: boolean;
  isOrganizationSelectionRequired: boolean;
  isProjectSelectionRequired: boolean;
  isUploading: boolean;
  organizationOptions: Array<UploadScopeOption>;
  projectOptions: Array<UploadScopeOption>;
  queue: Array<UploadQueueItem>;
  downloadItem: (id: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  selectedOrganization: string;
  selectedProject: string;
  setSelectedOrganization: (organization: string) => void;
  setSelectedProject: (project: string) => void;
  setSubdirectory: (subdirectory: string) => void;
  startUpload: () => Promise<void>;
  subdirectory: string;
}

export const useUploadController = (): UploadControllerResult => {
  const [queue, setQueue] = useState<Array<UploadQueueItem>>([]);
  const [selectedOrganization, setSelectedOrganization] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [subdirectory, setSubdirectory] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const { data: rawBuckets, isLoading: isBucketsLoading } =
    useListSyfonBucketsQuery();
  const [createUploadUrl] = useCreateSyfonUploadUrlMutation();
  const [createMultipartUpload] = useCreateSyfonMultipartUploadMutation();
  const [createMultipartPartUploadUrl] =
    useCreateSyfonMultipartPartUploadUrlMutation();
  const [completeMultipartUpload] = useCompleteSyfonMultipartUploadMutation();
  const [deleteDrsObject] = useDeleteSyfonDrsObjectMutation();
  const [getDownloadUrl] = useLazyGetSyfonDownloadUrlQuery();
  const [registerDrsObjects] = useRegisterSyfonDrsObjectsMutation();

  const organizationOptions = useMemo(
    () => buildUploadOrganizationOptions(rawBuckets),
    [rawBuckets],
  );
  const projectOptions = useMemo(
    () => buildUploadProjectOptions(rawBuckets, selectedOrganization),
    [rawBuckets, selectedOrganization],
  );

  useEffect(() => {
    if (organizationOptions.length === 1 && !selectedOrganization) {
      setSelectedOrganization(organizationOptions[0].value);
    }
  }, [organizationOptions, selectedOrganization]);

  useEffect(() => {
    if (projectOptions.length === 1 && !selectedProject) {
      setSelectedProject(projectOptions[0].value);
    }
  }, [projectOptions, selectedProject]);

  const addFiles = useCallback((files: Array<File>) => {
    setQueue((current) => {
      const nextItems = files.map((file, index) => ({
        file,
        id: createUploadItemId(file, current.length + index),
        progress: 0,
        status: 'queued' as UploadItemStatus,
        uploadedBytes: 0,
      }));

      return [...current, ...nextItems];
    });
  }, []);

  const handleSelectedOrganizationChange = useCallback(
    (organization: string) => {
      setSelectedOrganization(organization);
      const projects = buildUploadProjectOptions(rawBuckets, organization);
      if (projects.length === 1) {
        setSelectedProject(projects[0]?.value ?? '');
        return;
      }
      setSelectedProject('');
    },
    [rawBuckets],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (isUploading) return;

      const queueItem = queue.find((item) => item.id === id);
      if (!queueItem) return;

      const objectId = queueItem.drsObject?.id ?? queueItem.objectId;
      if (!objectId) {
        setQueue((current) => current.filter((item) => item.id !== id));
        return;
      }

      try {
        await deleteDrsObject(objectId).unwrap();
        setQueue((current) => current.filter((item) => item.id !== id));
      } catch (error: unknown) {
        const message = extractUploadErrorMessage(
          error,
          'Failed to delete DRS record',
        );
        setQueue((current) =>
          updateItem(current, id, {
            error: message,
            status: 'error',
          }),
        );
      }
    },
    [deleteDrsObject, isUploading, queue],
  );

  const downloadItem = useCallback(
    async (id: string) => {
      const queueItem = queue.find((item) => item.id === id);
      if (!queueItem) return;

      const objectId = queueItem.drsObject?.id ?? queueItem.objectId;
      if (!objectId) return;

      try {
        const response = await getDownloadUrl(objectId).unwrap();
        if (!response.url) {
          throw new Error('Signed download URL was not returned');
        }
        window.open(response.url, '_blank', 'noopener,noreferrer');
      } catch (error: unknown) {
        const message = extractUploadErrorMessage(
          error,
          'Failed to get download URL',
        );
        setQueue((current) =>
          updateItem(current, id, {
            error: message,
            status: 'error',
          }),
        );
      }
    },
    [getDownloadUrl, queue],
  );

  const clearFinishedItems = useCallback(() => {
    if (isUploading) return;
    setQueue((current) =>
      current.filter(
        (item) => item.status !== 'complete' && item.status !== 'error',
      ),
    );
  }, [isUploading]);

  const startUpload = useCallback(async () => {
    const requiresOrganizationSelection =
      organizationOptions.length > 1 && !selectedOrganization;
    const requiresProjectSelection =
      projectOptions.length > 1 && !selectedProject;

    if (
      !selectedOrganization ||
      isUploading ||
      requiresOrganizationSelection ||
      requiresProjectSelection
    ) {
      return;
    }

    setIsUploading(true);

    const itemsToUpload = queue.filter((item) => item.status === 'queued');

    await Promise.all(
      itemsToUpload.map(async (item) => {
        let registeredObjectId: string | undefined;
        try {
          setQueue((current) =>
            updateItem(current, item.id, {
              error: undefined,
              progress: 0,
              status: 'hashing',
              uploadedBytes: 0,
            }),
          );

          const metadata = await buildSyfonFileUploadMetadata(item.file);
          const objectKey = buildUploadObjectKey(metadata.name, subdirectory);
          const controlledAccess = buildControlledAccessForUpload(
            selectedOrganization,
            selectedProject,
          );
          const resolvedBucket = resolveUploadBucketName(
            rawBuckets,
            selectedOrganization,
            selectedProject || undefined,
          );
          const objectId = await mintSyfonObjectIdFromChecksum(
            metadata.sha256,
            controlledAccess,
          );
          const canonicalUrl = buildSyfonCanonicalObjectUrl(
            resolvedBucket.name,
            objectKey,
            resolvedBucket.provider,
          );

          setQueue((current) =>
            updateItem(current, item.id, {
              objectId,
              objectKey,
              status: 'registering',
            }),
          );

          const registerResponse = await registerDrsObjects({
            candidates: [
              {
                access_methods: [
                  {
                    access_url: { url: canonicalUrl },
                    type: getSyfonAccessMethodType(resolvedBucket.provider),
                  },
                ],
                aliases: [`id:${objectId}`],
                checksums: metadata.checksums,
                controlled_access: controlledAccess,
                mime_type: metadata.mimeType,
                name: metadata.name,
                size: metadata.size,
              },
            ],
          }).unwrap();

          const drsObject = registerResponse.objects[0] as
            | SyfonDrsObject
            | undefined;
          if (!drsObject) {
            throw new Error('DRS registration did not return an object');
          }
          registeredObjectId = drsObject.id;

          setQueue((current) =>
            updateItem(current, item.id, {
              objectId,
              objectKey,
              status: 'uploading',
            }),
          );

          const onProgress = (loaded: number, total: number) => {
            setQueue((current) =>
              updateItem(current, item.id, {
                progress: total > 0 ? Math.round((loaded / total) * 100) : 0,
                uploadedBytes: loaded,
              }),
            );
          };

          if (shouldUseSyfonMultipartUpload(metadata.size)) {
            await uploadMultipartFileWithProgress({
              bucket: resolvedBucket.name,
              completeMultipartUpload: async ({
                bucket,
                fileId,
                parts,
                uploadId,
              }) => {
                await completeMultipartUpload({
                  bucket,
                  fileId,
                  parts,
                  uploadId,
                }).unwrap();
              },
              createPartUploadUrl: async ({
                bucket,
                fileId,
                partNumber,
                uploadId,
              }) =>
                createMultipartPartUploadUrl({
                  bucket,
                  fileId,
                  partNumber,
                  uploadId,
                }).unwrap(),
              file: item.file,
              fileId: objectId,
              initMultipartUpload: async ({ bucket, fileId, fileName }) =>
                createMultipartUpload({
                  bucket,
                  fileId,
                  fileName,
                }).unwrap(),
              objectKey,
              onProgress,
            });
          } else {
            const uploadUrlResponse = await createUploadUrl({
              bucket: resolvedBucket.name,
              fileId: objectId,
            }).unwrap();

            if (!uploadUrlResponse.url) {
              throw new Error('Signed upload URL was not returned');
            }

            await uploadFileWithProgress(
              uploadUrlResponse.url,
              item.file,
              metadata.mimeType,
              onProgress,
            );
          }

          setQueue((current) =>
            updateItem(current, item.id, {
              progress: 100,
              status: 'registering',
              uploadedBytes: item.file.size,
            }),
          );

          setQueue((current) =>
            updateItem(current, item.id, {
              drsObject,
              error: undefined,
              progress: 100,
              status: 'complete',
              uploadedBytes: item.file.size,
            }),
          );
        } catch (error: unknown) {
          let message = extractUploadErrorMessage(error, 'Upload failed');
          if (registeredObjectId) {
            try {
              await deleteDrsObject(registeredObjectId).unwrap();
            } catch {
              message = `${message} (rollback failed)`;
            }
          }
          setQueue((current) =>
            updateItem(current, item.id, {
              error: message,
              status: 'error',
            }),
          );
        }
      }),
    );

    setIsUploading(false);
  }, [
    completeMultipartUpload,
    createMultipartPartUploadUrl,
    createMultipartUpload,
    createUploadUrl,
    deleteDrsObject,
    isUploading,
    organizationOptions.length,
    projectOptions.length,
    queue,
    rawBuckets,
    registerDrsObjects,
    selectedOrganization,
    selectedProject,
    subdirectory,
  ]);

  const requiresOrganizationSelection =
    organizationOptions.length > 1 && !selectedOrganization;
  const requiresProjectSelection =
    projectOptions.length > 1 && !selectedProject;

  return {
    addFiles,
    canStartUpload:
      !isUploading &&
      !!selectedOrganization &&
      !requiresOrganizationSelection &&
      !requiresProjectSelection &&
      queue.some((item) => item.status === 'queued'),
    clearFinishedItems,
    hasBuckets: organizationOptions.length > 0,
    isBucketsLoading,
    isOrganizationSelectionRequired: requiresOrganizationSelection,
    isProjectSelectionRequired: requiresProjectSelection,
    isUploading,
    organizationOptions,
    projectOptions,
    queue,
    downloadItem,
    removeItem,
    selectedOrganization,
    selectedProject,
    setSelectedOrganization: handleSelectedOrganizationChange,
    setSelectedProject,
    setSubdirectory,
    startUpload,
    subdirectory,
  };
};
