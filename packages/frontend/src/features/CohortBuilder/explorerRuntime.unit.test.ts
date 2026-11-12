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
          column: 'patient_status',
          label: 'Status',
          logicalType: 'string',
          visible: false,
          order: 1,
          filterable: true,
          chartable: true,
        },
        {
          column: 'patient_name',
          label: 'Name',
          logicalType: 'string',
          visible: true,
          order: 0,
          filterable: true,
          chartable: false,
        },
      ],
      // Binding order may reflect emission/materialization order. Presentation
      // order on the runtime columns is authoritative for the rendered table.
      table: {
        columns: [
          { column: 'patient_status', visible: false },
          { column: 'patient_name', visible: true },
        ],
      },
      filters: [{ column: 'patient_status', label: 'State' }],
      charts: [{ column: 'patient_status', type: 'pie', title: 'State' }],
      fixedFilters: { patient_status: ['active'] },
    },
  ],
  sharedFilters: {},
  diagnostics: [],
};

describe('ExplorerRuntimeV1 viewer projection', () => {
  it('uses server columns, labels, selectors, filters, and charts directly', () => {
    const configuration = cohortBuilderPanelsFromRuntime(runtime, 'project-1');
    const panel = configuration.panels[0];

    expect(panel.guppyConfig.loomDataset).toEqual({
      recipe: 'recipe-1',
      translationVersion: 'r1',
      output: 'Patient',
    });
    expect(panel.guppyConfig.nodeCountTitle).toBe('person');
    expect(panel.table?.fields).toEqual(['patient_name']);
    expect(panel.filters?.tabs[0].fields).toEqual(['patient_status']);
    expect(panel.charts).toEqual({
      patient_status: { chartType: 'pie', title: 'State' },
    });
    expect(panel.preFilters).toEqual({ patient_status: ['active'] });
    expect(panel.runtimeOwned).toBe(true);
  });
  it('enables configured per-tab downloads and preserves the exact export fields, headers, and filename', () => {
    const configuration = cohortBuilderPanelsFromRuntime(
      {
        ...runtime,
        outputs: runtime.outputs.map((output) => ({
          ...output,
          actions: [
            {
              type: 'export',
              title: 'Download Manifest',
              fileName: 'patients.csv',
              columns: ['patient_name'],
              exportHeaders: { patient_name: 'Participant' },
            },
          ],
        })),
      },
      'HTAN_INT/BForePC',
    );
    expect(configuration.panels[0].buttons?.[0]).toMatchObject({
      enabled: true,
      action: 'data-table',
      actionArgs: {
        fileFields: ['patient_name'],
        filename: 'patients.csv',
        exportHeaders: { patient_name: 'Participant' },
        projectIds: ['HTAN_INT/BForePC'],
        selector: runtime.outputs[0].selector,
      },
    });
  });
});
