jest.mock('@gen3/core', () => ({
  GEN3_COMMONS_NAME: 'cbds',
  GEN3_LOOM_API: '/loom',
  groupSharedFields: jest.fn(),
  isLoomGraphQLRequestError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'isLoomGraphQLRequestError' in error &&
    error.isLoomGraphQLRequestError === true,
  isLoomDataType: () => true,
}));
jest.mock('../../lib/common/staticProps', () => ({
  loadNavigationFromContext: jest.fn(),
}));
jest.mock('../../lib/content', () => ({
  __esModule: true,
  default: {},
}));

import { getExplorerLoomProblem, ValidateExplorerConfiguration } from './data';
import type { CohortBuilderConfiguration } from '../../features/CohortBuilder';

const configuration: CohortBuilderConfiguration = {
  explorerConfig: [
    {
      tabTitle: 'Patient',
      guppyConfig: { dataType: 'ResearchSubject' },
      filters: {
        tabs: [{ title: 'Filters', fields: ['identifier'], fieldsConfig: {} }],
      },
      charts: {
        deceasedBoolean: { chartType: 'fullPie', title: 'Vital status' },
      },
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
  ResearchSubject: new Set(['identifier', 'deceasedBoolean', 'project_id']),
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

describe('getExplorerLoomProblem', () => {
  const loomError = (code: string) => ({
    isLoomGraphQLRequestError: true,
    code,
    requestId: 'loom-request-1',
    retryable: false,
    httpStatus: 200,
  });

  it('describes an empty Loom publication catalog without crashing Explorer', () => {
    expect(
      getExplorerLoomProblem(loomError('DATASET_NOT_FOUND')),
    ).toMatchObject({
      source: 'loom',
      status: 404,
      code: 'DATASET_NOT_FOUND',
      retryable: true,
      message: expect.stringContaining('has not been published yet'),
    });
  });

  it('preserves a distinct, user-facing permission message', () => {
    expect(getExplorerLoomProblem(loomError('FORBIDDEN'))).toMatchObject({
      status: 403,
      retryable: false,
      message: expect.stringContaining('do not have permission'),
    });
  });

  it('does not convert non-Loom failures into Explorer availability cards', () => {
    expect(getExplorerLoomProblem(new Error('unexpected'))).toBeNull();
  });
});
