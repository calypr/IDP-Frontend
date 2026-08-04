import { resourcePathFromProjectID } from '@gen3/core';
import type {
  QueryModeConfiguration,
  QueryModePreset,
  ProjectBinding,
} from './types';
import { copyVariables } from './config';

export interface PresetDefinition {
  readonly query: string;
  readonly variables: Record<string, unknown>;
  readonly schemaRoot: 'query' | 'mutation';
  readonly schemaField: string;
  readonly binding: ProjectBinding;
}

const dataframeQuery = `mutation RunFhirDataframe($input: FhirDataframeInput!, $limit: Int = 10) {
  runFhirDataframe(input: $input, limit: $limit) {
    columns
    rows
    rowCount
    diagnostics { totalMs }
  }
}`;

const graphQuery = `query FhirGraphExample($input: FhirGraphQueryInput!) {
  fhirGraph(input: $input) {
    sourceGeneration
    returnedCount
    pageInfo { hasMore }
    paths {
      terminalAlias
      nodes { alias resourceType id resource }
      relationships { alias label fromResourceType toResourceType }
    }
  }
}`;

const flatQuery = `query PatientRows($input: DataframeRowsInput!) {
  dataset: dataframeDataset(input: { dataType: "Patient" }) {
    name state rowCount
    columns { name logicalType nullable repeated filterable sortable aggregatable }
  }
  rows: dataframeRows(input: $input) {
    columns rows totalCount pageInfo { hasNextPage endCursor }
  }
}`;

const presetDefinitions: Record<QueryModePreset, PresetDefinition> = {
  'loom-fhir-dataframe': {
    query: dataframeQuery,
    variables: {
      limit: 10,
      input: {
        project: '',
        rootResourceType: 'Patient',
        rootFilters: [],
        rootFields: [
          { name: 'id', selector: { valuePath: 'id' }, valueMode: 'AUTO' },
          {
            name: 'gender',
            selector: { valuePath: 'gender' },
            valueMode: 'AUTO',
          },
        ],
      },
    },
    schemaRoot: 'mutation',
    schemaField: 'runFhirDataframe',
    binding: 'loom-input-project',
  },
  'loom-fhir-graph': {
    query: graphQuery,
    variables: {
      input: {
        project: '',
        rootResourceType: 'Patient',
        rootFilters: [],
        traverse: [],
        limit: 10,
      },
    },
    schemaRoot: 'query',
    schemaField: 'fhirGraph',
    binding: 'loom-input-project',
  },
  'loom-flat': {
    query: flatQuery,
    variables: { input: { dataType: 'Patient', first: 25, filters: [] } },
    schemaRoot: 'query',
    schemaField: 'dataframeRows',
    binding: 'loom-project-filter',
  },
  'guppy-flat': {
    query: `query PatientRows($filter: PatientFilterInput) {
  patient(filter: $filter) { _id patient_id patient_identifier }
}`,
    variables: { filter: {} },
    schemaRoot: 'query',
    schemaField: 'patient',
    binding: 'guppy-auth-resource-path',
  },
  generic: {
    query: '',
    variables: {},
    schemaRoot: 'query',
    schemaField: '',
    binding: 'none',
  },
};

export const getPresetDefinition = (
  preset: QueryModePreset,
): PresetDefinition => presetDefinitions[preset];

export const getModePreset = (
  mode: QueryModeConfiguration,
): PresetDefinition => {
  const preset = getPresetDefinition(mode.preset);
  return {
    ...preset,
    query: mode.defaultQuery ?? preset.query,
    variables: copyVariables(mode.defaultVariables ?? preset.variables),
  };
};

const withLoomProjectFilter = (
  variables: Record<string, unknown>,
  projectIDs: readonly string[],
): Record<string, unknown> => {
  const input = copyVariables(variables.input);
  const filters = Array.isArray(input.filters) ? input.filters : [];
  const retained = filters.filter(
    (filter) =>
      !(
        filter &&
        typeof filter === 'object' &&
        (filter as Record<string, unknown>).column === 'project_id'
      ),
  );
  return {
    ...variables,
    input: {
      ...input,
      filters:
        projectIDs.length === 0
          ? retained
          : [
              ...retained,
              {
                column: 'project_id',
                op: projectIDs.length === 1 ? 'EQ' : 'IN',
                value:
                  projectIDs.length === 1 ? projectIDs[0] : [...projectIDs],
              },
            ],
    },
  };
};

const withGuppyProjectFilter = (
  variables: Record<string, unknown>,
  projectIDs: readonly string[],
): Record<string, unknown> => {
  const filter = copyVariables(variables.filter);
  delete filter.auth_resource_path;
  const resourcePaths = projectIDs.map(resourcePathFromProjectID);
  return {
    ...variables,
    filter: {
      ...filter,
      ...(resourcePaths.length === 0
        ? {}
        : {
            auth_resource_path:
              resourcePaths.length === 1
                ? { _eq: resourcePaths[0] }
                : { _in: resourcePaths },
          }),
    },
  };
};

export const applyProjectBinding = (
  variables: Record<string, unknown>,
  binding: ProjectBinding,
  projectIDs: readonly string[],
): Record<string, unknown> => {
  if (binding === 'none') return copyVariables(variables);
  if (binding === 'loom-input-project') {
    return {
      ...variables,
      input: {
        ...copyVariables(variables.input),
        project: projectIDs[0] ?? '',
      },
    };
  }
  if (binding === 'loom-project-filter') {
    return withLoomProjectFilter(variables, projectIDs);
  }
  return withGuppyProjectFilter(variables, projectIDs);
};
