import type { DirItem, DirectoryContents, ProjectItem } from '@gen3/core';
import {
  buildBrowserColumns,
  getDirectoryCacheKey,
  isBrowserItemSelected,
} from './utils';

const project = (name: string): ProjectItem => ({
  id: name,
  name,
  type: 'project',
});

const dir = (name: string): DirItem => ({
  id: `dir-${name}`,
  name,
  type: 'directory',
});

const file = (name: string): DirItem => ({
  id: `file-${name}`,
  name,
  type: 'file',
});

const contents = (...items: Array<DirItem>): DirectoryContents => ({
  items,
});

describe('Browser utils', () => {
  it('builds deterministic columns from navigation state and cache', () => {
    const columns = buildBrowserColumns({
      projectItems: [project('program-project')],
      selectedProject: 'program-project',
      selectedPath: ['folder-a'],
      selectedFile: file('sample.ome.tiff'),
      directoryCache: {
        [getDirectoryCacheKey('program-project', [])]: contents(
          dir('folder-a'),
          file('root.txt'),
        ),
        [getDirectoryCacheKey('program-project', ['folder-a'])]: contents(
          file('sample.ome.tiff'),
        ),
      },
      isLoadingProjects: false,
      loadingPathKey: null,
    });

    expect(columns.map((column) => column.id)).toEqual([
      'root-projects',
      'dir-program-project-root',
      'dir-program-project-folder-a',
      'file-metadata-file-sample.ome.tiff',
    ]);
  });

  it('adds a loading column only for the unresolved active path', () => {
    const loadingPathKey = getDirectoryCacheKey('program-project', ['folder-a']);
    const columns = buildBrowserColumns({
      projectItems: [project('program-project')],
      selectedProject: 'program-project',
      selectedPath: ['folder-a'],
      selectedFile: null,
      directoryCache: {
        [getDirectoryCacheKey('program-project', [])]: contents(dir('folder-a')),
      },
      isLoadingProjects: false,
      loadingPathKey,
    });

    expect(columns[2]).toEqual({
      id: 'dir-loading-program-project-folder-a',
      loading: true,
    });
  });

  it('computes selection state consistently for project, folder, and file rows', () => {
    expect(
      isBrowserItemSelected({
        item: project('program-project'),
        columnIndex: 0,
        selectedProject: 'program-project',
        selectedPath: [],
        selectedFile: null,
      }),
    ).toBe(true);

    expect(
      isBrowserItemSelected({
        item: dir('folder-a'),
        columnIndex: 1,
        selectedProject: 'program-project',
        selectedPath: ['folder-a'],
        selectedFile: null,
      }),
    ).toBe(true);

    expect(
      isBrowserItemSelected({
        item: file('sample.ome.tiff'),
        columnIndex: 2,
        selectedProject: 'program-project',
        selectedPath: ['folder-a'],
        selectedFile: file('sample.ome.tiff'),
      }),
    ).toBe(true);
  });
});
