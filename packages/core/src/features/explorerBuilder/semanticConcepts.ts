import { GEN3_LOOM_API } from '../../constants';
import { fetchGraphQL } from '../loom';
import type {
  SemanticCatalogCompleteness,
  SemanticCatalogDiagnostic,
  SemanticConcept,
  SemanticConceptCatalog,
  SemanticConceptColumn,
  SemanticConceptExamples,
  SemanticConceptFamily,
  SemanticConceptPopulation,
  SemanticConceptRepetition,
  SemanticConceptResource,
  SemanticConceptSelector,
  SemanticConceptSource,
} from './types';

type RecordValue = Record<string, unknown>;

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const record = (value: unknown): RecordValue => (isRecord(value) ? value : {});

const string = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value : undefined;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const normalizeSource = (value: unknown): SemanticConceptSource | undefined => {
  if (!isRecord(value)) return undefined;
  const source = { ...value } as SemanticConceptSource;
  const terminology = record(value.terminology);
  return {
    ...source,
    system: string(value.system),
    standardVersion: string(value.standardVersion),
    kind: string(value.kind),
    resourceType: string(value.resourceType),
    keyPaths: strings(value.keyPaths),
    valuePaths: strings(value.valuePaths),
    logicalType: string(value.logicalType),
    terminology: Object.keys(terminology).length
      ? Object.fromEntries(Object.entries(terminology).filter((entry) => typeof entry[1] === 'string')) as Record<string, string>
      : undefined,
  };
};

const normalizeColumn = (value: unknown, fallbackName: string): SemanticConceptColumn => {
  const column = record(value);
  return {
    ...column,
    name: string(column.name) ?? fallbackName,
    logicalType: string(column.logicalType),
    nullable: column.nullable !== false,
    repeated: column.repeated === true,
    filterable: column.filterable !== false,
    sortable: column.sortable !== false,
    aggregatable: column.aggregatable === true,
  };
};

const normalizeSelector = (value: unknown): SemanticConceptSelector | undefined => {
  if (!isRecord(value)) return undefined;
  return { ...value, sourcePath: string(value.sourcePath), valuePath: string(value.valuePath) };
};

const normalizePopulation = (value: unknown): SemanticConceptPopulation | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    recordCount: typeof value.recordCount === 'number' ? value.recordCount : undefined,
    fraction: typeof value.fraction === 'number' ? value.fraction : undefined,
  };
};

const normalizeExamples = (value: unknown): SemanticConceptExamples | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    values: Array.isArray(value.values) ? value.values : undefined,
    suppressed: value.suppressed === true,
    reason: string(value.reason),
  };
};

const normalizeRepetition = (value: unknown): SemanticConceptRepetition | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    shape: string(value.shape),
    rowExpansion: string(value.rowExpansion),
    maxItemsObserved: typeof value.maxItemsObserved === 'number' ? value.maxItemsObserved : undefined,
  };
};

export const normalizeSemanticConcept = (value: unknown): SemanticConcept | undefined => {
  const concept = record(value);
  const id = string(concept.id);
  const ruleId = string(concept.ruleId);
  if (!id || !ruleId) return undefined;
  const output = record(concept.output);
  const selection = record(output.selection);
  const rawColumn = record(concept.column);
  const rawExamples = record(concept.examples);
  const rawSource = record(concept.source);
  const selector = isRecord(concept.selector)
    ? concept.selector
    : isRecord(output.selection)
      ? { sourcePath: selection.sourcePath, valuePath: selection.valueSelector }
      : undefined;
  const fallbackColumn = {
    name: id.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    logicalType: string(output.valueType) ?? string(rawSource.primitive),
    repeated: rawSource.repeated === true || /repeated|array|pivot/i.test(string(output.cardinality) ?? ''),
  };
  return {
    ...concept,
    id,
    label: string(concept.label) ?? id,
    family: string(concept.family),
    ruleId,
    description: string(concept.description),
    source: normalizeSource(concept.source),
    selector: normalizeSelector(selector),
    column: normalizeColumn(Object.keys(rawColumn).length ? rawColumn : fallbackColumn, fallbackColumn.name),
    population: normalizePopulation(concept.population) ?? (typeof rawSource.populationCount === 'number'
      ? { recordCount: rawSource.populationCount }
      : undefined),
    examples: normalizeExamples(concept.examples) ?? (Object.keys(rawExamples).length
      ? { ...rawExamples, values: Array.isArray(rawExamples.values) ? rawExamples.values : undefined, suppressed: rawExamples.suppressed === true }
      : undefined),
    repetition: normalizeRepetition(concept.repetition) ?? (fallbackColumn.repeated
      ? { shape: 'array', rowExpansion: 'none' }
      : undefined),
  };
};

const normalizeFamily = (value: unknown): SemanticConceptFamily | undefined => {
  const family = record(value);
  const id = string(family.id) ?? string(family.label);
  if (!id) return undefined;
  return {
    ...family,
    id,
    label: string(family.label),
    concepts: (Array.isArray(family.concepts) ? family.concepts : [])
      .map(normalizeSemanticConcept)
      .map((concept) => concept && (!concept.family ? { ...concept, family: id } : concept))
      .filter((concept): concept is SemanticConcept => Boolean(concept)),
  };
};

const normalizeResource = (value: unknown): SemanticConceptResource | undefined => {
  const resource = record(value);
  const resourceType = string(resource.resourceType);
  if (!resourceType) return undefined;
  return {
    ...resource,
    resourceType,
    label: string(resource.label),
    documentCount: typeof resource.documentCount === 'number' ? resource.documentCount : undefined,
    families: (Array.isArray(resource.families) ? resource.families : [])
      .map(normalizeFamily)
      .filter((family): family is SemanticConceptFamily => Boolean(family)),
  };
};

const normalizeCompleteness = (value: unknown): SemanticCatalogCompleteness | undefined => {
  if (!isRecord(value)) return undefined;
  return {
    ...value,
    state: string(value.state),
    resourceLimit: typeof value.resourceLimit === 'number' ? value.resourceLimit : undefined,
    conceptLimitPerResource: typeof value.conceptLimitPerResource === 'number' ? value.conceptLimitPerResource : undefined,
    returnedResourceCount: typeof value.returnedResourceCount === 'number' ? value.returnedResourceCount : undefined,
    returnedConceptCount: typeof value.returnedConceptCount === 'number' ? value.returnedConceptCount : undefined,
  };
};

const normalizeDiagnostic = (value: unknown): SemanticCatalogDiagnostic => {
  const diagnostic = record(value);
  return {
    severity: diagnostic.severity === 'error' || diagnostic.severity === 'info' ? diagnostic.severity : 'warning',
    code: string(diagnostic.code) ?? 'SEMANTIC_CATALOG_DIAGNOSTIC',
    message: string(diagnostic.message) ?? 'Semantic catalog disclosure',
    retryable: typeof diagnostic.retryable === 'boolean' ? diagnostic.retryable : undefined,
    details: isRecord(diagnostic.details) ? diagnostic.details : undefined,
  };
};

/** Normalize the v2 contract while tolerating additive producer fields. */
export const normalizeSemanticConceptCatalog = (value: unknown): SemanticConceptCatalog => {
  const wrapper = record(value);
  const raw = isRecord(wrapper.catalog) ? wrapper.catalog : wrapper;
  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 2,
    catalogId: string(raw.catalogId),
    project: isRecord(raw.project)
      ? { organization: string(raw.project.organization), project: string(raw.project.project) }
      : undefined,
    source: isRecord(raw.source) ? raw.source : undefined,
    completeness: normalizeCompleteness(raw.completeness),
    resources: (Array.isArray(raw.resources) ? raw.resources : [])
      .map(normalizeResource)
      .filter((resource): resource is SemanticConceptResource => Boolean(resource)),
    diagnostics: (Array.isArray(raw.diagnostics) ? raw.diagnostics : []).map(normalizeDiagnostic),
  };
};

interface SemanticConceptCatalogResponse {
  readonly semanticConceptCatalog?: unknown;
  readonly dataframeBuilderSemanticCatalog?: unknown;
}

/**
 * Fetch the optional Loom v2 catalog. A missing endpoint is intentionally a
 * normal error for callers: the guided builder falls back to its existing
 * populated-field scan and labels those choices as technical fields.
 */
export const fetchSemanticConceptCatalog = async (
  project: string,
  resourceType: string,
  signal?: AbortSignal,
): Promise<SemanticConceptCatalog> => {
  const response = await fetchGraphQL<SemanticConceptCatalogResponse>(
    {
      query: `query BuilderSemanticCatalog($input: DataframeBuilderSemanticCatalogInput!) {
        dataframeBuilderSemanticCatalog(input: $input) {
          schemaVersion project sourceGeneration
          completeness { state resourceLimit conceptLimitPerResource returnedResourceCount returnedConceptCount }
          resources {
            resourceType documentCount
            families { id label ruleId concepts {
              id label group description ruleId ruleVersion
              source { canonical resourceType path profile sourcePath valuePath keySelector keySystem keyCode keyDisplay ruleVersion shape primitive repeated populationCount distinctTruncated }
              output { mode valueType cardinality generic selection { mode sourcePath keySelector valueSelector valueFallbacks itemSource itemResourceType transforms key } }
              examples { values limited }
            } }
          }
          diagnostics { severity code ruleId path message }
        }
      }`,
      variables: { input: { project, rootResourceType: resourceType } },
    },
    { endpoint: `${GEN3_LOOM_API}/graphql/graph`, signal },
  );
  return normalizeSemanticConceptCatalog(response.dataframeBuilderSemanticCatalog ?? response.semanticConceptCatalog);
};
