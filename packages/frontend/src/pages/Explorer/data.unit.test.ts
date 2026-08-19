import type { RepositoryExplorerConfig } from '@gen3/core';

jest.mock('@gen3/core', () => ({
  groupSharedFields: jest.fn(),
  isLoomGraphQLRequestError: jest.fn(),
  dataframeSelectorForRecipeOutput: (
    recipe: { recipeName?: string; name?: string; translationVersion?: string },
    output: string,
    metadata?: { recipeName?: string; translationVersion?: string },
  ) => ({
    recipe: recipe.recipeName ?? recipe.name ?? metadata?.recipeName,
    translationVersion:
      recipe.translationVersion ?? metadata?.translationVersion,
    output,
  }),
  isLoomDataType: (value: string) =>
    [
      'Patient',
      'DocumentReference',
      'ResearchSubject',
      'Specimen',
      'MedicationAdministration',
      'GroupMember',
    ].includes(value),
}));
jest.mock('../../lib/pageLoader', () => ({
  definePageLoader: jest.fn((config) => config),
}));
jest.mock('../../lib/common/staticProps', () => ({
  loadNavigationFromContext: jest.fn(),
}));

import {
  loomRepositoryConfigConfiguration,
  unwrapRepositoryExplorerResponse,
} from './data';

describe('ExplorerConfig V2 runtime translation', () => {
  it('unwraps the REST data envelope used by the SSR Viewer loader', () => {
    const response = unwrapRepositoryExplorerResponse({
      data: {
        project: 'program-project',
        explorerId: 'default',
        management: 'REPOSITORY',
        dataset: { outputs: [] },
      },
    });

    expect(response).toMatchObject({
      project: 'program-project',
      explorerId: 'default',
      management: 'REPOSITORY',
      dataset: { outputs: [] },
    });
  });

  it('unwraps the publication envelope returned by publish', () => {
    const activeConfig = {
      apiVersion: 'loom.calypr.org/explorer-config/v2',
      kind: 'ExplorerConfig',
      project: 'program-project',
      explorer: { id: 'default', title: 'Published', management: 'repository' },
      recipe: {
        recipeName: 'project_recipe',
        translationVersion: 'r000001_abcd',
        outputs: [{ name: 'Patient' }],
      },
      views: [],
    };
    const response = unwrapRepositoryExplorerResponse({
      activeUrl: '/api/v1/projects/program-project/explorers/default',
      publicationId: 'publication-1',
      state: {
        project: 'program-project',
        explorerId: 'default',
        management: 'REPOSITORY',
        activeConfig,
        materializations: [],
      },
    });

    expect(response.activeConfig).toBe(activeConfig);
    expect(response.publicationId).toBe('publication-1');
    expect(response.project).toBe('program-project');
  });

  it('keeps view filters, fixed filters, charts, and shared filters in the runtime contract', () => {
    const deployed = {
      explorerId: 'default',
      activeConfig: {
        apiVersion: 'loom.calypr.org/explorer-config/v2',
        kind: 'ExplorerConfig',
        project: 'program-project',
        explorer: {
          id: 'default',
          title: 'Example',
          management: 'repository',
        },
        recipe: {
          recipeName: 'project_recipe',
          translationVersion: 'r000001_abcd',
          outputs: [{ name: 'Patient' }],
        },
        views: [
          {
            id: 'patient-view',
            title: 'People',
            output: 'Patient',
            table: {
              columns: [
                { column: 'name', label: 'Name', visible: true },
                { column: 'status', visible: true },
              ],
            },
            filters: [{ column: 'status', label: 'Status' }],
            fixedFilters: { project: ['BForePC'] },
            charts: [{ column: 'status', type: 'pie', title: 'Status' }],
          },
        ],
        sharedFilters: {
          cohort: [{ output: 'Patient', column: 'status', label: 'Cohort' }],
        },
      },
      materializations: [
        {
          outputId: 'Patient',
          output: 'Patient',
          materializationId: 'patient-materialization',
          columns: [
            {
              name: 'name',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: true,
              repeated: false,
              filterable: true,
              sortable: true,
              aggregatable: true,
            },
            {
              name: 'status',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: true,
              repeated: false,
              filterable: true,
              sortable: true,
              aggregatable: true,
            },
            {
              name: 'project',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: true,
              repeated: false,
              filterable: true,
              sortable: true,
              aggregatable: true,
            },
          ],
        },
      ],
    } as unknown as RepositoryExplorerConfig;

    const { configuration } = loomRepositoryConfigConfiguration(deployed);
    const panel = configuration.explorerConfig[0];

    expect(panel.guppyConfig.loomDataset).toEqual({
      recipe: 'project_recipe',
      translationVersion: 'r000001_abcd',
      output: 'Patient',
    });
    expect(panel.guppyConfig.loomProjectIds).toEqual(['program-project']);

    expect(panel.filters?.tabs[0]).toMatchObject({
      title: 'Filters',
      fields: ['status'],
      fieldsConfig: {
        status: { field: 'status', label: 'Status', type: 'enum' },
      },
    });
    expect(panel.preFilters).toEqual({ project: ['BForePC'] });
    expect(panel.charts).toEqual({
      status: { chartType: 'pie', title: 'Status' },
    });
    expect(configuration.sharedFilters?.defined).toEqual({
      cohort: [{ index: 'Patient', field: 'status' }],
    });
  });

  it('passes file actions and selects the file action renderer for V2 file views', () => {
    const deployed = {
      explorerId: 'default',
      activeConfig: {
        apiVersion: 'loom.calypr.org/explorer-config/v2',
        kind: 'ExplorerConfig',
        project: 'program-project',
        explorer: {
          id: 'default',
          title: 'Files',
          management: 'repository',
        },
        recipe: {
          recipeName: 'project_recipe',
          translationVersion: 'r000001_abcd',
          outputs: [{ name: 'File', rootResourceType: 'DocumentReference' }],
        },
        views: [
          {
            id: 'file-view',
            title: 'Files',
            output: 'File',
            table: {
              columns: [
                {
                  column: 'identifier_value',
                  label: 'File Actions',
                  visible: true,
                },
              ],
            },
          },
        ],
        fileActions: {
          actions: { file_download: '/download' },
          extensions: { default: ['file_download'] },
        },
      },
      materializations: [
        {
          outputId: 'File',
          output: 'File',
          materializationId: 'file-materialization',
          columns: [
            {
              name: 'identifier_value',
              clickhouseType: 'String',
              logicalType: 'string',
            },
          ],
        },
      ],
    } as unknown as RepositoryExplorerConfig;

    const { configuration } = loomRepositoryConfigConfiguration(deployed);
    const panel = configuration.explorerConfig[0];

    expect(configuration.fileActions).toEqual({
      actions: { file_download: '/download' },
      extensions: { default: ['file_download'] },
    });
    expect(panel.table?.columns.identifier_value).toMatchObject({
      field: 'identifier_value',
      type: 'string',
      cellRenderFunction: 'fileActions',
    });
  });

  it('translates logical Explorer fields to qualified materialization columns', () => {
    const deployed = {
      project: 'program-project',
      explorerId: 'default',
      management: 'REPOSITORY',
      updatedAt: '2026-08-17T00:00:00Z',
      recipeName: 'project_recipe',
      translationVersion: 'r000001_abcd',
      activeConfig: {
        apiVersion: 'loom.calypr.org/explorer-config/v2',
        kind: 'ExplorerConfig',
        project: 'program-project',
        explorer: { id: 'default', title: 'Example', management: 'repository' },
        recipe: {
          recipeName: 'project_recipe',
          translationVersion: 'r000001_abcd',
          outputs: [
            { name: 'Patient', rootResourceType: 'ResearchSubject' },
          ],
        },
        views: [
          {
            id: 'patient-view',
            title: 'People',
            output: 'Patient',
            table: {
              columns: [
                { column: 'identifier', label: 'Participant ID', visible: true },
                { column: 'id', label: 'Internal ID', visible: true },
              ],
            },
            filters: [{ column: 'identifier', label: 'Participant ID' }],
            charts: [{ column: 'identifier', type: 'pie', title: 'Participants' }],
          },
        ],
        sharedFilters: {
          cohort: [{ output: 'Patient', column: 'identifier' }],
        },
      },
      materializations: [
        {
          outputId: 'Patient',
          output: 'Patient',
          materializationId: 'patient-materialization',
          columns: [
            {
              name: 'research_subject_identifier',
              semanticPath: 'ResearchSubject.identifier[].value',
              filterable: true,
              chartable: true,
            },
            {
              name: 'research_subject_id',
              semanticPath: 'ResearchSubject.id',
              filterable: false,
              chartable: false,
            },
          ],
        },
      ],
      emittedColumns: [
        {
          OutputID: 'Patient',
          SelectionID: 'ResearchSubject.identifier[].value',
          PublicColumn: 'research_subject_identifier',
          Filterable: true,
          Chartable: true,
        },
        {
          OutputID: 'Patient',
          SelectionID: 'ResearchSubject.id',
          PublicColumn: 'research_subject_id',
          Filterable: false,
          Chartable: false,
        },
      ],
    } as unknown as RepositoryExplorerConfig;

    const { configuration } = loomRepositoryConfigConfiguration(deployed);
    const panel = configuration.explorerConfig[0];

    expect(panel.table?.fields).toEqual([
      'research_subject_identifier',
      'research_subject_id',
    ]);
    expect(panel.table?.columns).toEqual({
      research_subject_identifier: {
        field: 'research_subject_identifier',
        title: 'Participant ID',
      },
      research_subject_id: {
        field: 'research_subject_id',
        title: 'Internal ID',
      },
    });
    expect(panel.filters?.tabs[0]?.fields).toEqual([
      'research_subject_identifier',
    ]);
    expect(panel.charts).toEqual({
      research_subject_identifier: {
        chartType: 'pie',
        title: 'Participants',
      },
    });
    expect(configuration.sharedFilters?.defined).toEqual({
      cohort: [{ index: 'Patient', field: 'research_subject_identifier' }],
    });
  });

  it('accepts stale Builder field references and falls back to published columns', () => {
    const { configuration } = loomRepositoryConfigConfiguration({
      project: 'program-project',
      explorerId: 'default',
      management: 'REPOSITORY',
      updatedAt: '2026-08-17T00:00:00Z',
      activeConfig: {
        apiVersion: 'loom.calypr.org/explorer-config/v2',
        kind: 'ExplorerConfig',
        project: 'program-project',
        explorer: { id: 'default', title: 'Example', management: 'repository' },
        recipe: {
          recipeName: 'project_recipe',
          translationVersion: 'r000001_abcd',
          outputs: [{ name: 'Patient' }],
        },
        views: [
          {
            id: 'patient-view',
            title: 'People',
            output: 'Patient',
            table: { columns: [{ column: 'identifier', label: 'ID', visible: true }] },
            filters: [{ column: 'identifier', label: 'ID' }],
          },
        ],
        sharedFilters: {
          cohort: [{ output: 'Patient', column: 'identifier' }],
        },
      },
      materializations: [
        {
          outputId: 'Patient',
          output: 'Patient',
          materializationId: 'patient-materialization',
          columns: [
            {
              name: 'id',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: false,
              repeated: false,
              filterable: false,
              sortable: true,
              aggregatable: false,
            },
            {
              name: 'status',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: true,
              repeated: false,
              filterable: true,
              sortable: true,
              aggregatable: true,
            },
          ],
        },
      ],
    } as unknown as RepositoryExplorerConfig);

    const panel = configuration.explorerConfig[0];
    expect(panel.table?.fields).toEqual(['id', 'status']);
    expect(panel.table?.columns.identifier).toBeUndefined();
    expect(panel.filters).toBeUndefined();
  });

  it('does not synthesize a repository presentation from live Loom datasets', () => {
    const deployed = {
      project: 'program-project',
      explorerId: 'default',
      management: 'REPOSITORY',
      publicationId: 'publication-1',
      sourceGeneration: 'generation-42',
      datasets: [
        {
          id: 'patient-dataset',
          name: 'Patient',
          dataType: 'Patient',
          revision: 'generation-42',
          state: 'READY',
          selector: {
            recipe: 'project_recipe',
            translationVersion: 'r000001_abcd',
            output: 'Patient',
          },
          rowCount: 1,
          createdAt: '2026-08-17T00:00:00Z',
          columns: [
            {
              name: 'id',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: false,
              repeated: false,
              filterable: false,
              sortable: true,
              aggregatable: false,
            },
            {
              name: 'race',
              clickhouseType: 'String',
              logicalType: 'string',
              nullable: true,
              repeated: false,
              filterable: true,
              sortable: true,
              aggregatable: true,
            },
          ],
        },
      ],
    } as unknown as RepositoryExplorerConfig;

    expect(() => loomRepositoryConfigConfiguration(deployed)).toThrow(
      'Refusing to synthesize an Explorer from live dataset metadata',
    );
  });

  it('fails closed when a published output has no server selector identity', () => {
    expect(() =>
      loomRepositoryConfigConfiguration({
        project: 'program-project',
        explorerId: 'default',
        management: 'REPOSITORY',
        updatedAt: '2026-08-17T00:00:00Z',
        activeConfig: {
          apiVersion: 'loom.calypr.org/explorer-config/v2',
          kind: 'ExplorerConfig',
          project: 'program-project',
          explorer: { id: 'default', title: 'Example', management: 'repository' },
          views: [
            {
              id: 'patient-view',
              title: 'People',
              output: 'Patient',
              table: { columns: [{ column: 'id', visible: true }] },
            },
          ],
        },
      } as unknown as RepositoryExplorerConfig),
    ).toThrow('complete server dataframe selector');
  });
});
