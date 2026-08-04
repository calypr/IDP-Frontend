import {
  normalizeQueryConfiguration,
  validateEndpointUrl,
  validateQueryConfiguration,
} from './config';

jest.mock('@gen3/core', () => ({ GEN3_LOOM_API: '/loom' }));

describe('Query configuration', () => {
  it('normalizes a legacy Loom graph endpoint without rewriting its service', () => {
    const configuration = normalizeQueryConfiguration({
      graphQLEndpoint: '/loom/graphql/graph',
    });

    expect(configuration.version).toBe(2);
    expect(configuration.endpoints.loomGraph.url).toBe('/loom/graphql/graph');
    expect(configuration.modes.map((mode) => mode.preset)).toEqual([
      'loom-fhir-graph',
      'loom-fhir-dataframe',
      'loom-flat',
    ]);
  });

  it('normalizes a legacy Guppy endpoint as Guppy', () => {
    const configuration = normalizeQueryConfiguration({
      graphQLEndpoint: 'https://example.org/guppy/graphql',
    });

    expect(configuration.modes).toHaveLength(1);
    expect(configuration.modes[0].preset).toBe('guppy-flat');
    expect(configuration.endpoints.guppy.service).toBe('guppy');
  });

  it('rejects unsafe endpoint URLs', () => {
    expect(validateEndpointUrl('//example.org/graphql', 'url')).toHaveLength(1);
    expect(validateEndpointUrl('javascript:alert(1)', 'url')).toHaveLength(1);
    expect(validateEndpointUrl('https://user:pass@example.org/graphql', 'url')).toHaveLength(1);
    expect(validateEndpointUrl('/loom/graphql/flat', 'url')).toEqual([]);
  });

  it('validates v2 endpoint and mode references', () => {
    expect(
      validateQueryConfiguration({
        version: 2,
        endpoints: {
          loom: { url: '/loom/graphql/flat', service: 'loom', surface: 'flat' },
        },
        modes: [
          { id: 'flat', label: 'Flat', endpoint: 'missing', preset: 'loom-flat' },
        ],
        defaultMode: 'missing',
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'modes[0].endpoint' }),
        expect.objectContaining({ path: 'defaultMode' }),
      ]),
    );
  });
});
