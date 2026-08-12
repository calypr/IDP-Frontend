import { normalizeSemanticConceptCatalog } from './semanticConcepts';

describe('semantic concept contract v2 normalization', () => {
  it('keeps open family/rule/type strings and safe metadata', () => {
    const catalog = normalizeSemanticConceptCatalog({
      schemaVersion: 2,
      completeness: { state: 'partial', returnedConceptCount: 2 },
      resources: [{
        resourceType: 'ObservationLike',
        families: [{
          id: 'future-domain-v9',
          label: 'Measurements',
          concepts: [{
            id: 'observation.future-score',
            label: 'Future clinical score',
            family: 'future-domain-v9',
            ruleId: 'future.source.rule.v8',
            source: { system: 'FutureClinicalSource', kind: 'future-value-family' },
            column: { name: 'future_clinical_score', logicalType: 'futureDecimal128' },
            examples: { suppressed: true, reason: 'low-frequency-values', values: ['must-not-be-used'] },
          }],
        }],
      }],
      diagnostics: [{ severity: 'warning', code: 'DISCOVERY_PARTIAL', message: 'partial' }],
    });

    const concept = catalog.resources[0].families[0].concepts[0];
    expect(catalog.completeness?.state).toBe('partial');
    expect(catalog.resources[0].families[0].id).toBe('future-domain-v9');
    expect(concept.ruleId).toBe('future.source.rule.v8');
    expect(concept.column.logicalType).toBe('futureDecimal128');
    expect(concept.examples?.suppressed).toBe(true);
    expect(concept.examples?.values).toEqual(['must-not-be-used']);
  });

  it('drops malformed concepts and supplies stable column fallback names', () => {
    const catalog = normalizeSemanticConceptCatalog({
      resources: [{ resourceType: 'Patient', families: [{ id: 'demographics', concepts: [
        { id: 'patient.birth-date', ruleId: 'direct.leaf.v1', label: 'Birth date', column: {} },
        { id: '', ruleId: 'missing' },
      ] }] }],
    });
    expect(catalog.resources[0].families[0].concepts).toHaveLength(1);
    expect(catalog.resources[0].families[0].concepts[0].column.name).toBe('patient_birth_date');
  });

  it('adapts Loom GraphQL output metadata to the frozen v2 concept shape', () => {
    const catalog = normalizeSemanticConceptCatalog({
      schemaVersion: 2,
      project: 'acme-cancer',
      sourceGeneration: 'generation-42',
      resources: [{
        resourceType: 'Patient',
        families: [{
          id: 'demographics',
          concepts: [{
            id: 'patient.birth-date',
            label: 'Birth date',
            ruleId: 'direct.leaf.v1',
            source: { resourceType: 'Patient', sourcePath: 'Patient', valuePath: 'birthDate', primitive: 'date', populationCount: 3 },
            output: { valueType: 'date', cardinality: 'optional-one', selection: { sourcePath: 'Patient', valueSelector: 'birthDate' } },
            examples: { values: ['1984-03-12'], limited: false },
          }],
        }],
      }],
      diagnostics: [],
    });
    const concept = catalog.resources[0].families[0].concepts[0];
    expect(concept.family).toBe('demographics');
    expect(concept.selector).toEqual({ sourcePath: 'Patient', valuePath: 'birthDate' });
    expect(concept.column.logicalType).toBe('date');
    expect(concept.population?.recordCount).toBe(3);
    expect(concept.examples?.values).toEqual(['1984-03-12']);
  });
});
