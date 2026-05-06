import {
  uploadFileWithProgress,
  uploadMultipartFileWithProgress,
} from './uploadService';

jest.mock('@gen3/core', () => ({
  getSyfonOptimalMultipartChunkSize: (fileSize: number) => fileSize,
  SYFON_DEFAULT_MULTIPART_CONCURRENCY: 4,
}));

class MockXMLHttpRequest {
  static nextHeaders: Record<string, string> = {};
  static nextResponseText = '';
  static nextStatus = 200;
  static nextStatusText = '';
  static trigger: 'load' | 'error' = 'load';

  upload: { onprogress: ((event: ProgressEvent<EventTarget>) => void) | null } =
    { onprogress: null };

  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;
  responseText = '';
  status = 0;
  statusText = '';

  open = jest.fn();
  send = jest.fn(() => {
    this.status = MockXMLHttpRequest.nextStatus;
    this.statusText = MockXMLHttpRequest.nextStatusText;
    this.responseText = MockXMLHttpRequest.nextResponseText;

    if (MockXMLHttpRequest.trigger === 'load') {
      this.onload?.();
      return;
    }

    this.onerror?.();
  });
  getResponseHeader = jest.fn((name: string) => MockXMLHttpRequest.nextHeaders[name]);
  setRequestHeader = jest.fn();
}

describe('uploadFileWithProgress', () => {
  const originalXmlHttpRequest = global.XMLHttpRequest;

  beforeEach(() => {
    MockXMLHttpRequest.nextHeaders = {};
    MockXMLHttpRequest.nextResponseText = '';
    MockXMLHttpRequest.nextStatus = 200;
    MockXMLHttpRequest.nextStatusText = '';
    MockXMLHttpRequest.trigger = 'load';
    global.XMLHttpRequest =
      MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
  });

  afterAll(() => {
    global.XMLHttpRequest = originalXmlHttpRequest;
  });

  it('surfaces JSON response messages from failed uploads', async () => {
    MockXMLHttpRequest.nextStatus = 403;
    MockXMLHttpRequest.nextStatusText = 'Forbidden';
    MockXMLHttpRequest.nextResponseText = JSON.stringify({
      message: 'Signature has expired',
    });

    await expect(
      uploadFileWithProgress(
        'https://signed.example/upload',
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        'text/plain',
        jest.fn(),
      ),
    ).rejects.toThrow('Upload failed (403): Signature has expired');
  });

  it('surfaces plain text from transport errors when present', async () => {
    MockXMLHttpRequest.trigger = 'error';
    MockXMLHttpRequest.nextResponseText = 'AccessDenied';
    MockXMLHttpRequest.nextStatusText = 'Forbidden';

    await expect(
      uploadFileWithProgress(
        'https://signed.example/upload',
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        'text/plain',
        jest.fn(),
      ),
    ).rejects.toThrow('Upload failed: AccessDenied');
  });

  it('surfaces a useful message for status 0 transport failures', async () => {
    MockXMLHttpRequest.trigger = 'error';
    MockXMLHttpRequest.nextStatus = 0;
    MockXMLHttpRequest.nextResponseText = '';
    MockXMLHttpRequest.nextStatusText = '';

    await expect(
      uploadFileWithProgress(
        'https://signed.example/upload',
        new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        'text/plain',
        jest.fn(),
      ),
    ).rejects.toThrow(
      'Upload failed: network error or blocked upload request (often CORS or preflight rejection)',
    );
  });

  it('uploads multipart files, aggregates progress, and completes with ETags', async () => {
    MockXMLHttpRequest.nextHeaders = { ETag: '"etag-1"' };

    const initMultipartUpload = jest.fn(async () => ({
      guid: 'dg.mock/1',
      uploadId: 'upload-1',
    }));
    const createPartUploadUrl = jest.fn(async () => ({
      presigned_url: 'https://signed.example/part-1',
    }));
    const completeMultipartUpload = jest.fn(async () => undefined);
    const onProgress = jest.fn();
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });

    await uploadMultipartFileWithProgress({
      bucket: 'bucket-a',
      completeMultipartUpload,
      createPartUploadUrl,
      file,
      fileId: 'dg.mock/1',
      initMultipartUpload,
      objectKey: 'nested/hello.txt',
      onProgress,
    });

    expect(initMultipartUpload).toHaveBeenCalledWith({
      bucket: 'bucket-a',
      fileId: 'dg.mock/1',
      fileName: 'nested/hello.txt',
    });
    expect(createPartUploadUrl).toHaveBeenCalledWith({
      bucket: 'bucket-a',
      fileId: 'dg.mock/1',
      partNumber: 1,
      uploadId: 'upload-1',
    });
    expect(completeMultipartUpload).toHaveBeenCalledWith({
      bucket: 'bucket-a',
      fileId: 'dg.mock/1',
      parts: [{ ETag: '"etag-1"', PartNumber: 1 }],
      uploadId: 'upload-1',
    });
    expect(onProgress).toHaveBeenCalledWith(file.size, file.size);
  });
});
