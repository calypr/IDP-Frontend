import type { SemanticConceptCatalog } from '@gen3/core';
import { conceptSelectionsFor, familyLabel, isPartialSemanticCatalog, semanticConceptsFor, semanticFieldHint, semanticFieldRefForPath } from './semanticConcepts';

const fixture: SemanticConceptCatalog = {
  schemaVersion: 2,
  completeness: { state: 'partial' },
  resources: [{
    resourceType: 'ObservationLike',
    families: [{
      id: 'future-clinical-domain-v9',
      label: 'Clinical measurements',
      concepts: [
        { id: 'observation.future-score', label: 'Future clinical score', family: 'future-clinical-domain-v9', ruleId: 'future.source.rule.v8', column: { name: 'future_clinical_score', logicalType: 'futureDecimal128' }, examples: { suppressed: true } },
        { id: 'observation.anatomical-sites', label: 'Anatomical sites', family: 'future-clinical-domain-v9', ruleId: 'observation.component.array.v2', selector: { sourcePath: 'Observation.component', valuePath: 'valueCodeableConcept.coding.display' }, column: { name: 'anatomical_sites', repeated: true }, repetition: { shape: 'array', rowExpansion: 'none' } },
      ],
    }],
  }],
  diagnostics: [{ severity: 'warning', code: 'DISCOVERY_PARTIAL', message: 'partial' }],
} as SemanticConceptCatalog;

describe('semantic concept picker helpers', () => {
  it('groups unknown resource/rule families without a closed mapping', () => {
    const concepts = semanticConceptsFor(fixture, 'Observation');
    expect(concepts.map((concept) => concept.ruleId)).toEqual([
      'future.source.rule.v8',
      'observation.component.array.v2',
    ]);
    expect(familyLabel('future-clinical-domain-v9', 'Clinical measurements')).toBe('Clinical measurements');
  });

  it('preserves suppressed examples and repeated array metadata', () => {
    const concepts = semanticConceptsFor(fixture, 'ObservationLike');
    expect(concepts[0].examples?.suppressed).toBe(true);
    expect(concepts[1].repetition?.rowExpansion).toBe('none');
    expect(semanticFieldHint(concepts[1]).columnName).toBe('anatomical_sites');
    expect(isPartialSemanticCatalog(fixture)).toBe(true);
  });

  it('emits the v2 authoring identity payload without regenerating column names', () => {
    expect(conceptSelectionsFor(fixture, 'ObservationLike', ['observation.anatomical-sites'])).toEqual([{
      conceptId: 'observation.anatomical-sites',
      ruleId: 'observation.component.array.v2',
      columnName: 'anatomical_sites',
      label: 'Anatomical sites',
    }]);
  });

  it('restores a concept from its selector path without using the display label', () => {
    expect(semanticFieldRefForPath(fixture, 'ObservationLike', 'valueCodeableConcept.coding.display')).toBe('observation.anatomical-sites');
  });
});
