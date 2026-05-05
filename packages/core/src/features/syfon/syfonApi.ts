import { gen3Api } from '../gen3';
import { SYFON_API, SYFON_DRS_API } from '../../constants';
import {
  SyfonBucketsResponse,
  SyfonCreateUploadUrlArgs,
  SyfonDrsObject,
  SyfonDrsObjectsByChecksumResponse,
  SyfonDrsRegisterResponse,
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
  getSyfonAccessMethodType,
  mintSyfonObjectIdFromChecksum,
  normalizeSyfonBuckets,
  resolveSyfonBucketForScope,
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

          const uploadUrl = getSignedUrl(uploadUrlResponse.data, 'upload');
          const uploadResponse = await fetch(uploadUrl, {
            body: arg.file,
            headers: {
              'Content-Type': metadata.mimeType,
            },
            method: 'PUT',
          });
          if (!uploadResponse.ok) {
            await rollbackRegisteredObject();
            return customError(
              `Syfon upload failed with status ${uploadResponse.status}`,
            );
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
              uploadUrl,
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
  useUploadAndRegisterSyfonFileMutation,
} = syfonApi;
