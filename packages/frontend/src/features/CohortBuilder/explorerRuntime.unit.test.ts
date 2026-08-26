import { cohortBuilderPanelsFromRuntime } from './explorerRuntime';
import type { ExplorerRuntimeV1 } from '@gen3/core';

const runtime: ExplorerRuntimeV1 = {
  generation: 'generation-1',
  outputs: [
    {
      outputId: 'out-1',
      name: 'Patient',
      title: 'People',
      rowLabel: 'person',
      selector: {
        recipe: 'recipe-1',
        translationVersion: 'r1',
        output: 'Patient',
      },
      columns: [
        {
          emissionId: 'em-name',
          name: 'patient_name',
          label: 'Name',
          logicalType: 'string',
          visible: true,
          order: 0,
          filterable: true,
          chartable: false,
        },
        {
          emissionId: 'em-status',
          name: 'patient_status',
          label: 'Status',
          logicalType: 'string',
          visible: true,
          order: 1,
          filterable: true,
          chartable: true,
        },
      ],
      // Binding order may reflect emission/materialization order. Presentation
      // order on the runtime columns is authoritative for the rendered table.
      table: {
        columns: [
          { emissionId: 'em-status', visible: true },
          { emissionId: 'em-name', visible: true },
        ],
      },
      filters: [{ emissionId: 'em-status', label: 'State' }],
      charts: [{ emissionId: 'em-status', type: 'pie', title: 'State' }],
      fixedFilters: { 'em-status': ['active'] },
    },
  ],
  sharedFilters: {},
  diagnostics: [],
};

describe('ExplorerRuntimeV1 viewer projection', () => {
  it('uses server emissions, labels, selectors, filters, and charts directly', () => {
    const configuration = cohortBuilderPanelsFromRuntime(runtime, 'project-1');
    const panel = configuration.panels[0];

    expect(panel.guppyConfig.loomDataset).toEqual({
      recipe: 'recipe-1',
      translationVersion: 'r1',
      output: 'Patient',
    });
    expect(panel.guppyConfig.nodeCountTitle).toBe('person');
    expect(panel.table?.fields).toEqual(['patient_name', 'patient_status']);
    expect(panel.filters?.tabs[0].fields).toEqual(['patient_status']);
    expect(panel.charts).toEqual({
      patient_status: { chartType: 'pie', title: 'State' },
    });
    expect(panel.preFilters).toEqual({ patient_status: ['active'] });
    expect(panel.runtimeOwned).toBe(true);
  });
});
