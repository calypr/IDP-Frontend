import { act, renderHook, waitFor } from '@testing-library/react';
import { useUploadController } from './useUploadController';

const createUploadUrlMock = jest.fn();
const deleteDrsObjectMock = jest.fn();
const getDownloadUrlMock = jest.fn();
const listBucketsQueryMock = jest.fn();
const registerDrsObjectsMock = jest.fn();
const uploadFileWithProgressMock = jest.fn();
const buildSyfonFileUploadMetadataMock = jest.fn();
const mintSyfonObjectIdFromChecksumMock = jest.fn();

jest.mock('@gen3/core', () => ({
  buildSyfonCanonicalObjectUrl: jest.fn(
    (bucket: string, objectKey: string, provider?: string) => {
      const scheme =
        provider === 'gcs'
          ? 'gs'
          : provider === 'azure'
            ? 'azblob'
            : 's3';
      return `${scheme}://${bucket}/${objectKey}`;
    },
  ),
  buildSyfonFileUploadMetadata: (...args: unknown[]) =>
    buildSyfonFileUploadMetadataMock(...args),
  mintSyfonObjectIdFromChecksum: (...args: unknown[]) =>
    mintSyfonObjectIdFromChecksumMock(...args),
  useCreateSyfonUploadUrlMutation: () => [createUploadUrlMock],
  useDeleteSyfonDrsObjectMutation: () => [deleteDrsObjectMock],
  useLazyGetSyfonDownloadUrlQuery: () => [getDownloadUrlMock],
  useListSyfonBucketsQuery: () => listBucketsQueryMock(),
  useRegisterSyfonDrsObjectsMutation: () => [registerDrsObjectsMock],
  createSyfonObjectKey: (fileName: string, bucketPath?: string) =>
    bucketPath ? `${bucketPath}/${fileName}` : fileName,
  normalizeSyfonBuckets: (response: {
    S3_BUCKETS: Record<string, { programs?: Array<string>; provider?: string }>;
  }) =>
    Object.entries(response.S3_BUCKETS).map(([name, metadata]) => ({
      name,
      programs: metadata.programs ?? [],
      provider: metadata.provider,
      resources: (metadata.programs ?? []).map((resource) =>
        resource
          .replace('/programs/', '/organization/')
          .replace('/projects/', '/project/'),
      ),
    })),
  normalizeSyfonResourcePath: (resource: string) =>
    resource
      .replace('/programs/', '/organization/')
      .replace('/projects/', '/project/'),
  getSyfonAccessMethodType: (provider?: string) => {
    switch (provider) {
      case 'gcs':
        return 'gs';
      case 'azure':
        return 'azblob';
      default:
        return 's3';
    }
  },
}));

jest.mock('./uploadService', () => ({
  uploadFileWithProgress: (...args: unknown[]) =>
    uploadFileWithProgressMock(...args),
}));

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('useUploadController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listBucketsQueryMock.mockReturnValue({
      data: {
        S3_BUCKETS: {
          'bucket-a': {
            programs: ['/programs/org-a/projects/proj-a'],
          },
        },
      },
      isLoading: false,
    });
    buildSyfonFileUploadMetadataMock.mockResolvedValue({
      checksums: [{ checksum: 'sha256-value', type: 'sha256' }],
      mimeType: 'text/plain',
      name: 'hello.txt',
      sha256: 'sha256-value',
      size: 5,
    });
    mintSyfonObjectIdFromChecksumMock.mockResolvedValue('dg.mock/1');
    createUploadUrlMock.mockReturnValue({
      unwrap: async () => ({ url: 'https://signed.example/upload' }),
    });
    deleteDrsObjectMock.mockReturnValue({
      unwrap: async () => undefined,
    });
    getDownloadUrlMock.mockReturnValue({
      unwrap: async () => ({ url: 'https://signed.example/download' }),
    });
    registerDrsObjectsMock.mockReturnValue({
      unwrap: async () => ({
        objects: [
          {
            checksums: [{ checksum: 'sha256-value', type: 'sha256' }],
            created_time: '2026-05-05T00:00:00Z',
            id: 'dg.mock/1',
            self_uri: 'drs://syfon/dg.mock/1',
            size: 5,
          },
        ],
      }),
    });
  });

  it('auto-selects a single available organization and project', () => {
    const { result } = renderHook(() => useUploadController());

    expect(result.current.organizationOptions).toEqual([
      { label: 'org-a', value: 'org-a' },
    ]);
    expect(result.current.projectOptions).toEqual([
      { label: 'proj-a', value: 'proj-a' },
    ]);
    expect(result.current.selectedOrganization).toBe('org-a');
    expect(result.current.selectedProject).toBe('proj-a');
  });

  it('moves a file through queued, hashing, uploading, registering, and complete', async () => {
    const uploadDeferred = createDeferred<void>();
    const registerDeferred = createDeferred<{
      objects: Array<{
        checksums: Array<{ checksum: string; type: string }>;
        created_time: string;
        id: string;
        self_uri: string;
        size: number;
      }>;
    }>();

    uploadFileWithProgressMock.mockImplementation(
      async (
        _url: string,
        _file: File,
        _contentType: string,
        onProgress: (loaded: number, total: number) => void,
      ) => {
        onProgress(2, 5);
        return uploadDeferred.promise;
      },
    );
    registerDrsObjectsMock.mockReturnValue({
      unwrap: () => registerDeferred.promise,
    });

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.setSubdirectory('nested');
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    let uploadPromise: Promise<void>;
    await act(async () => {
      uploadPromise = result.current.startUpload();
    });

    await waitFor(() =>
      expect(result.current.queue[0].status).toBe('registering'),
    );

    await act(async () => {
      registerDeferred.resolve({
        objects: [
          {
            checksums: [{ checksum: 'sha256-value', type: 'sha256' }],
            created_time: '2026-05-05T00:00:00Z',
            id: 'dg.mock/1',
            self_uri: 'drs://syfon/dg.mock/1',
            size: 5,
          },
        ],
      });
    });

    await waitFor(() => expect(result.current.queue[0].progress).toBe(40));
    expect(registerDrsObjectsMock).toHaveBeenCalledWith({
      candidates: [
        expect.objectContaining({
          access_methods: [
            {
              access_url: { url: 's3://bucket-a/nested/hello.txt' },
              type: 's3',
            },
          ],
          aliases: ['id:dg.mock/1'],
          controlled_access: ['/organization/org-a/project/proj-a'],
        }),
      ],
    });
    expect(createUploadUrlMock).toHaveBeenCalledWith({
      bucket: 'bucket-a',
      fileId: 'dg.mock/1',
    });

    await act(async () => {
      uploadDeferred.resolve();
    });

    await act(async () => {
      await uploadPromise!;
    });

    await waitFor(() =>
      expect(result.current.queue[0].status).toBe('complete'),
    );
    expect(deleteDrsObjectMock).not.toHaveBeenCalled();
  });

  it('requires a project selection when multiple projects exist for an organization', () => {
    listBucketsQueryMock.mockReturnValue({
      data: {
        S3_BUCKETS: {
          'bucket-a': {
            programs: [
              '/programs/org-a/projects/proj-a',
              '/programs/org-a/projects/proj-b',
            ],
          },
        },
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    expect(result.current.organizationOptions).toEqual([
      { label: 'org-a', value: 'org-a' },
    ]);
    expect(result.current.projectOptions).toEqual([
      { label: 'proj-a', value: 'proj-a' },
      { label: 'proj-b', value: 'proj-b' },
    ]);
    expect(result.current.selectedOrganization).toBe('org-a');
    expect(result.current.selectedProject).toBe('');
    expect(result.current.isProjectSelectionRequired).toBe(true);
    expect(result.current.canStartUpload).toBe(false);
  });

  it('uses provider-aware registration metadata for gcs buckets', async () => {
    listBucketsQueryMock.mockReturnValue({
      data: {
        S3_BUCKETS: {
          'gcs-bucket': {
            programs: ['/programs/org-a/projects/proj-a'],
            provider: 'gcs',
          },
        },
      },
      isLoading: false,
    });

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.setSubdirectory('nested');
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    await act(async () => {
      await result.current.startUpload();
    });

    expect(registerDrsObjectsMock).toHaveBeenCalledWith({
      candidates: [
        expect.objectContaining({
          access_methods: [
            {
              access_url: { url: 'gs://gcs-bucket/nested/hello.txt' },
              type: 'gs',
            },
          ],
        }),
      ],
    });
    expect(createUploadUrlMock).toHaveBeenCalledWith({
      bucket: 'gcs-bucket',
      fileId: 'dg.mock/1',
    });
  });

  it('deletes the Syfon record when removing a completed row', async () => {
    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    await act(async () => {
      await result.current.startUpload();
    });

    expect(result.current.queue[0].status).toBe('complete');

    await act(async () => {
      await result.current.removeItem(result.current.queue[0].id);
    });

    expect(deleteDrsObjectMock).toHaveBeenCalledWith('dg.mock/1');
    expect(result.current.queue).toHaveLength(0);
  });

  it('downloads a completed item through the Syfon download hook', async () => {
    const windowOpenSpy = jest
      .spyOn(window, 'open')
      .mockImplementation(() => null);

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    await act(async () => {
      await result.current.startUpload();
    });

    await act(async () => {
      await result.current.downloadItem(result.current.queue[0].id);
    });

    expect(getDownloadUrlMock).toHaveBeenCalledWith('dg.mock/1');
    expect(windowOpenSpy).toHaveBeenCalledWith(
      'https://signed.example/download',
      '_blank',
      'noopener,noreferrer',
    );

    windowOpenSpy.mockRestore();
  });

  it('marks the file as error when upload fails', async () => {
    uploadFileWithProgressMock.mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    await act(async () => {
      await result.current.startUpload();
    });

    expect(result.current.queue[0].status).toBe('error');
    expect(result.current.queue[0].error).toBe('Upload failed');
    expect(deleteDrsObjectMock).toHaveBeenCalledWith('dg.mock/1');
  });

  it('marks the file as error when registration fails', async () => {
    uploadFileWithProgressMock.mockResolvedValue(undefined);
    registerDrsObjectsMock.mockReturnValue({
      unwrap: async () => {
        throw new Error('Registration failed');
      },
    });

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    await act(async () => {
      await result.current.startUpload();
    });

    expect(result.current.queue[0].status).toBe('error');
    expect(result.current.queue[0].error).toBe('Registration failed');
    expect(uploadFileWithProgressMock).not.toHaveBeenCalled();
    expect(deleteDrsObjectMock).not.toHaveBeenCalled();
  });

  it('surfaces rollback failure when cleanup fails after upload error', async () => {
    uploadFileWithProgressMock.mockRejectedValue(new Error('Upload failed'));
    deleteDrsObjectMock.mockReturnValue({
      unwrap: async () => {
        throw new Error('delete failed');
      },
    });

    const { result } = renderHook(() => useUploadController());

    act(() => {
      result.current.addFiles([
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
      ]);
    });

    await act(async () => {
      await result.current.startUpload();
    });

    expect(result.current.queue[0].status).toBe('error');
    expect(result.current.queue[0].error).toBe(
      'Upload failed (rollback failed)',
    );
  });
});
