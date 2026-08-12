import type {
  FhirFieldHint,
  FhirResourceHint,
} from './fhirProjectMap';
import type {
  SemanticConcept,
  SemanticConceptCatalog,
} from '@gen3/core';

const normalized = (value: string) => value.replace(/[^A-Za-z0-9]/g, '').toLowerCase();

/** Match a catalog resource to a graph node without a closed resource enum. */
export const semanticResourceFor = (
  catalog: SemanticConceptCatalog | null | undefined,
  resourceType: string,
) => {
  const exact = catalog?.resources.find((resource) => resource.resourceType === resourceType);
  if (exact) return exact;
  const target = normalized(resourceType);
  return catalog?.resources.find((resource) => {
    const candidate = normalized(resource.resourceType);
    return candidate === target || candidate.endsWith(target) || target.endsWith(candidate) || candidate.startsWith(target) || target.startsWith(candidate);
  });
};

export const semanticConceptsFor = (
  catalog: SemanticConceptCatalog | null | undefined,
  resourceType: string,
): ReadonlyArray<SemanticConcept> =>
  semanticResourceFor(catalog, resourceType)?.families.flatMap((family) => family.concepts) ?? [];

export const familyLabel = (id: string, label?: string) =>
  label?.trim() || id.trim() || 'Other concepts';

/** Convert a concept to the existing field shape used by table generation. */
export const semanticFieldHint = (concept: SemanticConcept): FhirFieldHint => ({
  fieldRef: concept.id,
  label: concept.label,
  path: concept.selector?.valuePath || concept.column.name,
  selector: concept.selector,
  conceptId: concept.id,
  ruleId: concept.ruleId,
  columnName: concept.column.name,
});

export const semanticFieldsFor = (
  catalog: SemanticConceptCatalog | null | undefined,
  resourceType: string,
): ReadonlyArray<FhirFieldHint> => semanticConceptsFor(catalog, resourceType).map(semanticFieldHint);

const pathVariantsFor = (field: FhirFieldHint, resourceType: string) => {
  const sourcePath = field.selector?.sourcePath?.trim();
  const valuePath = field.selector?.valuePath?.trim();
  const fullPath = sourcePath && valuePath
    ? `${sourcePath.replace(/\.$/, '')}.${valuePath.replace(/^\./, '')}`
    : sourcePath || valuePath || field.path || '';
  const withoutResource = fullPath.replace(new RegExp(`^${resourceType}[./]`, 'i'), '');
  return [fullPath, withoutResource, valuePath, field.columnName].filter(Boolean).map((value) =>
    String(value).replace(/^root\./i, '').replace(/\[\d*\]/g, '[]').toLowerCase(),
  );
};

/** Restore a semantic field from a legacy recipe expression when identity metadata is absent. */
export const semanticFieldRefForPath = (
  catalog: SemanticConceptCatalog | null | undefined,
  resourceType: string,
  path: string,
) => {
  const normalizedPath = path.replace(/^root\./i, '').replace(/\[\d*\]/g, '[]').toLowerCase();
  return semanticFieldsFor(catalog, resourceType).find((field) =>
    pathVariantsFor(field, resourceType).includes(normalizedPath),
  )?.fieldRef;
};

export const conceptSelectionsFor = (
  catalog: SemanticConceptCatalog | null | undefined,
  resourceType: string,
  selected: ReadonlyArray<string>,
) => semanticConceptsFor(catalog, resourceType)
  .filter((concept) => selected.includes(concept.id))
  .map((concept) => ({
    conceptId: concept.id,
    ruleId: concept.ruleId,
    columnName: concept.column.name,
    label: concept.label,
  }));

export const fieldSelectionFor = (
  fields: ReadonlyArray<FhirFieldHint>,
  selected: ReadonlyArray<string>,
) => fields.filter((field) => selected.includes(field.fieldRef));

export const isPartialSemanticCatalog = (catalog: SemanticConceptCatalog | null | undefined) =>
  catalog?.completeness?.state === 'partial' ||
  catalog?.diagnostics.some((diagnostic) => diagnostic.code.toLowerCase().includes('partial') || diagnostic.code.toLowerCase().includes('limit')) === true;
