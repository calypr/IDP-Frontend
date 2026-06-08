import {
  getSyfonOptimalMultipartChunkSize,
  SYFON_DEFAULT_MULTIPART_CONCURRENCY,
} from '@gen3/core';

const extractUploadResponseMessage = (
  responseText: string,
  status: number,
  statusText: string,
): string => {
  if (status === 0) {
    return 'network error or blocked upload request (often CORS or preflight rejection)';
  }

  const trimmedResponse = responseText.trim();

  if (trimmedResponse) {
    try {
      const parsed = JSON.parse(trimmedResponse) as
        | string
        | {
            detail?: string;
            error?: string;
            message?: string;
          };

      if (typeof parsed === 'string' && parsed.trim()) {
        return parsed.trim();
      }

      if (parsed && typeof parsed === 'object') {
        const candidate =
          parsed.message?.trim() ||
          parsed.error?.trim() ||
          parsed.detail?.trim();

        if (candidate) {
          return candidate;
        }
      }
    } catch {
      return trimmedResponse;
    }

    return trimmedResponse;
  }

  if (statusText.trim()) {
    return statusText.trim();
  }

  return `status ${status}`;
};

const uploadBlobWithProgress = (
  url: string,
  blob: Blob,
  onProgress: (loaded: number, total: number) => void,
): Promise<string | undefined> =>
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('PUT', url);

    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded, event.total);
      }
    };

    request.onerror = () => {
      const message = extractUploadResponseMessage(
        request.responseText ?? '',
        request.status,
        request.statusText ?? '',
      );
      reject(new Error(`Upload failed: ${message}`));
    };

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress(blob.size, blob.size);
        resolve(
          request.getResponseHeader('ETag') ??
            request.getResponseHeader('etag') ??
            undefined,
        );
        return;
      }

      const message = extractUploadResponseMessage(
        request.responseText ?? '',
        request.status,
        request.statusText ?? '',
      );
      reject(
        new Error(`Upload failed (${request.status}): ${message}`),
      );
    };

    request.send(blob);
  });

export const uploadFileWithProgress = (
  url: string,
  file: File,
  _contentType: string,
  onProgress: (loaded: number, total: number) => void,
): Promise<void> =>
  uploadBlobWithProgress(url, file, onProgress).then(() => undefined);

interface MultipartUploadPart {
  ETag: string;
  PartNumber: number;
}

interface UploadMultipartFileWithProgressArgs {
  bucket?: string;
  createPartUploadUrl: (args: {
    bucket?: string;
    fileId: string;
    partNumber: number;
    uploadId: string;
  }) => Promise<{ presigned_url?: string }>;
  completeMultipartUpload: (args: {
    bucket?: string;
    fileId: string;
    parts: Array<MultipartUploadPart>;
    uploadId: string;
  }) => Promise<void>;
  concurrency?: number;
  file: File;
  fileId: string;
  initMultipartUpload: (args: {
    bucket?: string;
    fileId: string;
    fileName?: string;
  }) => Promise<{ guid?: string; uploadId?: string }>;
  objectKey: string;
  onProgress: (loaded: number, total: number) => void;
}

export const uploadMultipartFileWithProgress = async ({
  bucket,
  createPartUploadUrl,
  completeMultipartUpload,
  concurrency = SYFON_DEFAULT_MULTIPART_CONCURRENCY,
  file,
  fileId,
  initMultipartUpload,
  objectKey,
  onProgress,
}: UploadMultipartFileWithProgressArgs): Promise<void> => {
  const initResponse = await initMultipartUpload({
    bucket,
    fileId,
    fileName: objectKey,
  });
  const uploadId = initResponse.uploadId?.trim();
  if (!uploadId) {
    throw new Error('Multipart upload init did not return an uploadId');
  }

  const multipartKey = initResponse.guid?.trim() || fileId;
  const chunkSize = getSyfonOptimalMultipartChunkSize(file.size);
  const partCount = Math.ceil(file.size / chunkSize);
  const uploadedBytesByPart = new Array<number>(partCount).fill(0);
  const parts = new Array<MultipartUploadPart>(partCount);

  const updateProgress = (partIndex: number, loaded: number) => {
    uploadedBytesByPart[partIndex] = loaded;
    onProgress(
      uploadedBytesByPart.reduce((sum, value) => sum + value, 0),
      file.size,
    );
  };

  let nextPartIndex = 0;
  const workerCount = Math.min(concurrency, partCount);

  const uploadPart = async (partIndex: number): Promise<void> => {
    const partNumber = partIndex + 1;
    const start = partIndex * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    const partUploadUrlResponse = await createPartUploadUrl({
      bucket,
      fileId: multipartKey,
      partNumber,
      uploadId,
    });
    const presignedUrl = partUploadUrlResponse.presigned_url?.trim();
    if (!presignedUrl) {
      throw new Error(
        `Multipart upload URL for part ${partNumber} was not returned`,
      );
    }

    const etag = await uploadBlobWithProgress(presignedUrl, blob, (loaded) =>
      updateProgress(partIndex, loaded),
    );
    if (!etag) {
      throw new Error(`Multipart upload part ${partNumber} did not return an ETag`);
    }

    parts[partIndex] = {
      ETag: etag,
      PartNumber: partNumber,
    };
  };

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextPartIndex < partCount) {
        const currentIndex = nextPartIndex;
        nextPartIndex += 1;
        await uploadPart(currentIndex);
      }
    }),
  );

  await completeMultipartUpload({
    bucket,
    fileId: multipartKey,
    parts,
    uploadId,
  });
  onProgress(file.size, file.size);
};
