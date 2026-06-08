import {
  buildDeterministicFileActionsMap,
  mergeFileActionsConfig,
  sortConfigIds,
} from './AvailableImages.utils';

describe('AvailableImages.utils', () => {
  it('sorts config ids deterministically', () => {
    expect(sortConfigIds(['zeta', 'alpha', 'beta'])).toEqual([
      'alpha',
      'beta',
      'zeta',
    ]);
  });

  it('merges extension actions without losing either icon', () => {
    expect(
      mergeFileActionsConfig(
        {
          extensions: {
            default: ['file_download'],
            'ome.tiff': ['file_image'],
          },
        },
        {
          extensions: {
            default: ['file_image'],
            'ome.tiff': ['file_download'],
          },
        },
      ),
    ).toEqual({
      actions: {},
      extensions: {
        default: ['file_download', 'file_image'],
        'ome.tiff': ['file_image', 'file_download'],
      },
    });
  });

  it('builds a deterministic per-project file actions map', () => {
    const map = buildDeterministicFileActionsMap([
      {
        configId: 'z-last',
        projectIds: ['program-project-a'],
        fileActions: {
          actions: {
            file_image: '/image',
          },
          extensions: {
            default: ['file_image'],
          },
        },
      },
      {
        configId: 'a-first',
        projectIds: ['program-project-a', 'program-project-b'],
        fileActions: {
          actions: {
            file_download: '/download',
          },
          extensions: {
            default: ['file_download'],
          },
        },
      },
    ]);

    expect(map).toEqual({
      'program-project-a': {
        actions: {
          file_download: '/download',
          file_image: '/image',
        },
        extensions: {
          default: ['file_download', 'file_image'],
        },
      },
      'program-project-b': {
        actions: {
          file_download: '/download',
        },
        extensions: {
          default: ['file_download'],
        },
      },
    });
  });
});
