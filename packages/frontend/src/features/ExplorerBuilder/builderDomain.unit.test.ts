import type { ExplorerConfigV2 } from '@gen3/core';
import {
  builderTables,
  canonicalizeExplorerConfig,
  candidateMatchesConfiguredSelection,
  createBuilderSession,
  digestExplorerPreview,
  explorerBuilderReducer,
  filterLinkedGraph,
  graphDistancesFromRoot,
  initialStateFromConfig,
  previewCacheKey,
  publishedConfigFromServer,
  reachableRelationshipsForResource,
  presentationDiagnostics,
  rowGrainForResource,
  slugifyExplorerId,
  traversalAliasForRelationship,
  traversalIncludesRelationship,
} from './builderDomain';
import type { CatalogCandidate } from './builderDomain';

const graphField = (resourceType: string, id: string): CatalogCandidate => ({
  id,
  resourceType,
  path: id,
  label: id,
  logicalType: 'string',
  repeated: false,
});

const config: ExplorerConfigV2 = {
  apiVersion: 'loom.calypr.org/explorer-config/v2',
  kind: 'ExplorerConfig',
  project: 'demo',
  explorer: { id: 'default', title: 'Repository', management: 'repository' },
  recipe: {
    schemaVersion: 2,
    outputs: [
      {
        name: 'patients',
        title: 'People',
        rootResourceType: 'Patient',
        rowGrain: 'patient',
        fields: [{ name: 'id', label: 'Person ID' }],
      },
    ],
  },
  views: [
    {
      id: 'view-patients',
      title: 'People',
      output: 'patients',
      table: { columns: [{ column: 'id', label: 'Person ID', visible: true }] },
    },
  ],
};

describe('ExplorerConfig V2 Builder domain', () => {
  it('uses the active packet as the published Builder state when draft and active differ', () => {
    const draft = {
      ...config,
      explorer: { ...config.explorer, title: 'Draft' },
    };
    const active = {
      ...config,
      explorer: { ...config.explorer, title: 'Active' },
    };

    expect(
      publishedConfigFromServer({ activeConfig: active, draftConfig: draft }),
    ).toBe(active);
  });

  it('derives safe, collision-checkable ids from one creation name', () => {
    expect(slugifyExplorerId('Biospecimen review')).toBe('biospecimen-review');
    expect(slugifyExplorerId('123 review')).toBe('explorer-123-review');
    expect(slugifyExplorerId('')).toBe('');
  });

  it('uses Loom row-grain names instead of lowercasing resource types', () => {
    expect(rowGrainForResource('DocumentReference')).toBe('file');
    expect(rowGrainForResource('ResearchSubject')).toBe('study_enrollment');
    expect(rowGrainForResource('MedicationAdministration')).toBe('resource');
    expect(rowGrainForResource('GroupMember')).toBe('expanded');
    expect(rowGrainForResource('SubstanceDefinition')).toBe('resource');
  });

  it('keeps every reachable graph resource instead of truncating traversal depth', () => {
    const relationships = Array.from({ length: 6 }, (_, index) => ({
      id: `edge-${index}`,
      source: index === 0 ? 'Patient' : `Resource${index}`,
      target: `Resource${index + 1}`,
      label: `link-${index}`,
    }));
    const distances = graphDistancesFromRoot('Patient', relationships);
    expect(distances.size).toBe(7);
    expect(distances.get('Resource6')).toBe(6);
  });

  it('finds every relationship that can extend the traversal to a clicked node', () => {
    const relationships = [
      {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'specimen',
      },
      {
        id: 'file-specimen',
        source: 'File',
        target: 'Specimen',
        label: 'subject',
      },
      {
        id: 'patient-file',
        source: 'Patient',
        target: 'File',
        label: 'file',
      },
    ];

    expect(
      reachableRelationshipsForResource(relationships, 'Specimen', 'Patient', [
        {
          alias: 'files',
          toResourceType: 'File',
          name: 'file',
          fields: [],
        },
      ]).map((relationship) => relationship.id),
    ).toEqual(['patient-specimen', 'file-specimen']);
    expect(
      reachableRelationshipsForResource(
        relationships,
        'File',
        'Patient',
        [],
      ).map((relationship) => relationship.id),
    ).toEqual(['patient-file']);
    expect(
      reachableRelationshipsForResource(
        relationships,
        'Patient',
        'Patient',
        [],
      ),
    ).toEqual([]);
  });

  it('removes zero-record and isolated resources from the traversal graph', () => {
    const filtered = filterLinkedGraph(
      [
        {
          resourceType: 'Patient',
          label: 'People',
          count: 3,
          fields: [graphField('Patient', 'patient-id')],
        },
        {
          resourceType: 'Specimen',
          label: 'Biospecimens',
          count: 2,
          fields: [graphField('Specimen', 'specimen-id')],
        },
        {
          resourceType: 'Organization',
          label: 'Organization',
          count: 4,
          fields: [],
        },
        { resourceType: 'Empty', label: 'Empty', count: 0, fields: [] },
        { resourceType: 'NoFields', label: 'No fields', count: 4, fields: [] },
      ],
      [
        {
          id: 'Patient/specimen/Specimen',
          source: 'Patient',
          target: 'Specimen',
          label: 'specimen',
        },
        {
          id: 'Patient/no-fields/NoFields',
          source: 'Patient',
          target: 'NoFields',
          label: 'no-fields',
        },
        {
          id: 'Empty/organization/Organization',
          source: 'Empty',
          target: 'Organization',
          label: 'organization',
        },
      ],
    );
    expect(filtered.resources.map((resource) => resource.resourceType)).toEqual(
      ['Patient', 'Specimen'],
    );
    expect(
      filtered.relationships.map((relationship) => relationship.id),
    ).toEqual(['Patient/specimen/Specimen']);
  });

  it('canonicalizes object keys without changing array order', () => {
    expect(
      canonicalizeExplorerConfig({
        ...config,
        explorer: { ...config.explorer, description: 'x' },
      }),
    ).toContain('"description":"x"');
    expect(canonicalizeExplorerConfig(config)).toBe(
      canonicalizeExplorerConfig({ ...config, views: [...config.views] }),
    );
  });

  it('removes legacy column order metadata when hydrating a config', async () => {
    const legacyConfig = {
      ...config,
      views: config.views.map((view) => ({
        ...view,
        table: {
          ...view.table,
          columns: view.table.columns.map((column, index) => ({
            ...column,
            order: index,
          })),
        },
      })),
    } as ExplorerConfigV2;

    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      legacyConfig,
    );

    expect(loaded.config?.views[0].table.columns[0]).toEqual({
      column: 'id',
      label: 'Person ID',
      visible: true,
    });
  });

  it('hydrates tables and edits recipe/view presentation together', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
      3,
      'sha256:demo',
    );
    expect(builderTables(loaded.config)[0].rootResourceType).toBe('Patient');
    const renamed = explorerBuilderReducer(loaded, {
      type: 'setColumnLabel',
      output: 'patients',
      column: 'id',
      label: 'Patient identifier',
    });
    expect(renamed.config?.views[0].table.columns[0].label).toBe(
      'Patient identifier',
    );
    expect(renamed.config?.recipe.outputs?.[0].fields?.[0].label).toBe(
      'Person ID',
    );
    const filtered = explorerBuilderReducer(renamed, {
      type: 'setFilter',
      output: 'patients',
      column: 'id',
      enabled: true,
      label: 'Patient identifier',
    });
    expect(filtered.config?.views[0].filters?.[0].column).toBe('id');
  });

  it('supports dropping a column before or after an adjacent column', async () => {
    const sourceOutput = config.recipe.outputs?.[0];
    if (!sourceOutput) throw new Error('Test config is missing its output');
    const reorderConfig = {
      ...config,
      recipe: {
        ...config.recipe,
        outputs: [
          {
            ...sourceOutput,
            fields: [
              ...(sourceOutput.fields ?? []),
              { name: 'status', label: 'Status' },
              { name: 'file', label: 'File' },
            ],
          },
        ],
      },
      views: [
        {
          ...config.views[0],
          table: {
            columns: [
              ...config.views[0].table.columns,
              { column: 'status', label: 'Status', visible: true },
              { column: 'file', label: 'File', visible: true },
            ],
          },
        },
      ],
    };
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      reorderConfig,
    );
    const before = explorerBuilderReducer(loaded, {
      type: 'reorderColumn',
      output: 'patients',
      column: 'file',
      before: 'id',
    });
    expect(
      before.config?.views[0].table.columns.map(({ column }) => column),
    ).toEqual(['file', 'id', 'status']);
    const after = explorerBuilderReducer(before, {
      type: 'reorderColumn',
      output: 'patients',
      column: 'file',
      after: 'id',
    });
    expect(
      after.config?.views[0].table.columns.map(({ column }) => column),
    ).toEqual(['id', 'file', 'status']);
  });

  it('keeps bulk column visibility reversible when every column is hidden', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const hidden = explorerBuilderReducer(loaded, {
      type: 'setColumnsVisible',
      output: 'patients',
      visible: false,
    });
    expect(hidden.config?.views[0].table.columns[0].visible).toBe(false);
    const restored = explorerBuilderReducer(hidden, {
      type: 'setColumnsVisible',
      output: 'patients',
      visible: true,
    });
    expect(restored.config?.views[0].table.columns[0].visible).toBe(true);
  });

  it('duplicates a table with its presentation settings and keeps the source', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const duplicate = explorerBuilderReducer(loaded, {
      type: 'duplicateTable',
      sourceOutput: 'patients',
      output: 'patients-copy',
      title: 'People copy',
    });
    expect(duplicate.config?.recipe.outputs).toHaveLength(2);
    expect(
      duplicate.config?.views.find((view) => view.output === 'patients-copy')
        ?.table.columns[0].label,
    ).toBe('Person ID');
    expect(duplicate.selectedOutput).toBe('patients-copy');
    expect(duplicate.selectedNodeKey).toBe('patients-copy|root:Patient');
  });

  it('opens a new table at row-root selection instead of retaining the prior resource', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const added = explorerBuilderReducer(loaded, {
      type: 'addTable',
      output: 'specimens',
      title: 'Biospecimens',
    });
    expect(added.selectedOutput).toBe('specimens');
    expect(added.selectedResource).toBeUndefined();
    expect(added.selectedNodeKey).toBeUndefined();
    expect(
      added.config?.recipe.outputs?.find((item) => item.name === 'specimens'),
    ).not.toHaveProperty('title');
    expect(
      added.config?.views.find((view) => view.output === 'specimens')?.title,
    ).toBe('Biospecimens');
  });

  it('discard restores the active published packet', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const edited = explorerBuilderReducer(loaded, {
      type: 'renameTable',
      output: 'patients',
      title: 'Changed',
    });
    const discarded = explorerBuilderReducer(edited, { type: 'discard' });
    expect(discarded.config?.views[0].title).toBe('People');
    expect(discarded.dirty).toBe(false);
  });

  it('discard restores the acknowledged draft when no publication exists yet', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
      2,
      'sha256:draft',
      null,
    );
    const edited = explorerBuilderReducer(loaded, {
      type: 'renameTable',
      output: 'patients',
      title: 'Changed',
    });
    const discarded = explorerBuilderReducer(edited, { type: 'discard' });
    expect(discarded.config?.views[0].title).toBe('People');
    expect(discarded.dirty).toBe(false);
  });

  it('keeps branched traversals in the recipe tree and removes descendants together', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const withSpecimen = explorerBuilderReducer(loaded, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'has biospecimen',
      },
    });
    const withFile = explorerBuilderReducer(withSpecimen, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'specimen-file',
        source: 'Specimen',
        target: 'File',
        label: 'has file',
      },
    });
    expect(
      withFile.config?.recipe.outputs?.[0].traversals?.[0].children?.[0]
        .toResourceType,
    ).toBe('File');
    const removed = explorerBuilderReducer(withFile, {
      type: 'removeTraversal',
      output: 'patients',
      nodeKey: traversalAliasForRelationship(
        withSpecimen.config?.recipe.outputs?.[0].traversals ?? [],
        {
          id: 'patient-specimen',
          source: 'Patient',
          target: 'Specimen',
          label: 'has biospecimen',
        },
      ),
    });
    expect(removed.config?.recipe.outputs?.[0].traversals).toHaveLength(0);
  });

  it('matches graph edges to authored traversal metadata without persisting graph ids', () => {
    const traversals = [
      {
        alias: 'specimen_has_biospecimen',
        resourceType: 'Specimen',
        relationship: 'has biospecimen',
        direction: 'outbound' as const,
        children: [],
      },
    ];
    expect(
      traversalIncludesRelationship(
        traversals,
        {
          id: 'Patient/has biospecimen/Specimen',
          source: 'Patient',
          target: 'Specimen',
          label: 'has biospecimen',
        },
        'Patient',
      ),
    ).toBe(true);
    expect(
      traversalIncludesRelationship(
        [
          {
            alias: 'specimen_belongs_to_patient',
            resourceType: 'Specimen',
            relationship: 'belongs to',
            direction: 'inbound' as const,
            children: [],
          },
        ],
        {
          id: 'Specimen/belongs to/Patient',
          source: 'Specimen',
          target: 'Patient',
          label: 'belongs to',
        },
        'Patient',
      ),
    ).toBe(true);
  });

  it('rejects cycles and relationships whose source is outside the included traversal', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const withSpecimen = explorerBuilderReducer(loaded, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'has biospecimen',
      },
    });
    const cycle = explorerBuilderReducer(withSpecimen, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'specimen-patient',
        source: 'Specimen',
        target: 'Patient',
        label: 'belongs to',
      },
    });
    expect(cycle.config?.recipe.outputs?.[0].traversals).toHaveLength(1);
    expect(cycle.dirty).toBe(true);
    const unrelated = explorerBuilderReducer(withSpecimen, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'file-patient',
        source: 'File',
        target: 'Patient',
        label: 'unrelated',
      },
    });
    expect(unrelated.config).toBe(withSpecimen.config);
  });

  it('writes selected fields into a branched resource without persisting catalog ids', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const withSpecimen = explorerBuilderReducer(loaded, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'has biospecimen',
      },
    });
    const specimenAlias = traversalAliasForRelationship(
      withSpecimen.config?.recipe.outputs?.[0].traversals ?? [],
      {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'has biospecimen',
      },
    );
    const candidate: CatalogCandidate = {
      id: 'specimen-status-id',
      resourceType: 'Specimen',
      path: 'status',
      label: 'Status',
      logicalType: 'string',
      repeated: false,
    };
    const selected = explorerBuilderReducer(withSpecimen, {
      type: 'setCandidate',
      output: 'patients',
      nodeKey: `patients|${specimenAlias}`,
      candidate,
      selected: true,
    });
    const traversal = selected.config?.recipe.outputs?.[0].traversals?.[0];
    expect(traversal?.fields?.[0]).toEqual(
      expect.objectContaining({
        name: 'Specimen__status',
        logicalType: 'string',
        repeated: false,
      }),
    );
    expect(JSON.stringify(selected.config)).not.toContain('specimen-status-id');
    expect(specimenAlias).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('keeps public column names unique across root and traversal resources', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const withSpecimen = explorerBuilderReducer(loaded, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'has biospecimen',
      },
    });
    const candidate: CatalogCandidate = {
      id: 'specimen-id',
      resourceType: 'Specimen',
      path: 'id',
      label: 'Biospecimen ID',
      logicalType: 'string',
      repeated: false,
    };
    const selected = explorerBuilderReducer(withSpecimen, {
      type: 'setCandidate',
      output: 'patients',
      nodeKey: `patients|${traversalAliasForRelationship(
        loaded.config?.recipe.outputs?.[0].traversals ?? [],
        {
          id: 'patient-specimen',
          source: 'Patient',
          target: 'Specimen',
          label: 'has biospecimen',
        },
      )}`,
      candidate,
      selected: true,
    });
    expect(
      selected.config?.views[0].table.columns.map((column) => column.column),
    ).toEqual(['id', 'Specimen__id']);
    expect(
      selected.config?.recipe.outputs?.[0].traversals?.[0].fields?.[0]?.name,
    ).toBe('Specimen__id');
  });

  it('normalizes catalog paths into executable recipe identifiers', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const selected = explorerBuilderReducer(loaded, {
      type: 'setCandidate',
      output: 'patients',
      nodeKey: 'patients|root:Patient',
      candidate: {
        id: 'patient-category-system',
        resourceType: 'Patient',
        path: 'category[].coding[].system',
        publicName: 'category[].coding[].system',
        label: 'Category system',
        logicalType: 'string',
        repeated: false,
      },
      selected: true,
    });

    expect(selected.config?.recipe.outputs?.[0].fields?.[1]).toMatchObject({
      name: 'category_coding_system',
      expr: { select: 'root.category[].coding[].system' },
    });
    expect(selected.config?.views[0].table.columns[1].column).toBe(
      'category_coding_system',
    );
  });

  it('removes descendant presentation references with a traversal', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const withSpecimen = explorerBuilderReducer(loaded, {
      type: 'addTraversal',
      output: 'patients',
      relationship: {
        id: 'patient-specimen',
        source: 'Patient',
        target: 'Specimen',
        label: 'has biospecimen',
      },
    });
    const candidate: CatalogCandidate = {
      id: 'specimen-status-id',
      resourceType: 'Specimen',
      path: 'status',
      label: 'Status',
      logicalType: 'string',
      repeated: false,
    };
    const selected = explorerBuilderReducer(withSpecimen, {
      type: 'setCandidate',
      output: 'patients',
      nodeKey: `patients|${traversalAliasForRelationship(
        withSpecimen.config?.recipe.outputs?.[0].traversals ?? [],
        {
          id: 'patient-specimen',
          source: 'Patient',
          target: 'Specimen',
          label: 'has biospecimen',
        },
      )}`,
      candidate,
      selected: true,
    });
    const filtered = explorerBuilderReducer(selected, {
      type: 'setFilter',
      output: 'patients',
      column: 'Specimen__status',
      enabled: true,
      label: 'Status',
    });
    const shared = explorerBuilderReducer(filtered, {
      type: 'setSharedFilter',
      name: 'Status',
      mappings: [{ output: 'patients', column: 'Specimen__status' }],
    });
    const removed = explorerBuilderReducer(shared, {
      type: 'removeTraversal',
      output: 'patients',
      nodeKey: traversalAliasForRelationship(
        withSpecimen.config?.recipe.outputs?.[0].traversals ?? [],
        {
          id: 'patient-specimen',
          source: 'Patient',
          target: 'Specimen',
          label: 'has biospecimen',
        },
      ),
    });
    expect(removed.config?.views[0].table.columns).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'Specimen__status' }),
      ]),
    );
    expect(removed.config?.views[0].filters).toEqual([]);
    expect(removed.config?.sharedFilters).toBeUndefined();
  });

  it('keeps presentation-only actions and shared-filter removal in the V2 packet', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const withAction = explorerBuilderReducer(loaded, {
      type: 'setFileAction',
      name: 'Open BAM',
      targetRoute: '/files/open',
    });
    const withExtension = explorerBuilderReducer(withAction, {
      type: 'setFileActionExtensions',
      extension: '.bam',
      actions: ['Open BAM'],
    });
    const withShared = explorerBuilderReducer(withExtension, {
      type: 'setSharedFilter',
      name: 'Status',
      mappings: [{ output: 'patients', column: 'id', logicalType: 'string' }],
    });
    expect(withShared.config?.fileActions?.extensions?.['.bam']).toEqual([
      'Open BAM',
    ]);
    expect(withShared.config?.sharedFilters?.Status).toHaveLength(1);
    const removed = explorerBuilderReducer(withShared, {
      type: 'removeSharedFilter',
      name: 'Status',
    });
    expect(removed.config?.sharedFilters?.Status).toBeUndefined();
  });

  it('changes the preview identity when output or row limit changes', async () => {
    const tenRows = await digestExplorerPreview(config, 'patients', 10);
    const fiftyRows = await digestExplorerPreview(config, 'patients', 50);
    const otherOutput = await digestExplorerPreview(config, 'other', 10);
    expect(tenRows).not.toBe(fiftyRows);
    expect(tenRows).not.toBe(otherOutput);
  });

  it('caches successful previews by output and complete digest and rejects stale responses', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const loading = explorerBuilderReducer(loaded, {
      type: 'previewLoading',
      output: 'patients',
      digest: 'sha256:new',
    });
    const stale = explorerBuilderReducer(loading, {
      type: 'previewReady',
      output: 'patients',
      digest: 'sha256:old',
      data: { output: 'patients', columns: [], rows: [], rowCount: 0 },
    });
    expect(stale).toBe(loading);
    const ready = explorerBuilderReducer(loading, {
      type: 'previewReady',
      output: 'patients',
      digest: 'sha256:new',
      data: { output: 'patients', columns: [], rows: [], rowCount: 0 },
    });
    expect(
      ready.previewCache[previewCacheKey('patients', 'sha256:new')],
    ).toEqual(expect.objectContaining({ status: 'ready' }));
  });

  it('reports broken presentation and file-action references before publication', () => {
    const invalid: ExplorerConfigV2 = {
      ...config,
      views: [
        {
          ...config.views[0],
          table: {
            columns: [
              ...config.views[0].table.columns,
              { column: 'missing', visible: true },
            ],
          },
          actions: [
            { type: 'download', title: 'Download', columns: ['missing'] },
          ],
        },
      ],
      fileActions: {
        actions: { Open: '/open' },
        extensions: { '.bam': ['Missing'] },
      },
    };
    expect(presentationDiagnostics(invalid).map((item) => item.code)).toEqual(
      expect.arrayContaining([
        'VIEW_COLUMN_MISSING',
        'ACTION_COLUMN_MISSING',
        'FILE_ACTION_REFERENCE_MISSING',
      ]),
    );
  });

  it('hydrates snapshot-local candidate selections from existing native fields', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const hydrated = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog: {
        complete: true,
        diagnostics: [],
        resources: [
          {
            resourceType: 'Patient',
            label: 'People',
            fields: [
              {
                id: 'candidate-id',
                resourceType: 'Patient',
                path: 'id',
                label: 'Person ID',
                logicalType: 'string',
                repeated: false,
              },
            ],
          },
        ],
        relationships: [],
      },
    });
    expect(
      hydrated.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['candidate-id']);
  });

  it('does not merge opaque selections across catalog snapshots', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const firstSnapshot = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog: {
        snapshotToken: 'snapshot-1',
        complete: true,
        diagnostics: [],
        resources: [
          {
            resourceType: 'Patient',
            label: 'People',
            fields: [
              {
                id: 'candidate-id',
                resourceType: 'Patient',
                path: 'id',
                label: 'Person ID',
                logicalType: 'string',
                repeated: false,
              },
            ],
          },
        ],
        relationships: [],
      },
    });
    const secondSnapshot = explorerBuilderReducer(firstSnapshot, {
      type: 'setCatalog',
      catalog: {
        snapshotToken: 'snapshot-2',
        complete: true,
        diagnostics: [],
        resources: [
          {
            resourceType: 'Patient',
            label: 'People',
            fields: [
              {
                id: 'candidate-name',
                resourceType: 'Patient',
                path: 'name',
                label: 'Person name',
                logicalType: 'string',
                repeated: false,
                selected: true,
              },
            ],
          },
        ],
        relationships: [],
      },
    });
    expect(
      secondSnapshot.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['candidate-name']);
    expect(
      secondSnapshot.selectedCandidateIdsByNode['patients|root:Patient'],
    ).not.toContain('candidate-id');
  });

  it('invalidates the catalog when the row resource changes', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const hydrated = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog: {
        snapshotToken: 'snapshot-1',
        scopeKey: 'patients:Patient',
        complete: true,
        diagnostics: [],
        resources: [],
        relationships: [],
      },
    });
    const changed = explorerBuilderReducer(hydrated, {
      type: 'setRoot',
      output: 'patients',
      resourceType: 'ResearchStudy',
    });
    expect(changed.catalog.complete).toBe(false);
    expect(changed.catalog.snapshotToken).toBeUndefined();
    expect(changed.selectedCandidateIdsByNode).toEqual({});
  });

  it('hydrates configured table columns even when the recipe field list is incomplete', async () => {
    const configured = {
      ...config,
      views: [
        {
          ...config.views[0],
          table: {
            columns: [
              ...config.views[0].table.columns,
              { column: 'file_name', label: 'File name', visible: true },
            ],
          },
        },
      ],
    };
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const catalog = {
      complete: true,
      diagnostics: [],
      resources: [
        {
          resourceType: 'Patient',
          label: 'People',
          fields: [
            {
              ...graphField('Patient', 'candidate-id'),
              publicName: 'id',
            },
            graphField('Patient', 'file_name'),
          ],
        },
      ],
      relationships: [],
    };
    const hydrated = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog,
    });
    expect(
      hydrated.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['candidate-id']);

    const refreshed = explorerBuilderReducer(
      { ...hydrated, config: configured },
      {
        type: 'setCatalog',
        catalog,
      },
    );
    expect(
      refreshed.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['candidate-id', 'file_name']);
    expect(
      candidateMatchesConfiguredSelection(
        configured,
        'patients',
        'patients|root:Patient',
        graphField('Patient', 'file_name'),
      ),
    ).toBe(true);

    const cleared = explorerBuilderReducer(refreshed, {
      type: 'setCandidate',
      output: 'patients',
      nodeKey: 'patients|root:Patient',
      candidate: graphField('Patient', 'file_name'),
      selected: false,
    });
    expect(cleared.config?.views[0].table.columns).toEqual([
      { column: 'id', label: 'Person ID', visible: true },
    ]);
    expect(cleared.selectedCandidateIdsByNode['patients|root:Patient']).toEqual(
      ['candidate-id'],
    );
  });

  it('does not hydrate a same-named candidate from another resource under root', async () => {
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      config,
    );
    const hydrated = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog: {
        snapshotToken: 'snapshot-1',
        complete: true,
        diagnostics: [],
        resources: [
          {
            resourceType: 'Patient',
            label: 'People',
            fields: [
              {
                ...graphField('Patient', 'patient-id'),
                path: 'id',
                publicName: 'id',
              },
            ],
          },
          {
            resourceType: 'SubstanceDefinition',
            label: 'Substances',
            fields: [
              {
                ...graphField('SubstanceDefinition', 'substance-id'),
                path: 'id',
                publicName: 'id',
                selected: true,
              },
            ],
          },
        ],
        relationships: [],
      },
    });

    expect(
      hydrated.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['patient-id']);
    expect(
      hydrated.selectedCandidateIdsByNode['patients|root:SubstanceDefinition'],
    ).toEqual([]);

    const refreshed = explorerBuilderReducer(
      {
        ...hydrated,
        selectedCandidateIdsByNode: {
          ...hydrated.selectedCandidateIdsByNode,
          'patients|root:SubstanceDefinition': ['substance-id'],
        },
      },
      { type: 'setCatalog', catalog: hydrated.catalog },
    );
    expect(
      refreshed.selectedCandidateIdsByNode['patients|root:SubstanceDefinition'],
    ).toEqual([]);
  });

  it('matches logical config names to qualified and sanitized catalog paths', async () => {
    const configured: ExplorerConfigV2 = {
      ...config,
      recipe: {
        ...config.recipe,
        outputs: [
          {
            ...config.recipe.outputs![0],
            fields: [
              { name: 'id' },
              { name: 'identifier_system' },
              { name: 'identifier' },
            ],
          },
        ],
      },
      views: [
        {
          ...config.views[0],
          table: {
            columns: [
              { column: 'id', visible: true },
              { column: 'identifier_system', visible: true },
              { column: 'identifier', visible: true },
            ],
          },
        },
      ],
    };
    const systemCandidate: CatalogCandidate = {
      id: 'identifier-system',
      resourceType: 'Patient',
      path: 'identifier[].system',
      label: 'identifier[].system',
      publicName: 'identifier[].system',
      selectionKey: 'Patient.identifier[].system',
      valueSelector: 'identifier[].system',
      logicalType: 'string',
      repeated: true,
    };
    const identifierCandidate: CatalogCandidate = {
      id: 'identifier',
      resourceType: 'Patient',
      path: 'Patient#identifier',
      label: 'identifier',
      publicName: 'Patient#identifier',
      selectionKey: 'Patient#identifier',
      valueSelector: 'Patient#identifier',
      logicalType: 'string',
      repeated: true,
    };
    expect(
      candidateMatchesConfiguredSelection(
        configured,
        'patients',
        'patients|root:Patient',
        systemCandidate,
      ),
    ).toBe(true);
    expect(
      candidateMatchesConfiguredSelection(
        configured,
        'patients',
        'patients|root:Patient',
        identifierCandidate,
      ),
    ).toBe(true);

    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      configured,
    );
    const hydrated = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog: {
        complete: true,
        diagnostics: [],
        resources: [
          {
            resourceType: 'Patient',
            label: 'People',
            fields: [systemCandidate, identifierCandidate],
          },
        ],
        relationships: [],
      },
    });
    expect(
      hydrated.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['identifier-system', 'identifier']);
  });

  it('hydrates selected native family keys even without an ordinary field declaration', async () => {
    const dynamicConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        ...config.recipe,
        outputs: [
          {
            ...config.recipe.outputs![0],
            fields: [],
            dynamicColumns: [
              {
                name: 'category',
                columnMode: 'SELECTED',
                columns: ['FILE_FORMAT'],
              },
            ],
          },
        ],
      },
      views: [
        {
          ...config.views[0],
          table: { columns: [] },
        },
      ],
    };
    const loaded = await initialStateFromConfig(
      'demo',
      createBuilderSession('demo'),
      dynamicConfig,
    );
    const hydrated = explorerBuilderReducer(loaded, {
      type: 'setCatalog',
      catalog: {
        complete: true,
        diagnostics: [],
        resources: [
          {
            resourceType: 'Patient',
            label: 'People',
            fields: [
              {
                id: 'candidate-file-format',
                resourceType: 'Patient',
                path: 'FILE_FORMAT',
                label: 'FILE_FORMAT',
                logicalType: 'string',
                repeated: false,
                family: 'dynamic',
                familyKind: 'DYNAMIC',
                familyName: 'category',
                selected: true,
              },
            ],
          },
        ],
        relationships: [],
      },
    });
    expect(
      hydrated.selectedCandidateIdsByNode['patients|root:Patient'],
    ).toEqual(['candidate-file-format']);
  });
});
