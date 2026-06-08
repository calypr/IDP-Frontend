jest.mock('@gen3/core', () => ({
  createSyfonObjectKey: (fileName: string, bucketPath?: string) =>
    bucketPath ? `${bucketPath}/${fileName}` : fileName,
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
  normalizeSyfonBuckets: (response: {
    S3_BUCKETS: Record<
      string,
      {
        endpoint_url?: string;
        programs?: Array<string>;
        provider?: string;
        region?: string;
      }
    >;
  }) =>
    Object.entries(response.S3_BUCKETS).map(([name, metadata]) => ({
      endpointUrl: metadata.endpoint_url,
      name,
      programs: metadata.programs ?? [],
      provider: metadata.provider,
      region: metadata.region,
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
}));

import {
  buildControlledAccessForUpload,
  buildUploadObjectKey,
  buildUploadOrganizationOptions,
  buildUploadProjectOptions,
  getUploadAccessMethodType,
  deriveScopeLabelFromResource,
  normalizeUploadSubdirectory,
  resolveUploadBucketName,
} from './utils';

describe('Upload utils', () => {
  it('builds selectable organization and project options from bucket scopes', () => {
    const rawBuckets = {
      S3_BUCKETS: {
        alpha: {
          programs: [
            '/organization/org-a/project/proj-a',
            '/organization/org-a/project/proj-b',
          ],
        },
        bravo: {
          programs: ['/organization/org-b/project/proj-c'],
        },
      },
    };

    expect(buildUploadOrganizationOptions(rawBuckets)).toEqual([
      { label: 'org-a', value: 'org-a' },
      { label: 'org-b', value: 'org-b' },
    ]);

    expect(buildUploadProjectOptions(rawBuckets, 'org-a')).toEqual([
      { label: 'proj-a', value: 'proj-a' },
      { label: 'proj-b', value: 'proj-b' },
    ]);

    expect(
      deriveScopeLabelFromResource('/programs/example-org/projects/example-project'),
    ).toEqual({
      organization: 'example-org',
      project: 'example-project',
    });
  });

  it('normalizes subdirectories and object keys', () => {
    expect(normalizeUploadSubdirectory('/nested/path/')).toBe('nested/path');
    expect(buildUploadObjectKey('file.txt', '/nested/path/')).toBe(
      'nested/path/file.txt',
    );
    expect(buildUploadObjectKey('file.txt', '')).toBe('file.txt');
  });

  it('builds controlled access from the selected organization and project', () => {
    expect(buildControlledAccessForUpload('org-a', 'proj-a')).toEqual([
      '/organization/org-a/project/proj-a',
    ]);

    expect(buildControlledAccessForUpload('org-b', undefined)).toEqual([
      '/organization/org-b',
    ]);

    expect(buildControlledAccessForUpload(undefined, undefined)).toEqual([
      '/data_file',
    ]);
  });

  it('resolves the bucket from selected organization and project scope', () => {
    const rawBuckets = {
      S3_BUCKETS: {
        alpha: {
          programs: ['/organization/org-a/project/proj-a'],
        },
        bravo: {
          programs: ['/organization/org-b'],
        },
      },
    };

    expect(resolveUploadBucketName(rawBuckets, 'org-a', 'proj-a').name).toBe(
      'alpha',
    );
    expect(resolveUploadBucketName(rawBuckets, 'org-b').name).toBe('bravo');
  });

  it('derives provider-aware access method types from the resolved bucket', () => {
    expect(
      getUploadAccessMethodType({
        name: 'gcs-bucket',
        programs: [],
        provider: 'gcs',
        resources: [],
      }),
    ).toBe('gs');
  });
});
