import {
  buildProjectOptions,
  normalizeStoragePath,
  sortStorageRows,
  splitProjectSelectionValue,
} from './storageUtils';

describe('FileSummary hooks helpers', () => {
  it('builds sorted project options from Gecko summary records', () => {
    expect(
      buildProjectOptions([
        { organization: 'org-b', project: 'proj-z' },
        { organization: 'org-a', project: 'proj-a' },
      ]),
    ).toEqual([
      {
        label: 'org-a/proj-a',
        organization: 'org-a',
        project: 'proj-a',
        value: 'org-a/proj-a',
      },
      {
        label: 'org-b/proj-z',
        organization: 'org-b',
        project: 'proj-z',
        value: 'org-b/proj-z',
      },
    ]);
  });

  it('splits a project selection value into organization and project', () => {
    expect(splitProjectSelectionValue('HTAN_INT/BForePC')).toEqual({
      organization: 'HTAN_INT',
      project: 'BForePC',
    });
    expect(splitProjectSelectionValue('invalid')).toBeNull();
  });

  it('normalizes storage paths without changing inner separators', () => {
    expect(normalizeStoragePath('/data/nested/')).toBe('data/nested');
    expect(normalizeStoragePath(' data/nested/file.tsv ')).toBe(
      'data/nested/file.tsv',
    );
    expect(normalizeStoragePath('')).toBe('');
  });

  it('sorts rows by size descending, then directories before files', () => {
    expect(
      sortStorageRows([
        {
          downloadCount: 0,
          fileCount: 1,
          lastDownload: undefined,
          name: 'b.txt',
          path: 'b.txt',
          recordCount: 1,
          sizeBytes: 10,
          type: 'file',
        },
        {
          downloadCount: 0,
          fileCount: 4,
          lastDownload: undefined,
          name: 'nested',
          path: 'nested',
          recordCount: 4,
          sizeBytes: 50,
          type: 'directory',
        },
        {
          downloadCount: 0,
          fileCount: 1,
          lastDownload: undefined,
          name: 'a.txt',
          path: 'a.txt',
          recordCount: 1,
          sizeBytes: 50,
          type: 'file',
        },
      ]),
    ).toEqual([
      {
        downloadCount: 0,
        fileCount: 4,
        lastDownload: undefined,
        name: 'nested',
        path: 'nested',
        recordCount: 4,
        sizeBytes: 50,
        type: 'directory',
      },
      {
        downloadCount: 0,
        fileCount: 1,
        lastDownload: undefined,
        name: 'a.txt',
        path: 'a.txt',
        recordCount: 1,
        sizeBytes: 50,
        type: 'file',
      },
      {
        downloadCount: 0,
        fileCount: 1,
        lastDownload: undefined,
        name: 'b.txt',
        path: 'b.txt',
        recordCount: 1,
        sizeBytes: 10,
        type: 'file',
      },
    ]);
  });
});
