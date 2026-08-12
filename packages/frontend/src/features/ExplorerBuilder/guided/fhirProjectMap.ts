import { GEN3_LOOM_API, fetchGraphQL } from '@gen3/core';

export interface FhirFieldHint {
  readonly fieldRef: string;
  readonly label?: string;
  readonly path?: string;
  /** Populated only when this is a v2 semantic concept, never inferred for fallback fields. */
  readonly conceptId?: string;
  readonly ruleId?: string;
  readonly columnName?: string;
  readonly selector?: {
    readonly sourcePath?: string;
    readonly valuePath?: string;
  };
}

export interface FhirTraversalHint {
  readonly fromType: string;
  readonly label: string;
  readonly toType: string;
  readonly edgeCount: number;
}

export interface FhirResourceHint {
  readonly resourceType: string;
  /** Best non-overcounting resource count exposed by Loom's catalog scan. */
  readonly documentCount?: number;
  readonly fields: ReadonlyArray<FhirFieldHint>;
  readonly traversals: ReadonlyArray<FhirTraversalHint>;
}

interface ProjectMapResult {
  readonly resources?: ReadonlyArray<FhirResourceHint & { readonly rowCount?: number }>;
  readonly relationships?: ReadonlyArray<FhirTraversalHint>;
}

interface ProjectMapResponse {
  readonly dataframeBuilderProjectMap: ProjectMapResult;
}

export interface FhirProjectMap {
  readonly nodes: ReadonlyArray<FhirResourceHint>;
  readonly edges: ReadonlyArray<FhirTraversalHint>;
}

const projectMapQuery = `query BuilderProjectMap($input: DataframeBuilderProjectMapInput!) {
  dataframeBuilderProjectMap(input: $input) {
    project
    sourceGeneration
    resources {
      resourceType
      documentCount
      fields { fieldRef label path selector { sourcePath valuePath } }
      traversals { fromType label toType edgeCount }
    }
    relationships { fromType label toType edgeCount }
  }
}`;

const endpoint = `${GEN3_LOOM_API}/graphql/graph`;

/**
 * Reads Loom's populated-field introspection surface.  This is deliberately a
 * read-only scan: it never guesses a FHIR field or relationship and it never
 * changes a project while the steward is exploring it.
 */
export const scanFhirProjectMap = async (
  project: string,
  signal?: AbortSignal,
): Promise<FhirProjectMap> => {
  const response = await fetchGraphQL<ProjectMapResponse>(
    {
      query: projectMapQuery,
      variables: { input: { project, includePivotOnlyFields: false } },
    },
    { endpoint, signal },
  );
  const map = response.dataframeBuilderProjectMap ?? {};
  const nodeByType = new Map<string, FhirResourceHint>();
  const edgeByKey = new Map<string, FhirTraversalHint>();
  for (const node of map.resources ?? []) {
    // Relationship catalogs also contain path-segment artifacts such as
    // "subject", "parent", and "collection". They are graph plumbing, not
    // datasets a steward can select. A real graph node must have records or
    // selectable populated fields.
    if ((node.documentCount ?? 0) > 0 || node.fields.length > 0) {
      nodeByType.set(node.resourceType, node);
    }
    for (const edge of node.traversals) {
      edgeByKey.set(`${edge.fromType}/${edge.label}/${edge.toType}`, edge);
    }
  }
  for (const edge of map.relationships ?? []) {
    if (edge.edgeCount > 0) {
      edgeByKey.set(`${edge.fromType}/${edge.label}/${edge.toType}`, edge);
    }
  }

  const edges = [...edgeByKey.values()].filter(
    (edge) => nodeByType.has(edge.fromType) && nodeByType.has(edge.toType),
  );
  const connectedTypes = new Set(
    edges.flatMap((edge) => [edge.fromType, edge.toType]),
  );

  return {
    nodes: [...nodeByType.values()].filter((node) => connectedTypes.has(node.resourceType)).sort((left, right) =>
      left.resourceType.localeCompare(right.resourceType),
    ),
    edges: edges.sort((left, right) =>
      `${left.fromType}/${left.toType}`.localeCompare(
        `${right.fromType}/${right.toType}`,
      ),
    ),
  };
};
