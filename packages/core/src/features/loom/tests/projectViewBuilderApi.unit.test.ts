import { setupCoreStore } from '../../../store';
import { projectViewBuilderApi } from '../projectViewBuilderApi';
import { viewBuilderStateSchema } from '../projectViewBuilder';

const project = 'HTAN_INT/BForePC';

const config = {
  id: 'metadata',
  title: 'Metadata',
  recipeRef: { name: 'clinical_metadata', untouchedRecipeRefField: 'keep' },
  views: [
    {
      id: 'tab-specimen',
      title: 'Specimens',
      output: 'Specimen',
      table: {
        columns: [
          {
            column: 'specimen_id',
            label: 'Specimen ID',
            visible: true,
            pinned: false,
            untouchedColumnField: 'keep',
          },
        ],
      },
      filters: [],
      charts: [],
      fixedFilters: { status: ['active'] },
      actions: [
        {
          type: 'download',
          title: 'Download',
          columns: ['specimen_id'],
          untouchedActionField: 'keep',
        },
      ],
      untouchedViewField: 'keep',
    },
  ],
  sharedFilters: {},
  fileActions: { extensions: {}, actions: {} },
  untouchedConfigField: { keep: true },
};

const state = {
  settings: {
    project,
    version: 1,
    catalogs: { clinical_metadata: 'catalog-revision-1' },
  },
  configs: [{ config, revisionId: 'config-revision-1' }],
  catalogs: [
    {
      recipeName: 'clinical_metadata',
      revisionId: 'catalog-revision-1',
      executionId: 'execution-1',
      generation: 'generation-1',
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
          ],
        },
      ],
    },
  ],
  canEdit: true,
};

describe('Project View Builder API contract', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as typeof global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('decodes empty settings defaults and preserves untouched config fields', () => {
    const parsed = viewBuilderStateSchema.parse(state);
    expect(parsed.settings.defaultConfigId).toBe('');
    expect(parsed.settings.defaultFrameId).toBe('');
    expect(parsed.settings.catalogs).toEqual({
      clinical_metadata: 'catalog-revision-1',
    });
    expect(parsed.configs[0]?.config.untouchedConfigField).toEqual({
      keep: true,
    });
    expect(parsed.configs[0]?.config.views[0]?.untouchedViewField).toBe('keep');
    expect(
      parsed.configs[0]?.config.views[0]?.table.columns[0]
        ?.untouchedColumnField,
    ).toBe('keep');
  });

  it('uses project view endpoints with config CAS, catalog anchoring, and defaults version', async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify(state), { status: 200 })),
    );
    const store = setupCoreStore();

    await store
      .dispatch(
        projectViewBuilderApi.endpoints.getProjectViewBuilder.initiate({
          project,
        }),
      )
      .unwrap();
    await store
      .dispatch(
        projectViewBuilderApi.endpoints.saveProjectViewConfig.initiate({
          project,
          configId: 'metadata',
          request: {
            expectedRevisionId: 'config-revision-1',
            catalogRevisionId: 'catalog-revision-1',
            config,
          },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        projectViewBuilderApi.endpoints.saveProjectViewDefaults.initiate({
          project,
          request: {
            expectedVersion: 1,
            defaultConfigId: 'metadata',
            defaultFrameId: 'clinical_metadata/Specimen',
          },
        }),
      )
      .unwrap();
    await store
      .dispatch(
        projectViewBuilderApi.endpoints.deleteProjectViewConfig.initiate({
          project,
          configId: 'metadata',
          expectedRevisionId: 'config-revision-1',
        }),
      )
      .unwrap();
    await store
      .dispatch(
        projectViewBuilderApi.endpoints.adoptProjectViewBuilderCatalogs.initiate(
          { project },
        ),
      )
      .unwrap();

    const calls = fetchMock.mock.calls;
    const urls = calls.map(([url]) => String(url));
    const configCall = calls.find(
      ([url, init]) =>
        String(url).includes('/view-builder/configs/metadata') &&
        init?.method === 'PUT',
    );
    const defaultsCall = calls.find(
      ([url, init]) =>
        String(url).includes('/view-builder/defaults') &&
        init?.method === 'PUT',
    );
    const deleteCall = calls.find(
      ([url, init]) =>
        String(url).includes(
          '/view-builder/configs/metadata?expectedRevisionId=config-revision-1',
        ) && init?.method === 'DELETE',
    );
    const adoptCall = calls.find(
      ([url, init]) =>
        String(url).includes('/view-builder/adopt') && init?.method === 'POST',
    );
    expect(urls[0]).toContain(
      '/api/v1/projects/HTAN_INT%252FBForePC/view-builder',
    );
    expect(
      urls.some((url) => url.includes('/view-builder/configs/metadata')),
    ).toBe(true);
    expect(defaultsCall?.[0]).toContain('/view-builder/defaults');
    expect(deleteCall?.[0]).toContain(
      '/view-builder/configs/metadata?expectedRevisionId=config-revision-1',
    );
    expect(adoptCall?.[0]).toContain('/view-builder/adopt');
    expect(urls.every((url) => url.includes('/view-builder'))).toBe(true);

    expect(JSON.parse(String(configCall?.[1]?.body))).toEqual({
      expectedRevisionId: 'config-revision-1',
      catalogRevisionId: 'catalog-revision-1',
      config,
    });
    expect(JSON.parse(String(defaultsCall?.[1]?.body))).toEqual({
      expectedVersion: 1,
      defaultConfigId: 'metadata',
      defaultFrameId: 'clinical_metadata/Specimen',
    });
    expect(calls.every(([, init]) => init?.credentials === 'include')).toBe(
      true,
    );
    expect(configCall?.[1]?.method).toBe('PUT');
    expect(deleteCall?.[1]?.method).toBe('DELETE');
    expect(adoptCall?.[1]?.method).toBe('POST');
  });

  it('preserves the server 409 status and message for local draft recovery', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: 'VIEW_CONFIG_REVISION_CONFLICT',
            message: 'The view config revision changed.',
          },
        }),
        { status: 409 },
      ),
    );
    const store = setupCoreStore();
    const result = await store
      .dispatch(
        projectViewBuilderApi.endpoints.saveProjectViewConfig.initiate({
          project,
          configId: 'metadata',
          request: {
            expectedRevisionId: 'stale-revision',
            catalogRevisionId: 'catalog-revision-1',
            config,
          },
        }),
      )
      .unwrap()
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    expect(result).toMatchObject({
      status: 409,
      code: 'VIEW_CONFIG_REVISION_CONFLICT',
      message: 'The view config revision changed.',
    });
  });
});
