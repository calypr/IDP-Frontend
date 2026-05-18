jest.mock('@gen3/core', () => ({
  SYFON_API: '/data',
  normalizeSyfonResourcePath: (resourcePath: string) => {
    const normalized = resourcePath.replace(/^https?:\/\/[^/]+/i, '');
    const segments = normalized.replace(/^\/+/, '').split('/').filter(Boolean);

    if (segments[0] === 'programs' && segments[1] && segments[2] === 'projects' && segments[3]) {
      return `/organization/${segments[1]}/project/${segments[3]}`;
    }

    if (segments[0] === 'organization' && segments[1] && segments[2] === 'project' && segments[3]) {
      return `/organization/${segments[1]}/project/${segments[3]}`;
    }

    if (segments[0] === 'organization' && segments[1]) {
      return `/organization/${segments[1]}`;
    }

    return normalized.startsWith('/') ? normalized : `/${normalized}`;
  },
}));

import type { SyfonIndexRecord } from '@gen3/core';
import {
  buildRepoListingEntries,
  extractAccessibleProjects,
  getSyfonRepoDownloadUrl,
  normalizeSyfonIndexRecordToRepoFile,
  parsePathQueryValue,
} from './utils';

const createRecord = (overrides: Partial<SyfonIndexRecord>): SyfonIndexRecord => ({
  did: 'did-1',
  ...overrides,
});

describe('OrganizationExplorer utils', () => {
  it('extracts accessible project scopes from authz mappings', () => {
    const projects = extractAccessibleProjects({
      '/organization/org-b/project/proj-z': ['read'],
      '/organization/org-a': ['read'],
      '/organization/org-a/project/proj-a': ['read'],
      '/programs/org-b/projects/proj-z': ['read'],
    });

    expect(projects).toEqual([
      {
        organization: 'org-a',
        project: 'proj-a',
        resourcePath: '/organization/org-a/project/proj-a',
      },
      {
        organization: 'org-b',
        project: 'proj-z',
        resourcePath: '/organization/org-b/project/proj-z',
      },
    ]);
  });

  it('derives repo paths from file_name, name, access URL, and fallback did', () => {
    const namedFile = normalizeSyfonIndexRecordToRepoFile(
      createRecord({
        did: 'did-a',
        file_name: 'nested/file-a.txt',
        name: 'Friendly File A',
      }),
    );

    expect(namedFile.pathSegments).toEqual(['nested', 'file-a.txt']);
    expect(namedFile.displayName).toBe('Friendly File A');

    expect(
      normalizeSyfonIndexRecordToRepoFile(
        createRecord({ did: 'did-b', file_name: 'file-b.txt', name: 'images/file-b.txt' }),
      ).pathSegments,
    ).toEqual(['images', 'file-b.txt']);

    expect(
      normalizeSyfonIndexRecordToRepoFile(
        createRecord({
          access_methods: [
            {
              access_url: {
                url: 's3://bucket/05b29e0d8ae906fe824bdeeeeef458272f61efd436b9d923e5889a3baa416797',
              },
              type: 's3',
            },
          ],
          did: 'did-b2',
          file_name: 'file-0006.dat',
          name: 'file-0006.dat',
        }),
      ).pathSegments,
    ).toEqual(['file-0006.dat']);

    expect(
      normalizeSyfonIndexRecordToRepoFile(
        createRecord({
          access_methods: [
            {
              access_url: { url: 'https://example.org/bucket/path/file-c.txt' },
              type: 's3',
            },
          ],
          did: 'did-c',
        }),
      ).pathSegments,
    ).toEqual(['file-c.txt']);

    expect(
      normalizeSyfonIndexRecordToRepoFile(createRecord({ did: 'did-d' })).pathSegments,
    ).toEqual(['did-d']);
  });

  it('builds deterministic directory and file listings from repo files', () => {
    const files = [
      normalizeSyfonIndexRecordToRepoFile(
        createRecord({ did: 'did-1', file_name: 'alpha/root.txt' }),
      ),
      normalizeSyfonIndexRecordToRepoFile(
        createRecord({ did: 'did-2', file_name: 'alpha/nested/deep.txt' }),
      ),
      normalizeSyfonIndexRecordToRepoFile(
        createRecord({
          did: 'did-3',
          file_name: 'beta.csv',
          name: 'Study Manifest',
        }),
      ),
    ];

    expect(buildRepoListingEntries(files, []).map((entry) => entry.name)).toEqual([
      'alpha',
      'Study Manifest',
    ]);

    expect(
      buildRepoListingEntries(files, ['alpha']).map((entry) => entry.name),
    ).toEqual(['nested', 'root.txt']);
  });

  it('parses route path query values and builds download URLs', () => {
    expect(parsePathQueryValue('nested/a/b')).toEqual(['nested', 'a', 'b']);
    expect(parsePathQueryValue(['nested', 'a/b'])).toEqual(['nested', 'a', 'b']);
    expect(getSyfonRepoDownloadUrl('did-123')).toContain('/download/did-123?redirect=true');
  });
});
