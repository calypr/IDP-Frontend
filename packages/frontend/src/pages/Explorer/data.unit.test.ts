jest.mock('@gen3/core', () => ({
  GEN3_COMMONS_NAME: 'cbds',
  GEN3_LOOM_API: '/loom',
  groupSharedFields: jest.fn(),
  isLoomDataType: () => true,
}));
jest.mock('../../lib/common/staticProps', () => ({
  getNavPageLayoutPropsFromConfig: jest.fn(),
}));
jest.mock('../../lib/content', () => ({
  __esModule: true,
  default: {},
  microserviceDb: {},
}));

import { ValidateExplorerConfiguration } from './data';
import type { CohortBuilderConfiguration } from '../../features/CohortBuilder';

const configuration: CohortBuilderConfiguration = {
  explorerConfig: [
    {
      tabTitle: 'Patient',
      guppyConfig: { dataType: 'ResearchSubject' },
      filters: {
        tabs: [{ title: 'Filters', fields: ['identifier'], fieldsConfig: {} }],
      },
      charts: { deceasedBoolean: { chartType: 'fullPie', title: 'Vital status' } },
      table: {
        enabled: true,
        fields: ['identifier', 'deceasedBoolean'],
        columns: {
          identifier: { field: 'identifier', title: 'ID' },
          deceasedBoolean: { field: 'deceasedBoolean', title: 'Vital status' },
        },
      },
      preFilters: { project_id: ['HTAN_INT-BForePC'] },
    },
  ],
  sharedFilters: {
    defined: {
      identifier: [{ index: 'ResearchSubject', field: 'identifier' }],
    },
  },
};

const columns = {
  ResearchSubject: new Set([
    'identifier',
    'deceasedBoolean',
    'project_id',
  ]),
};

describe('ValidateExplorerConfiguration', () => {
  it('accepts exact Loom columns without changing the config', () => {
    const before = JSON.stringify(configuration);

    expect(() =>
      ValidateExplorerConfiguration(configuration, columns),
    ).not.toThrow();
    expect(JSON.stringify(configuration)).toBe(before);
  });

  it('reports each missing field with its config location', () => {
    const invalid = {
      ...configuration,
      explorerConfig: [
        {
          ...configuration.explorerConfig[0],
          charts: { missing_column: { chartType: 'fullPie', title: 'Broken' } },
        },
      ],
    };

    expect(() => ValidateExplorerConfiguration(invalid, columns)).toThrow(
      'ResearchSubject explorerConfig[0].charts: missing_column',
    );
  });
});
