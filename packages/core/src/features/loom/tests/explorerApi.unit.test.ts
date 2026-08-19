import { configureStore } from '@reduxjs/toolkit';
import { loomExplorerApi } from '../explorerApi';
import type { ExplorerConfigV2 } from '../explorer';

const config: ExplorerConfigV2 = {
  apiVersion: 'loom.calypr.org/explorer-config/v2',
  kind: 'ExplorerConfig',
  project: 'org-project',
  explorer: { id: 'custom', title: 'Custom', management: 'interactive' },
  recipe: { schemaVersion: 2, outputs: [] },
  views: [],
};

const introspectionResponse = ({
  resourceType,
  fields = [],
  traversals = [],
  relatedResources = [],
}: {
  readonly resourceType: string;
  readonly fields?: ReadonlyArray<Record<string, unknown>>;
  readonly traversals?: ReadonlyArray<Record<string, unknown>>;
  readonly relatedResources?: ReadonlyArray<Record<string, unknown>>;
}) =>
  new Response(
    JSON.stringify({
      data: {
        dataframeBuilderIntrospection: {
          project: 'org-project',
          rootResourceType: resourceType,
          authResourcePaths: ['authorized/project'],
          root: { resourceType, fields, pivotFields: [], traversals },
          relatedResources,
          traversals,
          fields,
          pivotFields: [],
        },
      },
    }),
    { status: 200 },
  );

const authoringCatalogResponse = (
  nodes: ReadonlyArray<Record<string, unknown>> = [],
  routeEdges: ReadonlyArray<Record<string, unknown>> = [],
) => {
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const node of nodes) {
    const selectionKey = String(node.selectionKey ?? '');
    const resourceType = String(
      node.resourceType ?? selectionKey.split('.')[0] ?? 'Patient',
    );
    const columns = grouped.get(resourceType) ?? [];
    columns.push(node);
    grouped.set(resourceType, columns);
  }
  return new Response(
    JSON.stringify({
      data: {
        explorerAuthoringCatalog: {
          snapshotToken: 'loom:snapshot-1',
          project: 'org-project',
          explorerId: 'custom',
          sourceGeneration: 'generation-1',
          authorizationScopeDigest: 'sha256:scope-1',
          resolvedSchemaDigest: 'sha256:schema-1',
          nodes: [...grouped.entries()].map(([resourceType, columns]) => ({
            nodeId: `node-${resourceType}`,
            label: resourceType,
            columns: columns.map((node) => ({
              selectionId: node.id,
              label: node.selectionKey,
              group: resourceType,
              description: node.label,
              examples: node.examples ?? [],
              population: node.population,
              logicalType: node.valueType ?? 'unknown',
              repeated: String(node.cardinality ?? '').includes('repeated'),
              cardinality: node.cardinality,
              expectedPublicColumn: node.publicName,
              filterable: node.valueType !== 'object',
              chartable: node.valueType === 'number',
              blocked: false,
              diagnostics: [],
            })),
            completeness: {
              complete: true,
              truncated: false,
              diagnostics: [],
            },
          })),
          routeEdges,
          completeness: { complete: true, truncated: false, diagnostics: [] },
          diagnostics: [],
        },
      },
    }),
    { status: 200 },
  );
};

const store = () =>
  configureStore({
    reducer: { loom: loomExplorerApi.reducer },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(loomExplorerApi.middleware),
  });

describe('authenticated V2 Explorer lifecycle API', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof global.fetch;
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('lists Explorers through the authenticated Loom proxy', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerConfigs.initiate('org-project'),
      )
      .unwrap();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/loom/api/v1/projects/org-project/explorers'),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('uses the authenticated Explorer listing as the complete source of truth', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    const values = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerConfigs.initiate('org-project'),
      )
      .unwrap();
    expect(values).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('loads the repository default through the V2 Explorer resource', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'default',
          management: 'REPOSITORY',
          draftConfig: {
            ...config,
            explorer: { ...config.explorer, id: 'default' },
          },
          activeConfig: {
            ...config,
            explorer: { ...config.explorer, id: 'default' },
          },
          draftVersion: 4,
          draftDigest: 'sha256:default',
        }),
        { status: 200 },
      ),
    );
    await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'org-project',
          explorerId: 'default',
        }),
      )
      .unwrap();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/loom/api/v1/projects/org-project/explorers/default',
      ),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('accepts a metadata-only repository default without draftConfig', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'default',
          management: 'REPOSITORY',
          updatedAt: '2026-08-17T00:00:00Z',
          sourceGeneration: 'generation-42',
          datasets: [],
        }),
        { status: 200 },
      ),
    );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'org-project',
          explorerId: 'default',
        }),
      )
      .unwrap();

    expect(result).toMatchObject({
      explorerId: 'default',
      management: 'REPOSITORY',
      draftVersion: 0,
      draftDigest: '',
      datasets: [],
    });
    expect(result.draftConfig).toBeUndefined();
  });

  it('unwraps a data envelope around repository metadata', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            project: 'org-project',
            explorerId: 'default',
            management: 'REPOSITORY',
            baselineConfig: { recipe: { outputs: [] } },
            dataset: { outputs: [] },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'org-project',
          explorerId: 'default',
        }),
      )
      .unwrap();

    expect(result).toMatchObject({
      explorerId: 'default',
      management: 'REPOSITORY',
      baselineConfig: { recipe: { outputs: [] } },
      dataset: { outputs: [] },
    });
  });

  it('unwraps a publication state envelope before hydrating the Builder', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          activeUrl: '/Explorer/org-project',
          publicationId: 'publication-1',
          state: {
            project: 'org-project',
            explorerId: 'default',
            management: 'REPOSITORY',
            activeConfig: config,
            draftConfig: {
              ...config,
              explorer: { ...config.explorer, title: 'Draft' },
            },
          },
        }),
        { status: 200 },
      ),
    );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'org-project',
          explorerId: 'default',
        }),
      )
      .unwrap();

    expect(result.activeConfig).toEqual(config);
    expect(result.draftConfig?.explorer.title).toBe('Draft');
    expect(result.publicationId).toBe('publication-1');
    expect(result.activeUrl).toBe('/Explorer/org-project');
  });

  it('derives creation identity on the server and sends the requested name', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'patient-review',
          management: 'INTERACTIVE',
          draftConfig: {
            ...config,
            explorer: { ...config.explorer, id: 'patient-review' },
          },
        }),
        { status: 200 },
      ),
    );
    await store()
      .dispatch(
        loomExplorerApi.endpoints.createExplorer.initiate({
          project: 'org-project',
          name: 'Patient Review',
          title: 'Patient Review',
          from: 'blank',
        }),
      )
      .unwrap();
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"name":"Patient Review"'),
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).not.toContain(
      '"explorerId"',
    );
  });

  it('unwraps nested Loom API errors into render-safe diagnostics', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'the requested route was not found',
            retryable: false,
            requestId: 'request-1',
          },
        }),
        { status: 404 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerConfigs.initiate('org-project'),
      )
      .unwrap()
      .catch((error) => error);
    expect(result).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'the requested route was not found',
      endpoint: expect.stringContaining('/loom/api/v1/projects/'),
      retryable: false,
      requestId: 'request-1',
    });
    expect(typeof result.message).toBe('string');
  });

  it('preserves authenticated 401 metadata for the login boundary', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'authentication required',
            retryable: false,
          },
        }),
        { status: 401, headers: { 'x-request-id': 'auth-request-1' } },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerConfigs.initiate('org-project'),
      )
      .unwrap()
      .catch((error) => error);
    expect(result).toMatchObject({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Your Loom session has expired. Sign in again to continue.',
      requestId: 'auth-request-1',
      endpoint: expect.stringContaining('/loom/api/v1/projects/'),
    });
  });

  it('accepts a published-only response without requiring draftConfig', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'custom',
          management: 'INTERACTIVE',
          activeConfig: config,
        }),
        { status: 200 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'org-project',
          explorerId: 'custom',
        }),
      )
      .unwrap();
    expect(result.activeConfig).toEqual(config);
    expect(result.draftConfig).toBeUndefined();
  });

  it('rejects an interactive response that contains neither draft nor active config', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'custom',
          management: 'INTERACTIVE',
          config,
        }),
        { status: 200 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorer.initiate({
          project: 'org-project',
          explorerId: 'custom',
        }),
      )
      .unwrap()
      .catch((error) => error);
    expect(result).toMatchObject({
      message: 'Explorer response did not include draftConfig or activeConfig.',
    });
  });

  it('sends the exact V2 packet and expected CAS version when saving a draft', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'custom',
          management: 'INTERACTIVE',
          draftConfig: config,
          draftVersion: 8,
          draftDigest: 'sha256:new',
        }),
        { status: 200 },
      ),
    );
    await store()
      .dispatch(
        loomExplorerApi.endpoints.saveExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'custom',
          config,
          authResourcePath: '/programs/org/projects/project',
          expectedDraftVersion: 7,
          expectedDraftDigest: 'sha256:old',
        }),
      )
      .unwrap();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/loom/api/v1/projects/org-project/explorers/custom/draft?auth_resource_path=%2Fprograms%2Forg%2Fprojects%2Fproject',
      ),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          config,
          expectedDraftVersion: 7,
          expectedDraftDigest: 'sha256:old',
        }),
      }),
    );
  });

  it('preserves nested CAS conflict metadata from the REST error envelope', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'DRAFT_CONFLICT',
            message: 'The Explorer draft changed after it was loaded.',
            currentVersion: 4,
            currentDigest: 'sha256:remote',
            updatedAt: '2026-08-16T10:00:00Z',
          },
        }),
        { status: 409 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.saveExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'custom',
          config,
          expectedDraftVersion: 3,
          expectedDraftDigest: 'sha256:local',
        }),
      )
      .unwrap()
      .catch((error) => error);
    expect(result).toMatchObject({
      code: 'DRAFT_CONFLICT',
      status: 409,
      currentVersion: 4,
      currentDigest: 'sha256:remote',
      updatedAt: '2026-08-16T10:00:00Z',
    });
  });

  it('scopes preview requests to the selected output', async () => {
    const multiOutputConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [
          {
            name: 'people',
            rootResourceType: 'Patient',
            fields: [],
            traversals: [],
          },
          {
            name: 'legacy-broken-output',
            rootResourceType: 'DocumentReference',
            fields: [
              { name: 'invalid legacy field', expr: { select: 'root.' } },
            ],
            traversals: [],
          },
        ],
      },
      views: [
        {
          id: 'view-people',
          title: 'People',
          output: 'people',
          table: { columns: [] },
        },
        {
          id: 'view-legacy',
          title: 'Legacy',
          output: 'legacy-broken-output',
          table: { columns: [] },
        },
      ],
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: 'people',
          columns: [],
          rows: [],
          rowCount: 0,
        }),
        { status: 200 },
      ),
    );
    await store()
      .dispatch(
        loomExplorerApi.endpoints.previewExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'custom',
          config: multiOutputConfig,
          output: 'people',
          limit: 25,
          draftDigest: 'sha256:full-draft',
        }),
      )
      .unwrap();
    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request[1].body)) as {
      config: ExplorerConfigV2;
      output: string;
      draftDigest: string;
    };
    expect(body.output).toBe('people');
    expect(body.config.recipe.outputs).toEqual([
      expect.objectContaining({ name: 'people' }),
    ]);
    expect(body.config.views).toEqual([
      expect.objectContaining({ output: 'people' }),
    ]);
    expect(body.draftDigest).toBe('sha256:full-draft');
  });

  it('strips Builder-only table metadata from Loom preview packets', async () => {
    const configWithBuilderMetadata = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [
          {
            name: 'people',
            title: 'People',
            rootResourceType: 'Patient',
            rowGrain: 'substance_definition',
            fields: [
              {
                name: 'id',
                expr: { select: 'root.id' },
                label: 'Person ID',
                logicalType: 'string',
                repeated: false,
                selectionKey: 'Patient.id',
              },
              {
                name: 'category[].coding[].system',
                expr: { select: 'root.category[].coding[].system' },
              },
              { name: 'content[].attachment.url' },
              { name: 'content[].attachment.extension[].valueUrl' },
              { name: 'date' },
              { name: 'legacy[].unresolvable' },
            ],
          },
        ],
      },
      views: [
        {
          id: 'view-people',
          title: 'People',
          output: 'people',
          table: {
            columns: [
              {
                column: 'id',
                label: 'Person ID',
                visible: true,
                order: 0,
                filterable: true,
                chartable: false,
              },
              { column: 'category[].coding[].system', visible: true },
              {
                column: 'content[].attachment.extension[].valueUrl',
                visible: true,
              },
              { column: 'content_attachment_url', visible: true },
              { column: 'date', visible: true },
              { column: 'legacy[].unresolvable', visible: true },
              { column: 'orphan_column', visible: true },
            ],
          },
        },
      ],
    } as unknown as ExplorerConfigV2;
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: 'people',
          columns: [],
          rows: [],
          rowCount: 0,
        }),
        { status: 200 },
      ),
    );

    await store()
      .dispatch(
        loomExplorerApi.endpoints.previewExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'custom',
          config: configWithBuilderMetadata,
          output: 'people',
          limit: 25,
        }),
      )
      .unwrap();

    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request[1].body)) as {
      config: ExplorerConfigV2;
    };
    expect(body.config.views[0].table.columns[0]).toEqual({
      column: 'id',
      label: 'Person ID',
      visible: true,
    });
    expect(body.config.recipe.outputs?.[0].fields?.[0]).toEqual({
      name: 'id',
      expr: { select: 'root.id' },
    });
    expect(body.config.recipe.outputs?.[0]).not.toHaveProperty('title');
    expect(body.config.recipe.outputs?.[0].rowGrain).toBe('resource');
    expect(body.config.recipe.outputs?.[0].fields?.[1]).toEqual({
      name: 'category_coding_system',
      expr: { select: 'root.category[].coding[].system' },
    });
    expect(body.config.recipe.outputs?.[0].fields).toHaveLength(2);
    expect(body.config.views[0].table.columns[1].column).toBe(
      'category_coding_system',
    );
    expect(body.config.views[0].table.columns).toHaveLength(2);
  });

  it('previews the repository default without interactive draft CAS data', async () => {
    const defaultConfig: ExplorerConfigV2 = {
      ...config,
      explorer: { ...config.explorer, id: 'default', management: 'interactive' },
      recipe: {
        schemaVersion: 2,
        outputs: [{ name: 'people', rootResourceType: 'Patient', fields: [] }],
      },
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: 'people',
          columns: [],
          rows: [],
          rowCount: 0,
        }),
        { status: 200 },
      ),
    );
    await store()
      .dispatch(
        loomExplorerApi.endpoints.previewExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'default',
          config: defaultConfig,
          output: 'people',
          limit: 25,
        }),
      )
      .unwrap();
    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request[1].body)) as Record<string, unknown>;
    expect(request[0]).toContain('/explorers/default/preview');
    expect(body).not.toHaveProperty('draftDigest');
    expect(
      (body.config as { explorer?: { management?: string } }).explorer
        ?.management,
    ).toBe('repository');
  });

  it('reconciles logical root fields with Loom physical columns in one pass', async () => {
    const rootConfig = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [
          {
            name: 'files',
            rootResourceType: 'DocumentReference',
            fields: [
              { name: 'title', expr: { select: 'root.title' } },
              { name: 'date', expr: { select: 'root.date' } },
              { name: 'legacy_catalog_field' },
            ],
          },
        ],
      },
      views: [
        {
          id: 'view-files',
          title: 'Files',
          output: 'files',
          table: {
            columns: [
              { column: 'document_reference_title', visible: true },
              { column: 'date', visible: true },
              { column: 'content_attachment_url', visible: true },
            ],
          },
          filters: [{ column: 'date', label: 'Date' }],
          charts: [{ column: 'content_attachment_url', type: 'fullPie' }],
        },
      ],
    } as unknown as ExplorerConfigV2;
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          output: 'files',
          columns: [],
          rows: [],
          rowCount: 0,
        }),
        { status: 200 },
      ),
    );

    await store()
      .dispatch(
        loomExplorerApi.endpoints.previewExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'custom',
          config: rootConfig,
          output: 'files',
          limit: 25,
        }),
      )
      .unwrap();

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as {
      config: ExplorerConfigV2;
    };
    expect(body.config.views[0].table.columns.map((column) => column.column)).toEqual([
      'title',
      'date',
    ]);
    expect(body.config.views[0].filters).toEqual([
      { column: 'date', label: 'Date' },
    ]);
    expect(body.config.views[0].charts).toEqual([]);
  });

  it('normalizes the complete V2 publication response before returning it to the Builder', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'custom',
          management: 'INTERACTIVE',
          draftConfig: config,
          draftVersion: 9,
          draftDigest: 'sha256:published',
          activeConfig: config,
          activeRevisionId: 'rev-9',
          activeUrl: '/Explorer/org-project?explorerId=custom',
        }),
        { status: 200 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.publishExplorer.initiate({
          project: 'org-project',
          explorerId: 'custom',
          expectedDraftVersion: 9,
          expectedDraftDigest: 'sha256:published',
        }),
      )
      .unwrap();
    expect(result.draftConfig).toEqual(config);
    expect(result.activeRevisionId).toBe('rev-9');
    expect(result.activeUrl).toContain('explorerId=custom');
  });

  it('unwraps Loom publication state envelopes', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'default',
          publicationId: 'repository-revision-1',
          activeUrl: '/Explorer/org-project',
          state: {
            project: 'org-project',
            explorerId: 'default',
            management: 'REPOSITORY',
            activeConfig: config,
            draftVersion: 4,
            draftDigest: 'sha256:published',
          },
          materializations: [],
          diagnostics: [],
        }),
        { status: 200 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.publishExplorer.initiate({
          project: 'org-project',
          explorerId: 'default',
          expectedDraftVersion: 3,
          expectedDraftDigest: 'sha256:draft',
        }),
      )
      .unwrap();
    expect(result.management).toBe('REPOSITORY');
    expect(result.activeConfig).toEqual(config);
    expect(result.publicationId).toBe('repository-revision-1');
    expect(result.activeUrl).toBe('/Explorer/org-project');
  });

  it('saves the repository default without interactive CAS controls', async () => {
    const defaultConfig = {
      ...config,
      explorer: {
        ...config.explorer,
        id: 'default',
        management: 'repository' as const,
      },
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'default',
          management: 'REPOSITORY',
          activeConfig: defaultConfig,
          draftVersion: 0,
          draftDigest: '',
        }),
        { status: 200 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.saveExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'default',
          config: defaultConfig,
          expectedDraftVersion: 1,
          expectedDraftDigest: 'sha256:base',
        }),
      )
      .unwrap();
    expect(result.explorerId).toBe('default');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/loom/api/v1/projects/org-project/explorers/default/draft',
      ),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          config: defaultConfig,
          expectedDraftVersion: 1,
          expectedDraftDigest: 'sha256:base',
        }),
      }),
    );
  });

  it('publishes the repository default without interactive CAS controls', async () => {
    const defaultConfig = {
      ...config,
      explorer: {
        ...config.explorer,
        id: 'default',
        management: 'repository' as const,
      },
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          project: 'org-project',
          explorerId: 'default',
          management: 'REPOSITORY',
          activeConfig: defaultConfig,
          activeUrl: '/Explorer/org-project',
        }),
        { status: 200 },
      ),
    );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.publishExplorer.initiate({
          project: 'org-project',
          explorerId: 'default',
          expectedDraftVersion: 2,
          expectedDraftDigest: 'sha256:edited',
        }),
      )
      .unwrap();
    expect(result.explorerId).toBe('default');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(
        '/loom/api/v1/projects/org-project/explorers/default/publish',
      ),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          expectedDraftVersion: 2,
          expectedDraftDigest: 'sha256:edited',
        }),
      }),
    );
  });

  it('returns a local validation diagnostic for an incomplete V2 packet', async () => {
    const invalid = {
      ...config,
      views: undefined,
    } as unknown as ExplorerConfigV2;
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.saveExplorerDraft.initiate({
          project: 'org-project',
          explorerId: 'custom',
          config: invalid,
          expectedDraftVersion: 1,
        }),
      )
      .unwrap()
      .catch((error) => error);
    expect(result).toMatchObject({
      code: 'VALIDATION_FAILED',
      status: 422,
      diagnostics: [expect.objectContaining({ code: 'VIEWS_REQUIRED' })],
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.skip('discovers the complete populated traversal graph and native field candidates through Loom GraphQL', async () => {
    const authoringConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [
          {
            name: 'people',
            rootResourceType: 'Patient',
            fields: [],
            traversals: [],
          },
          // This output intentionally contains a declaration that is not
          // relevant to the selected table. Candidate discovery must not send
          // it to Loom: an invalid sibling must not poison "people".
          {
            name: 'legacy-broken-output',
            rootResourceType: 'DocumentReference',
            fields: [
              {
                name: 'invalid legacy field',
                expr: { select: 'root.' },
              },
            ],
            traversals: [],
          },
        ],
      },
      views: [
        {
          id: 'view-people',
          title: 'People',
          output: 'people',
          table: { columns: [] },
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(
        introspectionResponse({
          resourceType: 'Patient',
          fields: [
            {
              fieldRef: 'Patient.subject_id',
              path: 'subject_id',
              label: 'Subject ID',
              kind: 'scalar',
              docCount: 12,
              distinctValues: ['p1'],
              selector: { valuePath: 'subject_id' },
            },
            {
              // Introspection may expose FHIR containers. They must never be
              // promoted to Builder columns when Loom's candidate snapshot
              // supplies the authoritative value-bearing list.
              fieldRef: 'Patient.content',
              path: 'content',
              label: 'Content',
              kind: 'array',
              docCount: 12,
            },
          ],
          traversals: [
            {
              fromType: 'Patient',
              label: 'subject',
              toType: 'Specimen',
              edgeCount: 4,
            },
          ],
          relatedResources: [
            {
              viaLabel: 'subject',
              edgeCount: 4,
              target: {
                resourceType: 'Specimen',
                fields: [
                  {
                    fieldRef: 'Specimen.id',
                    path: 'id',
                    label: 'Specimen ID',
                    kind: 'scalar',
                    docCount: 3,
                  },
                ],
                pivotFields: [],
                traversals: [],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        introspectionResponse({
          resourceType: 'Specimen',
          fields: [
            {
              fieldRef: 'Specimen.id',
              path: 'id',
              label: 'Specimen ID',
              kind: 'scalar',
              docCount: 3,
              selector: { valuePath: 'id' },
            },
          ],
          traversals: [
            {
              fromType: 'Specimen',
              label: 'patient',
              toType: 'Patient',
              edgeCount: 4,
            },
            {
              fromType: 'Specimen',
              label: 'file',
              toType: 'File',
              edgeCount: 2,
            },
          ],
          relatedResources: [
            {
              viaLabel: 'file',
              edgeCount: 2,
              target: {
                resourceType: 'File',
                fields: [],
                pivotFields: [],
                traversals: [],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        introspectionResponse({
          resourceType: 'File',
          fields: [
            {
              fieldRef: 'File.id',
              path: 'id',
              label: 'File ID',
              kind: 'scalar',
              docCount: 2,
            },
          ],
          traversals: [],
        }),
      )
      .mockResolvedValueOnce(
        authoringCatalogResponse([
          {
            id: 'candidate-patient-subject-id',
            output: 'people',
            nodePath: '',
            familyKind: 'FIELD',
            familyName: 'Fields',
            rawKey: 'subject_id',
            selectionKey: 'Patient.subject_id',
            publicName: 'subject_id',
            label: 'Subject ID',
            valueSelector: 'subject_id',
            valueType: 'string',
            cardinality: 'single',
            population: 12,
            examples: ['p1'],
            complete: true,
          },
          {
            id: 'candidate-patient-file-format',
            output: 'people',
            nodePath: 'root',
            familyKind: 'DYNAMIC',
            familyName: 'category',
            rawKey: 'FILE_FORMAT',
            selectionKey: 'FILE_FORMAT',
            publicName: 'FILE_FORMAT',
            label: 'FILE_FORMAT',
            valueSelector: 'root.category[].coding[].display',
            valueType: 'string',
            cardinality: 'single',
            population: 12,
            selected: true,
            complete: true,
          },
          {
            id: 'candidate-patient-content-container',
            output: 'people',
            nodePath: '',
            familyKind: 'FIELD',
            familyName: 'Fields',
            rawKey: 'content',
            selectionKey: 'Patient.content',
            publicName: 'content',
            label: 'Content',
            valueSelector: 'content',
            valueType: 'array',
            cardinality: 'repeated',
            population: 12,
            complete: true,
          },
          {
            id: 'candidate-patient-attachment-container',
            output: 'people',
            nodePath: '',
            familyKind: 'FIELD',
            familyName: 'Fields',
            rawKey: 'content[].attachment',
            selectionKey: 'Patient.content[].attachment',
            publicName: 'content_attachment',
            label: 'Content Attachment',
            valueSelector: 'content[].attachment',
            valueType: 'object',
            cardinality: 'repeated',
            population: 12,
            complete: true,
          },
        ]),
      );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerAuthoringCatalog.initiate({
          project: 'org-project',
          explorerId: 'custom',
          output: 'people',
          config: authoringConfig,
          datasetGeneration: 'generation-1',
        }),
      )
      .unwrap();
    expect(result.complete).toBe(true);
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'Patient' }),
        expect.objectContaining({ resourceType: 'Specimen' }),
        expect.objectContaining({ resourceType: 'File' }),
      ]),
    );
    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'Patient',
          target: 'Specimen',
          label: 'subject',
          linkCount: 4,
        }),
        expect.objectContaining({
          source: 'Specimen',
          target: 'Patient',
          label: 'patient',
          linkCount: 4,
        }),
        expect.objectContaining({
          source: 'Specimen',
          target: 'File',
          label: 'file',
          linkCount: 2,
        }),
      ]),
    );
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'subject_id',
          resourceType: 'Patient',
          selectionKey: 'Patient.subject_id',
        }),
      ]),
    );
    expect(result.candidates).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'content' })]),
    );
    expect(result.candidates).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'content[].attachment' }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0][0]).toContain('/loom/graphql/graph');
    expect(fetchMock.mock.calls[1][0]).toContain('/loom/graphql/graph');
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'dataframeBuilderIntrospection',
    );
    expect(fetchMock.mock.calls[0][1].body).toContain(
      'DataframeBuilderIntrospectionInput',
    );
    expect(fetchMock.mock.calls[1][1].body).toContain(
      '"rootResourceType":"Specimen"',
    );
    expect(fetchMock.mock.calls[2][1].body).toContain(
      '"rootResourceType":"File"',
    );
    expect(fetchMock.mock.calls[3][1].body).toContain(
      'ExplorerAuthoringCatalog',
    );
    const candidateRequest = fetchMock.mock.calls.find(([, init]) =>
      String(init?.body).includes('ExplorerAuthoringCatalog'),
    );
    expect(candidateRequest).toBeDefined();
    const candidateWireRequest = String(candidateRequest?.[1].body);
    expect(candidateWireRequest).toContain('snapshotToken');
    expect(candidateWireRequest).not.toContain(
      'DataframeRecipeColumnCandidatesInput',
    );
    expect(candidateWireRequest).not.toContain(
      'DataframeBuilderProjectMapInput',
    );
    expect(candidateWireRequest).not.toContain('dataframeBuilderProjectMap');
    const candidatePayload = JSON.parse(String(candidateRequest?.[1].body)) as {
      variables?: {
        input?: {
          sourceGeneration?: string;
          definition?: {
            schemaVersion?: number;
            outputs?: ReadonlyArray<unknown>;
          };
        };
      };
    };
    expect(candidatePayload.variables?.input?.definition).toEqual(
      expect.objectContaining({ schemaVersion: 1, outputs: [] }),
    );
    expect(candidatePayload.variables?.input?.sourceGeneration).toBe(
      'generation-1',
    );
    expect(result.snapshotToken).toBe('loom:snapshot-1');
    expect(result.catalogDigest).toMatch(/^sha256:/);
    expect(result.resolvedSchemaDigest).toBe('sha256:schema-1');
  });

  it.skip('uses supported catalog nodes and route edges for the project graph', async () => {
    const authoringConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [{ name: 'people', rootResourceType: 'Patient', fields: [] }],
      },
    };
    fetchMock
      .mockResolvedValueOnce(introspectionResponse({ resourceType: 'Patient' }))
      .mockResolvedValueOnce(
        authoringCatalogResponse(
          [
            {
              id: 'candidate-patient-id',
              resourceType: 'Patient',
              selectionKey: 'Patient.id',
              label: 'Patient ID',
              valueType: 'string',
            },
            {
              id: 'candidate-specimen-id',
              resourceType: 'Specimen',
              selectionKey: 'Specimen.id',
              label: 'Specimen ID',
              valueType: 'string',
            },
          ],
          [
            {
              edgeId: 'edge-patient-specimen',
              fromNodeId: 'node-Patient',
              toNodeId: 'node-Specimen',
              label: 'specimen',
            },
          ],
        ),
      );
    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerAuthoringCatalog.initiate({
          project: 'org-project',
          explorerId: 'custom',
          output: 'people',
          config: authoringConfig,
        }),
      )
      .unwrap();
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'Patient' }),
        expect.objectContaining({ resourceType: 'Specimen' }),
      ]),
    );
    expect(result.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'Patient',
          target: 'Specimen',
          label: 'specimen',
        }),
      ]),
    );
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceType: 'Specimen',
          selectionKey: 'Specimen.id',
        }),
      ]),
    );
  });

  it.skip('keeps introspected fields and relationships visible without resource counts', async () => {
    const authoringConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [
          {
            name: 'files',
            rootResourceType: 'File',
            fields: [],
            traversals: [],
          },
        ],
      },
      views: [
        {
          id: 'view-files',
          title: 'Files',
          output: 'files',
          table: { columns: [] },
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(
        introspectionResponse({
          resourceType: 'File',
          fields: [
            {
              fieldRef: 'File.id',
              path: 'id',
              label: 'File ID',
              kind: 'scalar',
              docCount: 5,
            },
          ],
          traversals: [
            {
              fromType: 'File',
              label: 'subject',
              toType: 'Patient',
              edgeCount: 2,
            },
          ],
          relatedResources: [
            {
              viaLabel: 'subject',
              edgeCount: 2,
              target: {
                resourceType: 'Patient',
                fields: [],
                pivotFields: [],
                traversals: [],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        introspectionResponse({
          resourceType: 'Patient',
          fields: [],
          traversals: [],
        }),
      )
      .mockResolvedValueOnce(
        authoringCatalogResponse([
          {
            id: 'candidate-file-id',
            output: 'files',
            nodePath: '',
            familyKind: 'FIELD',
            rawKey: 'id',
            selectionKey: 'File.id',
            publicName: 'id',
            label: 'File ID',
            valueSelector: 'id',
            valueType: 'string',
            cardinality: 'single',
            population: 5,
            complete: true,
          },
        ]),
      );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerAuthoringCatalog.initiate({
          project: 'org-project',
          explorerId: 'custom',
          output: 'files',
          config: authoringConfig,
        }),
      )
      .unwrap();
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'File' }),
        expect.objectContaining({ resourceType: 'Patient' }),
      ]),
    );
    expect(result.relationships).toEqual([
      expect.objectContaining({
        source: 'File',
        target: 'Patient',
        label: 'subject',
      }),
    ]);
    expect(result.candidates).toEqual([
      expect.objectContaining({ path: 'id', resourceType: 'File' }),
    ]);
  });

  it.skip('keeps the known graph usable when a related introspection request reports an error', async () => {
    const authoringConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [
          {
            name: 'people',
            rootResourceType: 'Patient',
            fields: [],
            traversals: [],
          },
        ],
      },
      views: [
        {
          id: 'view-people',
          title: 'People',
          output: 'people',
          table: { columns: [] },
        },
      ],
    };
    fetchMock
      .mockResolvedValueOnce(
        introspectionResponse({
          resourceType: 'Patient',
          fields: [
            {
              fieldRef: 'Patient.id',
              path: 'id',
              label: 'Person ID',
              kind: 'scalar',
              docCount: 12,
            },
          ],
          traversals: [
            {
              fromType: 'Patient',
              label: 'subject',
              toType: 'Specimen',
              edgeCount: 2,
            },
          ],
          relatedResources: [
            {
              viaLabel: 'subject',
              edgeCount: 2,
              target: {
                resourceType: 'Specimen',
                fields: [],
                pivotFields: [],
                traversals: [],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            errors: [
              {
                message: 'related introspection unavailable',
                extensions: { code: 'INTROSPECTION_DOWN' },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        authoringCatalogResponse([
          {
            id: 'candidate-patient-id',
            output: 'people',
            nodePath: '',
            familyKind: 'FIELD',
            rawKey: 'id',
            selectionKey: 'Patient.id',
            publicName: 'id',
            label: 'Person ID',
            valueSelector: 'id',
            valueType: 'string',
            cardinality: 'single',
            population: 12,
            complete: true,
          },
        ]),
      );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerAuthoringCatalog.initiate({
          project: 'org-project',
          explorerId: 'custom',
          output: 'people',
          config: authoringConfig,
        }),
      )
      .unwrap();
    expect(result.complete).toBe(false);
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'Patient' }),
        expect.objectContaining({ resourceType: 'Specimen' }),
      ]),
    );
    expect(result.candidates).toEqual([
      expect.objectContaining({ path: 'id', resourceType: 'Patient' }),
    ]);
    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'INTROSPECTION_DOWN' }),
      ]),
    );
  });
  it('loads the V2 REST authoring catalog before a row resource is selected', async () => {
    const authoringConfig: ExplorerConfigV2 = {
      ...config,
      recipe: {
        schemaVersion: 2,
        outputs: [{ name: 'people', fields: [] }],
      },
    };
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          snapshotToken: 'sha256:catalog-1',
          project: 'org-project',
          explorerId: 'custom',
          sourceGeneration: 'generation-1',
          authorizationScopeDigest: 'sha256:scope-1',
          resolvedSchemaDigest: 'sha256:schema-1',
          nodes: [
            { nodeId: 'node-patient', label: 'Patient' },
            { nodeId: 'node-specimen', label: 'Specimen' },
          ],
          selections: [
            {
              selectionId: 'selection-patient-id',
              nodeId: 'node-patient',
              fieldRef: 'Patient.id',
              select: 'id',
              logicalType: 'string',
              filterable: true,
              chartable: false,
            },
          ],
          routeEdges: [
            {
              edgeId: 'edge-patient-specimen',
              fromNodeId: 'node-patient',
              toNodeId: 'node-specimen',
              label: 'specimen',
            },
          ],
          completeness: { complete: true, truncated: false, diagnostics: [] },
          diagnostics: [],
        }),
        { status: 200 },
      ),
    );

    const result = await store()
      .dispatch(
        loomExplorerApi.endpoints.getExplorerAuthoringCatalog.initiate({
          project: 'org-project',
          explorerId: 'custom',
          output: 'people',
          config: authoringConfig,
        }),
      )
      .unwrap();

    expect(result.complete).toBe(true);
    expect(result.snapshotToken).toBe('sha256:catalog-1');
    expect(result.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ resourceType: 'Patient' }),
        expect.objectContaining({ resourceType: 'Specimen' }),
      ]),
    );
    expect(result.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'selection-patient-id',
          resourceType: 'Patient',
          path: 'id',
        }),
      ]),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/loom/api/v1/projects/org-project/explorers/custom/authoring/catalog'),
      expect.objectContaining({ credentials: 'include' }),
    );
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/graphql/');
  });
});
