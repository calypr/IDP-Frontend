import {
  duplicateProjectConfig,
  moveArrayItem,
  projectConfigFromCatalog,
  projectViewFrameRef,
  removeUnavailableViewBindings,
  viewForFrameReference,
} from './projectViewDraft';
import type { ProjectViewBuilderCatalog, ProjectViewConfig } from '@gen3/core';

const catalog: ProjectViewBuilderCatalog = {
  recipeName: 'published_recipe',
  revisionId: 'catalog-r1',
  executionId: 'execution-r1',
  generation: 'generation-r1',
  frames: [
    {
      id: 'Specimen',
      title: 'Specimens',
      columns: [
        {
          name: 'specimen_id',
          label: 'Specimen ID',
          logicalType: 'string',
          cardinality: 'required_one',
          filterable: true,
          chartable: true,
        },
        {
          name: 'members',
          label: 'Members',
          logicalType: 'string',
          cardinality: 'many',
          filterable: false,
          chartable: false,
        },
      ],
    },
  ],
};

const config: ProjectViewConfig = {
  id: 'metadata',
  title: 'Metadata',
  recipeRef: { name: 'published_recipe', untouched: 'recipe-option' },
  views: [
    {
      id: 'specimen-tab',
      title: 'Specimens',
      output: 'Specimen',
      table: {
        columns: [
          { column: 'specimen_id', label: 'ID', visible: true, pinned: true },
          { column: 'missing_table', label: 'Old', visible: false },
        ],
      },
      filters: [
        { column: 'specimen_id', label: 'ID filter' },
        { column: 'missing_filter', label: 'Old filter' },
      ],
      charts: [
        { column: 'specimen_id', type: 'bar', title: 'Counts' },
        { column: 'members', type: 'pie', title: 'Unsafe chart' },
      ],
      fixedFilters: { specimen_id: ['A'], missing_fixed: ['B'] },
      actions: [
        {
          type: 'download',
          title: 'Download',
          columns: ['specimen_id', 'missing_action'],
          exportHeaders: { specimen_id: 'ID', missing_header: 'Old' },
        },
      ],
      untouchedViewOption: { preserve: true },
    },
    {
      id: 'patient-tab',
      title: 'Patients',
      output: 'Patient',
      table: { columns: [{ column: 'keep', visible: true }] },
      filters: [{ column: 'keep' }],
    },
  ],
  sharedFilters: {
    cohort: [
      { output: 'Specimen', column: 'missing_shared' },
      { output: 'Patient', column: 'keep' },
    ],
  },
  fileActions: {
    extensions: { csv: ['download'] },
    actions: { download: 'Download' },
  },
  untouchedConfigOption: { preserve: true },
};

describe('project view draft helpers', () => {
  it('creates a view from real catalog frames and uses qualified stable frame references', () => {
    const created = projectConfigFromCatalog(catalog, 'Clinical metadata', []);
    expect(created.id).toBe('clinical-metadata');
    expect(created.recipeRef.name).toBe('published_recipe');
    expect(created.views).toHaveLength(1);
    expect(created.views[0]?.output).toBe('Specimen');
    expect(created.views[0]?.table.columns).toEqual([
      { column: 'specimen_id', label: 'Specimen ID', visible: true },
      { column: 'members', label: 'Members', visible: true },
    ]);
    expect(projectViewFrameRef('published_recipe', 'Specimen')).toBe(
      'published_recipe/Specimen',
    );
    expect(
      viewForFrameReference(created, 'other_recipe/Specimen'),
    ).toBeUndefined();
    expect(
      viewForFrameReference(created, 'published_recipe/Specimen')?.id,
    ).toBe(created.views[0]?.id);
  });

  it('duplicates configs while retaining unknown options and assigning new view identities', () => {
    const duplicate = duplicateProjectConfig(config, 'Metadata copy', [
      'metadata',
    ]);
    expect(duplicate.id).toBe('metadata-copy');
    expect(duplicate.untouchedConfigOption).toEqual({ preserve: true });
    expect(duplicate.recipeRef.untouched).toBe('recipe-option');
    expect(duplicate.views[0]?.untouchedViewOption).toEqual({ preserve: true });
    expect(duplicate.views[0]?.id).not.toBe(config.views[0]?.id);
    expect(duplicate.views[0]?.actions?.[0]?.columns).toEqual([
      'specimen_id',
      'missing_action',
    ]);
    expect(duplicate.views[0]?.table.columns[0]?.pinned).toBe(true);
  });

  it('reports stale bindings and removes them only from the explicitly selected tab', () => {
    const result = removeUnavailableViewBindings(
      config,
      catalog,
      'specimen-tab',
    );
    expect(result.removed).toEqual(
      expect.arrayContaining([
        expect.stringContaining('missing_table'),
        expect.stringContaining('missing_filter'),
        expect.stringContaining('members'),
        expect.stringContaining('missing_fixed'),
        expect.stringContaining('missing_action'),
        expect.stringContaining('missing_header'),
        expect.stringContaining('missing_shared'),
      ]),
    );
    expect(result.config.untouchedConfigOption).toEqual({ preserve: true });
    expect(result.config.views[0]?.untouchedViewOption).toEqual({
      preserve: true,
    });
    expect(
      result.config.views[0]?.table.columns.map((column) => column.column),
    ).toEqual(['specimen_id']);
    expect(
      result.config.views[0]?.filters?.map((filter) => filter.column),
    ).toEqual(['specimen_id']);
    expect(
      result.config.views[0]?.charts?.map((chart) => chart.column),
    ).toEqual(['specimen_id']);
    expect(result.config.views[0]?.actions?.[0]?.columns).toEqual([
      'specimen_id',
    ]);
    expect(result.config.views[1]).toEqual(config.views[1]);
    expect(result.config.sharedFilters?.cohort).toEqual([
      { output: 'Patient', column: 'keep' },
    ]);
  });

  it('moves array items without mutating the input or changing order at the boundary', () => {
    const input = ['first', 'second', 'third'];
    expect(moveArrayItem(input, 0, 1)).toEqual(['second', 'first', 'third']);
    expect(moveArrayItem(input, 2, 1)).toEqual(input);
    expect(input).toEqual(['first', 'second', 'third']);
  });
});
