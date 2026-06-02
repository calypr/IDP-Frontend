import {
  buildSyfonCanonicalObjectUrl,
  buildSyfonFileUploadMetadata,
  createSyfonObjectKey,
  createSyfonResourcePath,
  getSyfonOptimalMultipartChunkSize,
  getSyfonAccessMethodType,
  mintSyfonObjectIdFromChecksum,
  normalizeSyfonBuckets,
  normalizeSyfonProvider,
  normalizeSyfonResourcePath,
  resolveSyfonBucketForScope,
  shouldUseSyfonMultipartUpload,
  SYFON_SINGLEPART_UPLOAD_SIZE_LIMIT,
} from '../utils';

describe('syfon utils', () => {
  it('normalizes bucket maps for UI consumption', () => {
    const buckets = normalizeSyfonBuckets({
      S3_BUCKETS: {
        'bucket-a': {
          endpoint_url: 'https://s3.example.org',
          programs: ['/programs/org-a/projects/project-a', '/programs/org-a'],
          provider: 'aws',
          region: 'us-east-1',
        },
      },
    });

    expect(buckets).toEqual([
      {
        endpointUrl: 'https://s3.example.org',
        name: 'bucket-a',
        programs: ['/programs/org-a/projects/project-a', '/programs/org-a'],
        provider: 'aws',
        region: 'us-east-1',
        resources: [
          '/programs/org-a/projects/project-a',
          '/programs/org-a',
        ],
      },
    ]);
  });

  it('normalizes canonical program/project resource paths', () => {
    expect(normalizeSyfonResourcePath('/programs/org/projects/proj')).toBe(
      '/programs/org/projects/proj',
    );
    expect(normalizeSyfonResourcePath('https://calypr.org/programs/org/projects/proj')).toBe(
      '/programs/org/projects/proj',
    );
    expect(normalizeSyfonResourcePath('org')).toBe('/programs/org');
  });

  it('resolves project scope before org fallback', () => {
    const exact = { name: 'project-bucket', resources: ['/programs/o/projects/p'] };
    const fallback = { name: 'org-bucket', resources: ['/programs/o'] };

    expect(
      resolveSyfonBucketForScope(
        [
          {
            endpointUrl: undefined,
            name: fallback.name,
            programs: [],
            provider: undefined,
            region: undefined,
            resources: fallback.resources,
          },
          {
            endpointUrl: undefined,
            name: exact.name,
            programs: [],
            provider: undefined,
            region: undefined,
            resources: exact.resources,
          },
        ],
        { organization: 'o', projectId: 'p' },
      ).name,
    ).toBe('project-bucket');
  });

  it('falls back to org scope when no project match exists', () => {
    const bucket = resolveSyfonBucketForScope(
      [
        {
          endpointUrl: undefined,
          name: 'org-bucket',
          programs: [],
          provider: undefined,
          region: undefined,
          resources: ['/programs/o'],
        },
      ],
      { organization: 'o', projectId: 'missing' },
    );

    expect(bucket.name).toBe('org-bucket');
  });

  it('errors on ambiguous or missing scope matches', () => {
    expect(() =>
      resolveSyfonBucketForScope(
        [
          {
            endpointUrl: undefined,
            name: 'a',
            programs: [],
            provider: undefined,
            region: undefined,
          resources: ['/programs/o/projects/p'],
          },
          {
            endpointUrl: undefined,
            name: 'b',
            programs: [],
            provider: undefined,
            region: undefined,
            resources: ['/programs/o/projects/p'],
          },
        ],
        { organization: 'o', projectId: 'p' },
      ),
    ).toThrow('Multiple Syfon buckets matched project scope o/p');

    expect(() =>
      resolveSyfonBucketForScope([], { organization: 'o', projectId: 'p' }),
    ).toThrow('No Syfon bucket matched scope o/p');
  });

  it('builds deterministic upload metadata and object ids', async () => {
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    const metadata = await buildSyfonFileUploadMetadata(file);

    expect(metadata).toEqual({
      checksums: [
        {
          checksum:
            '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
          type: 'sha256',
        },
      ],
      mimeType: 'text/plain',
      name: 'hello.txt',
      sha256:
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      size: 5,
    });

    expect(
      await mintSyfonObjectIdFromChecksum(metadata.sha256, [
        createSyfonResourcePath('org', 'proj'),
      ]),
    ).toBe(
      await mintSyfonObjectIdFromChecksum(metadata.sha256, [
        '/programs/org/projects/proj',
      ]),
    );
    expect(createSyfonObjectKey('hello.txt', '/nested/path/')).toBe(
      'nested/path/hello.txt',
    );
  });

  it('derives provider-specific storage schemes and access method types', () => {
    expect(normalizeSyfonProvider('aws')).toBe('s3');
    expect(normalizeSyfonProvider('gs')).toBe('gcs');
    expect(normalizeSyfonProvider('azblob')).toBe('azure');

    expect(buildSyfonCanonicalObjectUrl('bucket-a', 'path/file.txt', 'gcs')).toBe(
      'gs://bucket-a/path/file.txt',
    );
    expect(
      buildSyfonCanonicalObjectUrl('bucket-a', 'path/file.txt', 'azure'),
    ).toBe('azblob://bucket-a/path/file.txt');
    expect(getSyfonAccessMethodType('gcs')).toBe('gs');
    expect(getSyfonAccessMethodType('azure')).toBe('azblob');
  });

  it('derives multipart thresholds and chunk sizes', () => {
    expect(shouldUseSyfonMultipartUpload(SYFON_SINGLEPART_UPLOAD_SIZE_LIMIT - 1)).toBe(false);
    expect(shouldUseSyfonMultipartUpload(SYFON_SINGLEPART_UPLOAD_SIZE_LIMIT)).toBe(true);

    expect(getSyfonOptimalMultipartChunkSize(0)).toBe(1024 * 1024);
    expect(getSyfonOptimalMultipartChunkSize(50 * 1024 * 1024)).toBe(
      50 * 1024 * 1024,
    );
    expect(getSyfonOptimalMultipartChunkSize(500 * 1024 * 1024)).toBe(
      10 * 1024 * 1024,
    );
    expect(
      getSyfonOptimalMultipartChunkSize(50 * 1024 * 1024 * 1024),
    ).toBe(256 * 1024 * 1024);
  });
});
