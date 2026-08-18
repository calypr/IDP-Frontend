import { applyProjectBinding, getModePreset } from './presets';

jest.mock('@gen3/core', () => ({
  GEN3_LOOM_API: '/loom',
  resourcePathFromProjectID: (projectID: string) => {
    const [program, ...project] = projectID.split('-');
    return `/programs/${program}/projects/${project.join('-')}`;
  },
}));

describe('Query presets', () => {
  it('binds Loom graph and dataframe projects through input.project', () => {
    const preset = getModePreset({
      id: 'graph',
      label: 'Graph',
      endpoint: 'loom',
      preset: 'loom-fhir-graph',
    });
    expect(
      applyProjectBinding(preset.variables, preset.binding, [
        'PROGRAM-PROJECT',
      ]),
    ).toEqual(
      expect.objectContaining({
        input: expect.objectContaining({ project: 'PROGRAM-PROJECT' }),
      }),
    );
  });

  it('adds exactly one Loom project_id EQ filter', () => {
    const variables = {
      input: {
        selector: {
          recipe: 'project_recipe',
          translationVersion: 'r000001_abcd',
          output: 'Patient',
        },
        filters: [
          { column: 'project_id', op: 'EQ', value: 'old' },
          { column: 'patient_gender', op: 'EQ', value: 'female' },
        ],
      },
    };
    const bound = applyProjectBinding(variables, 'loom-project-filter', [
      'PROGRAM-PROJECT',
    ]);
    expect((bound.input as { filters: unknown[] }).filters).toEqual([
      { column: 'patient_gender', op: 'EQ', value: 'female' },
      { column: 'project_id', op: 'EQ', value: 'PROGRAM-PROJECT' },
    ]);
  });

  it('binds multiple Loom projects using one IN filter', () => {
    const bound = applyProjectBinding(
      {
        input: {
          selector: {
            recipe: 'project_recipe',
            translationVersion: 'r000001_abcd',
            output: 'Patient',
          },
          filters: [],
        },
      },
      'loom-project-filter',
      ['PROGRAM-PROJECT-A', 'PROGRAM-PROJECT-B'],
    );

    expect((bound.input as { filters: unknown[] }).filters).toEqual([
      {
        column: 'project_id',
        op: 'IN',
        value: ['PROGRAM-PROJECT-A', 'PROGRAM-PROJECT-B'],
      },
    ]);
  });

  it('binds Guppy using the canonical auth resource path', () => {
    const bound = applyProjectBinding(
      { filter: {} },
      'guppy-auth-resource-path',
      ['PROGRAM-PROJECT-NAME'],
    );
    expect(bound.filter).toEqual({
      auth_resource_path: { _eq: '/programs/PROGRAM/projects/PROJECT-NAME' },
    });
  });

  it('binds multiple Guppy projects using _in', () => {
    const bound = applyProjectBinding(
      { filter: {} },
      'guppy-auth-resource-path',
      ['PROGRAM-PROJECT-A', 'PROGRAM-PROJECT-B'],
    );

    expect(bound.filter).toEqual({
      auth_resource_path: {
        _in: [
          '/programs/PROGRAM/projects/PROJECT-A',
          '/programs/PROGRAM/projects/PROJECT-B',
        ],
      },
    });
  });

  it('does not mutate variables when no project is selected', () => {
    const variables = { input: { project: 'manual' } };
    expect(applyProjectBinding(variables, 'loom-input-project', [])).toEqual({
      input: { project: '' },
    });
    expect(variables).toEqual({ input: { project: 'manual' } });
  });
});
