import { gen3Api } from '../gen3';
import { SYFON_API, SYFON_DRS_API } from '../../constants';
import {
  SyfonCompleteMultipartUploadArgs,
  SyfonBucketsResponse,
  SyfonCreateUploadUrlArgs,
  SyfonDrsObject,
  SyfonDrsObjectsByChecksumResponse,
  SyfonDrsRegisterResponse,
  SyfonMultipartInitArgs,
  SyfonMultipartInitResponse,
  SyfonMultipartUploadUrlArgs,
  SyfonMultipartUploadUrlResponse,
  SyfonRegisterDrsObjectsRequest,
  SyfonSignedUrlResponse,
  SyfonUploadAndRegisterFileArgs,
  SyfonUploadAndRegisterFileResult,
} from './types';
import {
  buildSyfonCanonicalObjectUrl,
  buildSyfonFileUploadMetadata,
  createSyfonObjectKey,
  createSyfonResourcePath,
  getSyfonOptimalMultipartChunkSize,
  getSyfonAccessMethodType,
  mintSyfonObjectIdFromChecksum,
  normalizeSyfonBuckets,
  resolveSyfonBucketForScope,
  shouldUseSyfonMultipartUpload,
} from './utils';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

const TAGS = ['SyfonBucket', 'SyfonDrsObject'] as const;

const syfonTags = gen3Api.enhanceEndpoints({
  addTagTypes: [...TAGS],
});

const customError = (message: string) =>
  ({
    error: {
      error: message,
      status: 'CUSTOM_ERROR',
    },
  }) as { error: FetchBaseQueryError };

const getSignedUrl = (
  response: unknown,
  context: 'upload' | 'download',
): string => {
  const url = (response as SyfonSignedUrlResponse | undefined)?.url;
  if (!url) {
    throw new Error(`Syfon ${context} URL response did not include a url`);
  }
  return url;
};

const getMultipartUploadId = (response: unknown): string => {
  const uploadId = (response as SyfonMultipartInitResponse | undefined)?.uploadId;
  if (!uploadId) {
    throw new Error('Syfon multipart init response did not include an uploadId');
  }
  return uploadId;
};

const getMultipartUploadKey = (
  response: unknown,
  fallbackFileId: string,
): string =>
  (response as SyfonMultipartInitResponse | undefined)?.guid || fallbackFileId;

const getMultipartPresignedUrl = (response: unknown): string => {
  const url = (response as SyfonMultipartUploadUrlResponse | undefined)
    ?.presigned_url;
  if (!url) {
    throw new Error(
      'Syfon multipart upload URL response did not include a presigned_url',
    );
  }
  return url;
};

const registerCandidates = (
  candidates: SyfonRegisterDrsObjectsRequest['candidates'],
) => ({
  candidates,
});

export const syfonApi = syfonTags.injectEndpoints({
  endpoints: (builder) => ({
    listSyfonBuckets: builder.query<SyfonBucketsResponse, void>({
      providesTags: ['SyfonBucket'],
      query: () => `${SYFON_API}/buckets`,
    }),
    getSyfonDrsObject: builder.query<SyfonDrsObject, string>({
      providesTags: (_result, _error, objectId) => [
        { id: objectId, type: 'SyfonDrsObject' },
      ],
      query: (objectId) => `${SYFON_DRS_API}/objects/${objectId}`,
    }),
    getSyfonObjectsByChecksum: builder.query<
      SyfonDrsObjectsByChecksumResponse,
      string
    >({
      providesTags: ['SyfonDrsObject'],
      query: (checksum) => `${SYFON_DRS_API}/objects/checksum/${checksum}`,
    }),
    registerSyfonDrsObjects: builder.mutation<
      SyfonDrsRegisterResponse,
      SyfonRegisterDrsObjectsRequest
    >({
      invalidatesTags: ['SyfonDrsObject'],
      query: ({ candidates }) => ({
        body: registerCandidates(candidates),
        method: 'POST',
        url: `${SYFON_DRS_API}/objects/register`,
      }),
    }),
    deleteSyfonDrsObject: builder.mutation<void, string>({
      invalidatesTags: (_result, _error, objectId) => [
        { id: objectId, type: 'SyfonDrsObject' },
        'SyfonDrsObject',
      ],
      query: (objectId) => ({
        method: 'DELETE',
        url: `${SYFON_DRS_API}/objects/${objectId}`,
      }),
    }),
    getSyfonDownloadUrl: builder.query<SyfonSignedUrlResponse, string>({
      providesTags: (_result, _error, objectId) => [
        { id: objectId, type: 'SyfonDrsObject' },
      ],
      query: (objectId) => `${SYFON_API}/download/${objectId}`,
    }),
    createSyfonUploadUrl: builder.mutation<
      SyfonSignedUrlResponse,
      SyfonCreateUploadUrlArgs
    >({
      query: ({ bucket, expiresIn, fileId, fileName }) => {
        const params = new URLSearchParams({ bucket });
        if (fileName) params.set('file_name', fileName);
        if (expiresIn !== undefined) {
          params.set('expires_in', `${expiresIn}`);
        }

        return {
          method: 'GET',
          url: `${SYFON_API}/upload/${fileId}?${params.toString()}`,
        };
      },
    }),
    createSyfonMultipartUpload: builder.mutation<
      SyfonMultipartInitResponse,
      SyfonMultipartInitArgs
    >({
      query: ({ bucket, fileId, fileName }) => ({
        body: {
          bucket,
          file_name: fileName,
          guid: fileId,
        },
        method: 'POST',
        url: `${SYFON_API}/multipart/init`,
      }),
    }),
    createSyfonMultipartPartUploadUrl: builder.mutation<
      SyfonMultipartUploadUrlResponse,
      SyfonMultipartUploadUrlArgs
    >({
      query: ({ bucket, fileId, partNumber, uploadId }) => ({
        body: {
          bucket,
          key: fileId,
          partNumber,
          uploadId,
        },
        method: 'POST',
        url: `${SYFON_API}/multipart/upload`,
      }),
    }),
    completeSyfonMultipartUpload: builder.mutation<
      void,
      SyfonCompleteMultipartUploadArgs
    >({
      query: ({ bucket, fileId, parts, uploadId }) => ({
        body: {
          bucket,
          key: fileId,
          parts,
          uploadId,
        },
        method: 'POST',
        responseHandler: async (response) => {
          await response.text();
          return null;
        },
        url: `${SYFON_API}/multipart/complete`,
      }),
    }),
    uploadAndRegisterSyfonFile: builder.mutation<
      SyfonUploadAndRegisterFileResult,
      SyfonUploadAndRegisterFileArgs
    >({
      async queryFn(arg, _queryApi, _extraOptions, fetchWithBQ) {
        let registeredObjectId: string | undefined;
        const rollbackRegisteredObject = async (): Promise<void> => {
          if (!registeredObjectId) return;
          await fetchWithBQ({
            method: 'DELETE',
            url: `${SYFON_DRS_API}/objects/${registeredObjectId}`,
          });
        };
        try {
          const controlledAccess = [
            createSyfonResourcePath(arg.organization, arg.projectId),
          ];
          const metadata = await buildSyfonFileUploadMetadata(arg.file);
          const objectId = await mintSyfonObjectIdFromChecksum(
            metadata.sha256,
            controlledAccess,
          );
          let resolvedBucket = arg.bucket;
          let resolvedProvider: string | undefined;

          if (!resolvedBucket) {
            const bucketResponse = await fetchWithBQ(`${SYFON_API}/buckets`);
            if (bucketResponse.error) {
              return { error: bucketResponse.error };
            }

            const matchedBucket = resolveSyfonBucketForScope(
              normalizeSyfonBuckets(bucketResponse.data as SyfonBucketsResponse),
              {
                organization: arg.organization,
                projectId: arg.projectId,
              },
            );
            resolvedBucket = matchedBucket.name;
            resolvedProvider = matchedBucket.provider;
          }

          const objectKey = createSyfonObjectKey(metadata.name, arg.bucketPath);
          const canonicalUrl = buildSyfonCanonicalObjectUrl(
            resolvedBucket,
            objectKey,
            resolvedProvider,
          );
          const registerResponse = await fetchWithBQ({
            body: registerCandidates([
              {
                access_methods: [
                  {
                    access_url: { url: canonicalUrl },
                    type: getSyfonAccessMethodType(resolvedProvider),
                  },
                ],
                aliases: [`id:${objectId}`],
                checksums: metadata.checksums,
                controlled_access: controlledAccess,
                description: arg.description,
                mime_type: metadata.mimeType,
                name: metadata.name,
                size: metadata.size,
              },
            ]),
            method: 'POST',
            url: `${SYFON_DRS_API}/objects/register`,
          });
          if (registerResponse.error) {
            return { error: registerResponse.error };
          }

          const registeredObject = (
            registerResponse.data as SyfonDrsRegisterResponse
          ).objects?.[0];
          if (!registeredObject) {
            return customError(
              'Syfon DRS registration response did not include an object',
            );
          }
          registeredObjectId = registeredObject.id;

          const uploadUrls: Array<string> = [];
          const uploadMethod = shouldUseSyfonMultipartUpload(metadata.size)
            ? 'multipart'
            : 'singlepart';
          let uploadUrl: string | undefined;

          if (uploadMethod === 'multipart') {
            const multipartInitResponse = await fetchWithBQ({
              body: {
                bucket: resolvedBucket,
                file_name: objectKey,
                guid: registeredObject.id,
              },
              method: 'POST',
              url: `${SYFON_API}/multipart/init`,
            });
            if (multipartInitResponse.error) {
              await rollbackRegisteredObject();
              return { error: multipartInitResponse.error };
            }

            const uploadId = getMultipartUploadId(multipartInitResponse.data);
            const multipartKey = getMultipartUploadKey(
              multipartInitResponse.data,
              registeredObject.id,
            );
            const chunkSize = getSyfonOptimalMultipartChunkSize(metadata.size);
            const partCount = Math.ceil(metadata.size / chunkSize);
            const parts: Array<{ ETag: string; PartNumber: number }> = [];

            for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
              const start = (partNumber - 1) * chunkSize;
              const end = Math.min(start + chunkSize, metadata.size);
              const partUrlResponse = await fetchWithBQ({
                body: {
                  bucket: resolvedBucket,
                  key: multipartKey,
                  partNumber,
                  uploadId,
                },
                method: 'POST',
                url: `${SYFON_API}/multipart/upload`,
              });
              if (partUrlResponse.error) {
                await rollbackRegisteredObject();
                return { error: partUrlResponse.error };
              }

              const presignedUrl = getMultipartPresignedUrl(
                partUrlResponse.data,
              );
              uploadUrls.push(presignedUrl);
              const uploadPartResponse = await fetch(presignedUrl, {
                body: arg.file.slice(start, end),
                method: 'PUT',
              });
              if (!uploadPartResponse.ok) {
                await rollbackRegisteredObject();
                return customError(
                  `Syfon multipart upload failed with status ${uploadPartResponse.status}`,
                );
              }

              const etag =
                uploadPartResponse.headers.get('etag') ??
                uploadPartResponse.headers.get('ETag');
              if (!etag) {
                await rollbackRegisteredObject();
                return customError(
                  `Syfon multipart upload part ${partNumber} did not return an ETag`,
                );
              }

              parts.push({
                ETag: etag,
                PartNumber: partNumber,
              });
            }

            const multipartCompleteResponse = await fetchWithBQ({
              body: {
                bucket: resolvedBucket,
                key: multipartKey,
                parts,
                uploadId,
              },
              method: 'POST',
              responseHandler: async (response) => {
                await response.text();
                return null;
              },
              url: `${SYFON_API}/multipart/complete`,
            });
            if (multipartCompleteResponse.error) {
              await rollbackRegisteredObject();
              return { error: multipartCompleteResponse.error };
            }
          } else {
            const uploadUrlResponse = await fetchWithBQ({
              method: 'GET',
              url: `${SYFON_API}/upload/${registeredObject.id}?${new URLSearchParams({
                bucket: resolvedBucket,
              }).toString()}`,
            });
            if (uploadUrlResponse.error) {
              await rollbackRegisteredObject();
              return { error: uploadUrlResponse.error };
            }

            uploadUrl = getSignedUrl(uploadUrlResponse.data, 'upload');
            const uploadResponse = await fetch(uploadUrl, {
              body: arg.file,
              method: 'PUT',
            });
            if (!uploadResponse.ok) {
              await rollbackRegisteredObject();
              return customError(
                `Syfon upload failed with status ${uploadResponse.status}`,
              );
            }
          }

          const downloadUrlResponse = await fetchWithBQ(
            `${SYFON_API}/download/${registeredObject.id}`,
          );
          const downloadUrl = downloadUrlResponse.error
            ? undefined
            : (downloadUrlResponse.data as SyfonSignedUrlResponse).url;

          return {
            data: {
              bucket: resolvedBucket,
              checksum: metadata.sha256,
              downloadUrl,
              drsObject: registeredObject,
              objectId: registeredObject.id,
              objectKey,
              resourcePath: controlledAccess[0],
              uploadMethod,
              uploadUrl,
              uploadUrls,
            },
          };
        } catch (error: unknown) {
          await rollbackRegisteredObject();
          if (error instanceof Error) {
            return customError(error.message);
          }

          return customError('Unexpected Syfon upload error');
        }
      },
    }),
  }),
});

export const {
  useListSyfonBucketsQuery,
  useGetSyfonDrsObjectQuery,
  useLazyGetSyfonDrsObjectQuery,
  useGetSyfonObjectsByChecksumQuery,
  useRegisterSyfonDrsObjectsMutation,
  useDeleteSyfonDrsObjectMutation,
  useGetSyfonDownloadUrlQuery,
  useLazyGetSyfonDownloadUrlQuery,
  useCreateSyfonUploadUrlMutation,
  useCreateSyfonMultipartUploadMutation,
  useCreateSyfonMultipartPartUploadUrlMutation,
  useCompleteSyfonMultipartUploadMutation,
  useUploadAndRegisterSyfonFileMutation,
} = syfonApi;
