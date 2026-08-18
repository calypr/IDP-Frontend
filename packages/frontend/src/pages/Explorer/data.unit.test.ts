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

  it('builds the repository default presentation from live Loom datasets', () => {
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

    const { configuration, columns } =
      loomRepositoryConfigConfiguration(deployed);
    const panel = configuration.explorerConfig[0];

    expect(panel.guppyConfig).toEqual({
      dataType: 'Patient',
      output: 'Patient',
      loomDataset: {
        recipe: 'project_recipe',
        translationVersion: 'r000001_abcd',
        output: 'Patient',
      },
      loomProjectIds: ['program-project'],
    });
    expect(panel.table?.fields).toEqual(['id', 'race']);
    expect(panel.filters?.tabs[0]).toMatchObject({
      fields: ['race'],
      fieldsConfig: {
        race: { field: 'race', index: 'Patient', type: 'enum' },
      },
    });
    expect(columns.Patient).toEqual(new Set(['id', 'race']));
  });

  it('prefers Loom dataset outputs over legacy materializations', () => {
    const deployed = {
      project: 'program-project',
      explorerId: 'default',
      management: 'REPOSITORY',
      updatedAt: '2026-08-17T00:00:00Z',
      recipeName: 'calypr-meta-default',
      translationVersion: 'r000042_default',
      dataset: {
        generation: 'generation-43',
        outputs: [
          {
            name: 'Patient',
            output: 'DocumentReference',
            state: 'READY',
            queryable: true,
            materializationId: 'live-patient-materialization',
            columns: [{ name: 'live_patient_id' }],
          },
        ],
      },
      materializations: [
        {
          outputId: 'Patient',
          output: 'Patient',
          materializationId: 'stale-materialization',
          columns: [
            {
              name: 'stale_patient_id',
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

    const { configuration } =
      loomRepositoryConfigConfiguration(deployed);
    expect(configuration.explorerConfig[0]?.table?.fields).toEqual([
      'live_patient_id',
    ]);
    expect(configuration.explorerConfig[0]?.guppyConfig.loomDataset).toEqual({
      recipe: 'calypr-meta-default',
      translationVersion: 'r000042_default',
      output: 'DocumentReference',
    });
  });

  it('fails closed when a published output has no server selector identity', () => {
    expect(() =>
      loomRepositoryConfigConfiguration({
        project: 'program-project',
        explorerId: 'default',
        management: 'REPOSITORY',
        updatedAt: '2026-08-17T00:00:00Z',
        datasets: [
          {
            id: 'patient-dataset',
            name: 'Patient',
            dataType: 'Patient',
            revision: 'generation-42',
            state: 'READY',
            rowCount: 1,
            createdAt: '2026-08-17T00:00:00Z',
            columns: [],
          },
        ],
      } as unknown as RepositoryExplorerConfig),
    ).toThrow('complete server dataframe selector');
  });
});
