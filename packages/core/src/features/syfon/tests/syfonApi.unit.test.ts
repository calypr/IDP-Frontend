import { setupCoreStore } from '../../../store';
import { SYFON_API, SYFON_DRS_API } from '../../../constants';
import { syfonApi } from '../syfonApi';

const jsonResponse = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  });

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
};

const requestMethod = (input: RequestInfo | URL, init?: RequestInit): string => {
  if (init?.method) return init.method;
  if (typeof input === 'string' || input instanceof URL) return 'GET';
  return input.method;
};

const requestJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> => {
  if (init?.body) {
    return JSON.parse(init.body as string) as T;
  }
  if (typeof input !== 'string' && !(input instanceof URL)) {
    return (await input.clone().json()) as T;
  }
  throw new Error('Request body was not available');
};

describe('syfonApi', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('builds bucket, object, checksum, download, upload, and register requests', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url === `${SYFON_API}/buckets` && method === 'GET') {
        return jsonResponse({
          S3_BUCKETS: {
            alpha: {
              programs: ['/programs/org/projects/proj'],
            },
          },
        });
      }

      if (url === `${SYFON_DRS_API}/objects/object-1` && method === 'GET') {
        return jsonResponse({
          checksums: [{ checksum: 'abc', type: 'sha256' }],
          created_time: '2026-05-05T00:00:00Z',
          id: 'object-1',
          self_uri: 'drs://syfon/object-1',
          size: 1,
        });
      }

      if (
        url === `${SYFON_DRS_API}/objects/checksum/abc` &&
        method === 'GET'
      ) {
        return jsonResponse({
          resolved_drs_object: [
            {
              checksums: [{ checksum: 'abc', type: 'sha256' }],
              created_time: '2026-05-05T00:00:00Z',
              id: 'object-1',
              self_uri: 'drs://syfon/object-1',
              size: 1,
            },
          ],
        });
      }

      if (url === `${SYFON_API}/download/object-1` && method === 'GET') {
        return jsonResponse({ url: 'https://signed.example/download' });
      }

      if (url.startsWith(`${SYFON_API}/upload/object-1`) && method === 'GET') {
        const parsedUrl = new URL(url);
        expect(parsedUrl.searchParams.get('bucket')).toBe('alpha');
        expect(parsedUrl.searchParams.get('file_name')).toBe('path/file.txt');
        expect(parsedUrl.searchParams.get('expires_in')).toBe('300');
        return jsonResponse({ url: 'https://signed.example/upload' });
      }

      if (url === `${SYFON_DRS_API}/objects/register` && method === 'POST') {
        const body = await requestJson<{
          candidates: Array<{ checksums: Array<{ checksum: string; type: string }> }>;
        }>(input, init);
        expect(body.candidates).toHaveLength(1);
        expect(body.candidates[0].checksums[0]).toEqual({
          checksum: 'abc',
          type: 'sha256',
        });

        return jsonResponse(
          {
            objects: [
              {
                checksums: [{ checksum: 'abc', type: 'sha256' }],
                created_time: '2026-05-05T00:00:00Z',
                id: 'object-1',
                self_uri: 'drs://syfon/object-1',
                size: 1,
              },
            ],
          },
          { status: 201 },
        );
      }

      if (url === `${SYFON_DRS_API}/objects/object-1` && method === 'DELETE') {
        return new Response(null, { status: 204 });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof global.fetch;

    const buckets = await store.dispatch(
      syfonApi.endpoints.listSyfonBuckets.initiate(),
    );
    const objectResult = await store.dispatch(
      syfonApi.endpoints.getSyfonDrsObject.initiate('object-1'),
    );
    const checksumResult = await store.dispatch(
      syfonApi.endpoints.getSyfonObjectsByChecksum.initiate('abc'),
    );
    const downloadResult = await store.dispatch(
      syfonApi.endpoints.getSyfonDownloadUrl.initiate('object-1'),
    );
    const uploadResult = await store.dispatch(
      syfonApi.endpoints.createSyfonUploadUrl.initiate({
        bucket: 'alpha',
        expiresIn: 300,
        fileId: 'object-1',
        fileName: 'path/file.txt',
      }),
    );
    const registerResult = await store.dispatch(
      syfonApi.endpoints.registerSyfonDrsObjects.initiate({
        candidates: [
          {
            checksums: [{ checksum: 'abc', type: 'sha256' }],
            size: 1,
          },
        ],
      }),
    );

    expect(buckets.data).toEqual({
      S3_BUCKETS: {
        alpha: {
          programs: ['/programs/org/projects/proj'],
        },
      },
    });
    expect(objectResult.data?.id).toBe('object-1');
    expect(checksumResult.data?.resolved_drs_object?.[0].id).toBe('object-1');
    expect(downloadResult.data?.url).toBe('https://signed.example/download');
    expect(uploadResult.data?.url).toBe('https://signed.example/upload');
    expect(registerResult.data?.objects[0].id).toBe('object-1');
  });

  it('uploads, registers, and returns the final DRS object', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url === `${SYFON_API}/buckets` && method === 'GET') {
        return jsonResponse({
          S3_BUCKETS: {
            'project-bucket': {
              programs: ['/programs/org/projects/proj'],
            },
          },
        });
      }

      if (url.startsWith(`${SYFON_API}/upload/`) && method === 'GET') {
        const parsedUrl = new URL(url);
        expect(parsedUrl.searchParams.get('bucket')).toBe('project-bucket');
        expect(parsedUrl.searchParams.get('file_name')).toBeNull();
        return jsonResponse({ url: 'https://signed.example/upload' });
      }

      if (url === 'https://signed.example/upload' && method === 'PUT') {
        expect(init?.headers).toEqual({ 'Content-Type': 'text/plain' });
        return new Response(null, { status: 200 });
      }

      if (url === `${SYFON_DRS_API}/objects/register` && method === 'POST') {
        const body = await requestJson<{
          candidates: Array<{
            access_methods: Array<{ access_url: { url: string }; type: string }>;
            aliases: Array<string>;
            checksums: Array<{ checksum: string; type: string }>;
            controlled_access: Array<string>;
            mime_type: string;
            name: string;
            size: number;
          }>;
        }>(input, init);
        expect(body.candidates[0].access_methods[0].access_url.url).toBe(
          's3://project-bucket/prefix/hello.txt',
        );
        expect(body.candidates[0].controlled_access).toEqual([
          '/organization/org/project/proj',
        ]);
        expect(body.candidates[0].aliases[0]).toMatch(/^id:/);

        return jsonResponse(
          {
            objects: [
              {
                access_methods: body.candidates[0].access_methods,
                checksums: body.candidates[0].checksums,
                controlled_access: body.candidates[0].controlled_access,
                created_time: '2026-05-05T00:00:00Z',
                id: body.candidates[0].aliases[0].slice(3),
                mime_type: body.candidates[0].mime_type,
                name: body.candidates[0].name,
                self_uri: `drs://syfon/${body.candidates[0].aliases[0].slice(3)}`,
                size: body.candidates[0].size,
              },
            ],
          },
          { status: 201 },
        );
      }

      if (url.startsWith(`${SYFON_API}/download/`) && method === 'GET') {
        return jsonResponse({ url: 'https://signed.example/download' });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonApi.endpoints.uploadAndRegisterSyfonFile.initiate({
        bucketPath: 'prefix',
        file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        organization: 'org',
        projectId: 'proj',
      }),
    );

    expect(result.data).toMatchObject({
      bucket: 'project-bucket',
      checksum:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      downloadUrl: 'https://signed.example/download',
      objectKey: 'prefix/hello.txt',
      resourcePath: '/organization/org/project/proj',
      uploadUrl: 'https://signed.example/upload',
    });
    expect(result.data?.drsObject.id).toBe(result.data?.objectId);
  });

  it('uses provider-aware storage URL and access method type for gcs buckets', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url === `${SYFON_API}/buckets` && method === 'GET') {
        return jsonResponse({
          S3_BUCKETS: {
            'gcs-bucket': {
              programs: ['/programs/org/projects/proj'],
              provider: 'gcs',
            },
          },
        });
      }

      if (url.startsWith(`${SYFON_API}/upload/`) && method === 'GET') {
        return jsonResponse({ url: 'https://signed.example/upload' });
      }

      if (url === 'https://signed.example/upload' && method === 'PUT') {
        return new Response(null, { status: 200 });
      }

      if (url === `${SYFON_DRS_API}/objects/register` && method === 'POST') {
        const body = await requestJson<{
          candidates: Array<{
            access_methods: Array<{ access_url: { url: string }; type: string }>;
          }>;
        }>(input, init);
        expect(body.candidates[0].access_methods[0]).toEqual({
          access_url: { url: 'gs://gcs-bucket/prefix/hello.txt' },
          type: 'gs',
        });

        return jsonResponse(
          {
            objects: [
              {
                access_methods: body.candidates[0].access_methods,
                checksums: [
                  {
                    checksum:
                      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
                    type: 'sha256',
                  },
                ],
                controlled_access: ['/organization/org/project/proj'],
                created_time: '2026-05-05T00:00:00Z',
                id: 'dg.mock/gcs',
                self_uri: 'drs://syfon/dg.mock/gcs',
                size: 5,
              },
            ],
          },
          { status: 201 },
        );
      }

      if (url.startsWith(`${SYFON_API}/download/`) && method === 'GET') {
        return jsonResponse({ url: 'https://signed.example/download' });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonApi.endpoints.uploadAndRegisterSyfonFile.initiate({
        bucketPath: 'prefix',
        file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        organization: 'org',
        projectId: 'proj',
      }),
    );

    expect(result.data?.bucket).toBe('gcs-bucket');
    expect(result.data?.drsObject.access_methods?.[0].type).toBe('gs');
  });

  it('surfaces registration failure after upload', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url === `${SYFON_API}/buckets` && method === 'GET') {
        return jsonResponse({
          S3_BUCKETS: {
            'project-bucket': {
              programs: ['/programs/org/projects/proj'],
            },
          },
        });
      }

      if (url.startsWith(`${SYFON_API}/upload/`) && method === 'GET') {
        const parsedUrl = new URL(url);
        expect(parsedUrl.searchParams.get('file_name')).toBeNull();
        return jsonResponse({ url: 'https://signed.example/upload' });
      }

      if (url === 'https://signed.example/upload' && method === 'PUT') {
        return new Response(null, { status: 200 });
      }

      if (url === `${SYFON_DRS_API}/objects/register` && method === 'POST') {
        return jsonResponse({ msg: 'denied' }, { status: 403 });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonApi.endpoints.uploadAndRegisterSyfonFile.initiate({
        file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        organization: 'org',
        projectId: 'proj',
      }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('fails before upload when bucket resolution is ambiguous', async () => {
    const store = setupCoreStore();

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url === `${SYFON_API}/buckets` && method === 'GET') {
        return jsonResponse({
          S3_BUCKETS: {
            a: { programs: ['/programs/org/projects/proj'] },
            b: { programs: ['/programs/org/projects/proj'] },
          },
        });
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonApi.endpoints.uploadAndRegisterSyfonFile.initiate({
        file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        organization: 'org',
        projectId: 'proj',
      }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('fails upload without reporting a created DRS object', async () => {
    const store = setupCoreStore();
    let deleteCalls = 0;

    global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      const method = requestMethod(input, init);

      if (url === `${SYFON_API}/buckets` && method === 'GET') {
        return jsonResponse({
          S3_BUCKETS: {
            'project-bucket': {
              programs: ['/programs/org/projects/proj'],
            },
          },
        });
      }

      if (url.startsWith(`${SYFON_API}/upload/`) && method === 'GET') {
        return jsonResponse({ url: 'https://signed.example/upload' });
      }

      if (url === 'https://signed.example/upload' && method === 'PUT') {
        return new Response(null, { status: 500 });
      }

      if (url.startsWith(`${SYFON_DRS_API}/objects/`) && method === 'DELETE') {
        deleteCalls += 1;
        return new Response(null, { status: 204 });
      }

      if (url === `${SYFON_DRS_API}/objects/register` && method === 'POST') {
        const body = await requestJson<{
          candidates: Array<{
            access_methods: Array<{ access_url: { url: string }; type: string }>;
            aliases: Array<string>;
            checksums: Array<{ checksum: string; type: string }>;
            controlled_access: Array<string>;
            mime_type: string;
            name: string;
            size: number;
          }>;
        }>(input, init);
        return jsonResponse(
          {
            objects: [
              {
                access_methods: body.candidates[0].access_methods,
                checksums: body.candidates[0].checksums,
                controlled_access: body.candidates[0].controlled_access,
                created_time: '2026-05-05T00:00:00Z',
                id: body.candidates[0].aliases[0].slice(3),
                mime_type: body.candidates[0].mime_type,
                name: body.candidates[0].name,
                self_uri: `drs://syfon/${body.candidates[0].aliases[0].slice(3)}`,
                size: body.candidates[0].size,
              },
            ],
          },
          { status: 201 },
        );
      }

      throw new Error(`Unexpected fetch ${method} ${url}`);
    }) as typeof global.fetch;

    const result = await store.dispatch(
      syfonApi.endpoints.uploadAndRegisterSyfonFile.initiate({
        file: new File(['hello'], 'hello.txt', { type: 'text/plain' }),
        organization: 'org',
        projectId: 'proj',
      }),
    );

    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
    expect(deleteCalls).toBe(1);
  });
});
