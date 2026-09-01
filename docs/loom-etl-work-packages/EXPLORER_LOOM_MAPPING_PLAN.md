# Explorer-to-Loom dataset mapping plan

## Objective

Migrate Explorer reads from the legacy flat metadata API to Loom's published
dataframe API without changing Loom's canonical recipe output names.

Explorer may continue to use its established data-type vocabulary in routes,
configuration, labels, and component props. A single frontend-owned adapter
will translate those values into Loom `dataType` values before calling the Loom
fetch hooks.

This is an Explorer integration change. It is not a missing Loom recipe or
publication feature.

## Decision

Loom's default recipe output names remain canonical:

| Explorer or legacy data type | Loom `dataType` |
| --- | --- |
| `file` | `DocumentReference` |
| `document_reference` | `DocumentReference` |
| `research_subject` | `ResearchSubject` |
| `specimen` | `Specimen` |
| `medication_administration` | `MedicationAdministration` |
| `group_member` | `GroupMember` |

Both `file` and `document_reference` map to `DocumentReference` because the
legacy ETL index name and Explorer's user-facing concept are not necessarily
the same string. The Explorer checkout must verify which form is used at each
current call site before obsolete forms are removed.

There is no separate `publication` output in the default recipe. Publication
is the operation that makes the five outputs above available through Loom. No
`Publication` dataset or output alias should be invented.

## Ownership boundary

### Explorer owns

- the legacy-to-canonical data-type map;
- selection of the correct Loom hook for each Explorer read;
- conversion of Explorer filters, sorting, pagination, and facets into Loom
  query inputs;
- adaptation of Loom responses into existing Explorer view models;
- user-facing fallback, empty, loading, and error states;
- migration and removal of the old Explorer read path.

### Loom owns

- canonical output names from the materialized recipe;
- discovery of published datasets;
- principal-scoped project federation;
- active-generation resolution;
- row authorization;
- ClickHouse row, filter, sort, cursor, and aggregation execution;
- publication readiness and error reporting.

### The ETL job owns

- loading complete generations into Loom;
- running and waiting for the default recipe materialization;
- failing the job if publication does not reach `READY`.

The ETL job does not publish Explorer-specific aliases or configure frontend
data-type mappings.

## Loom API contract used by Explorer

Explorer should use the projectless, principal-scoped GraphQL read surface:

```graphql
dataframeDatasets
dataframeDataset(input: { dataType: $dataType })
dataframeRows(input: {
  dataType: $dataType
  columns: $columns
  filters: $filters
  sort: $sort
  first: $first
  after: $after
})
dataframeAggregate(input: {
  dataType: $dataType
  groupBy: $groupBy
  filters: $filters
  operation: $operation
  column: $column
})
```

Explorer supplies a canonical `dataType` after applying its map. It must not
supply a project or generation. Loom derives authorized projects from the
authenticated principal, resolves active generations, and federates matching
published outputs.

## Work package 1: inventory the current Explorer contract

Before editing hooks, trace the current Explorer read path from rendered page
to network request.

1. Locate every route, configuration value, component prop, selector, and hook
   that passes a data-type value.
2. Record the actual values in use, including `file`, `document_reference`, and
   `research_subject`.
3. Locate the current hooks for:
   - schema or field discovery;
   - rows;
   - total counts;
   - facets or grouped counts;
   - filter submission;
   - sort submission;
   - cursor or offset pagination.
4. Record the response shape consumed by each component.
5. Identify whether the new Loom hooks already expose those operations or need
   a thin wrapper.

Deliverable: a call-site inventory that identifies the one adapter boundary
through which all Explorer data types can pass.

Acceptance criteria:

- no Explorer metadata request path remains unaccounted for;
- the real network-emitting functions are identified;
- the inventory distinguishes user-facing labels from API data-type values;
- existing hook consumers and their required return shapes are listed.

## Work package 2: add the canonical mapping module

Create one mapping module adjacent to the Loom hooks, not inside individual
pages or components.

The module should expose a closed input type where practical and one resolver:

```ts
export const EXPLORER_TO_LOOM_DATA_TYPE = {
  file: 'DocumentReference',
  document_reference: 'DocumentReference',
  research_subject: 'ResearchSubject',
  specimen: 'Specimen',
  medication_administration: 'MedicationAdministration',
  group_member: 'GroupMember',
} as const;

export function toLoomDataType(dataType: ExplorerDataType): LoomDataType {
  return EXPLORER_TO_LOOM_DATA_TYPE[dataType];
}
```

Use the frontend's generated GraphQL types for `LoomDataType` if they provide a
useful type. Otherwise define the canonical values locally from the map rather
than accepting arbitrary strings.

Unknown legacy values must fail visibly during development. Do not silently
pass an unknown value to Loom and do not default it to `DocumentReference`.

Acceptance criteria:

- all mappings live in one module;
- the map contains only real default recipe outputs;
- unknown values produce a deterministic error or explicit unsupported state;
- unit tests cover every entry and the unknown-value behavior;
- no Loom backend change is required.

## Work package 3: route Loom fetch hooks through the mapping

Apply `toLoomDataType` at the outermost hook boundary that still receives an
Explorer data type. Components should not know Loom recipe output names unless
they already operate directly on Loom metadata.

For each hook:

1. Accept the existing Explorer-facing data type.
2. Resolve it once to the canonical Loom `dataType`.
3. Use that canonical value consistently for dataset metadata, rows, and
   aggregate requests.
4. Include the original Explorer value in client-side diagnostics while
   avoiding sensitive request data.
5. Keep query-cache keys unambiguous. Prefer the canonical Loom value in cache
   keys so `file` and `document_reference` share the same dataset cache entry.

Do not map column names. Dataset aliases and dataframe column names are
different contracts; column compatibility must be assessed separately from
this plan.

Acceptance criteria:

- `file` emits `dataType: "DocumentReference"` for dataset, row, and aggregate
  requests;
- `research_subject` emits `dataType: "ResearchSubject"` for all three;
- aliases that map to the same Loom output do not create inconsistent caches;
- components retain their current labels and route vocabulary;
- no request sends a legacy alias to Loom.

## Work package 4: adapt Explorer operations to Loom

### Dataset and field discovery

Use `dataframeDataset` to retrieve publication metadata and columns. Convert
`DataframeColumn` values into the field model expected by Explorer, preserving:

- name;
- logical type;
- nullability and repeatedness;
- filterable, sortable, and aggregatable capabilities.

Explorer should disable unsupported controls based on these capabilities
instead of issuing invalid requests.

### Rows

Use `dataframeRows` with the canonical data type. Preserve the existing table
contract by adapting:

- returned column order;
- JSON row values;
- total count, when supplied;
- `pageInfo.hasNextPage`;
- `pageInfo.endCursor`.

The adapter should treat `endCursor` as opaque. It must not parse it or convert
it into an offset.

### Filters and sorting

Create explicit conversion functions from Explorer filter state to
`DataframeFilterInput` and from Explorer sort state to `DataframeSortInput`.
Reject unsupported operators before the request and surface a usable UI error.

Do not infer filter behavior from display labels. Always use Loom column names
from dataset metadata.

### Facets and counts

Use `dataframeAggregate` for grouped counts and other supported aggregations.
Keep the same canonical data type and active filter set used by the row query.
Define whether a facet excludes its own active filter based on current Explorer
behavior, then preserve that behavior explicitly in the adapter.

Acceptance criteria:

- the Explorer table can load, filter, sort, and paginate Loom rows;
- facets and displayed totals are calculated over the same authorization scope
  as rows;
- unsupported column operations are disabled or rejected before querying;
- cursor pagination works across at least two pages without duplicates or
  omissions;
- changing the Explorer data type resets incompatible filters and cursors.

## Work package 5: handle readiness and partial availability

Explorer must distinguish these cases:

1. Loom is unreachable or returns a transport error.
2. The user is unauthenticated or has no authorized projects.
3. No active publication exists for the mapped data type.
4. A publication exists but is not `READY`.
5. The publication is `READY` but contains zero rows.
6. The requested legacy data type is unsupported by the mapping.

Use `dataframeDatasets` or `dataframeDataset` as the availability source. Do not
fall back silently to the old backend after a Loom error; that could show data
from a different generation or authorization path.

Acceptance criteria:

- each state has a deterministic hook result and user-visible behavior;
- an empty ready dataset is not reported as a missing publication;
- an unsupported mapping is distinguishable from a missing Loom dataset;
- retries do not mix cursors or rows from different data types.

## Work package 6: tests

### Mapping unit tests

- assert every table entry;
- assert both `file` and `document_reference` map to `DocumentReference`;
- assert unsupported values fail explicitly;
- assert the map contains the five canonical default recipe outputs.

### Hook request-contract tests

Mock the GraphQL boundary and verify exact variables for:

- dataset discovery;
- first row page;
- next row page;
- filters;
- ascending and descending sort;
- grouped count;
- filtered grouped count.

At minimum, cover `file`, `research_subject`, and one direct snake_case to
PascalCase mapping.

### Hook response-adapter tests

- column capabilities;
- empty rows;
- null and repeated values;
- total count present and absent;
- final and non-final pages;
- Loom GraphQL errors;
- missing publication;
- stale request completion after switching data types.

### Explorer integration tests

For one representative Explorer page:

1. render with the legacy `file` concept;
2. verify the network request uses `DocumentReference`;
3. render returned columns and rows;
4. apply a filter and sort;
5. request a second page;
6. render a facet count;
7. switch to `research_subject` and verify state reset.

### Loom contract check

Add or retain a Loom-side test proving that canonical output names can resolve
through `dataframeDataset`, `dataframeRows`, and `dataframeAggregate`. This is a
contract check, not an alias feature.

## Work package 7: rollout

1. Land the mapping and hook tests without changing the active Explorer source.
2. Add a temporary frontend data-source switch if Explorer does not already
   have one.
3. Enable Loom in a development environment with a known `READY` default
   recipe publication.
4. Compare visible rows, totals, facets, filters, sorting, and pagination for
   the representative Explorer pages.
5. Validate with users authorized for one project, multiple projects, and no
   projects.
6. Make Loom the default after acceptance checks pass.
7. Remove the old fetch path and temporary switch in a follow-up change after a
   short observation window.

The switch controls the frontend read implementation only. It must not change
recipe names, ETL publication behavior, or Loom aliases.

## Observability

During rollout, record non-sensitive client telemetry for:

- original Explorer data type;
- mapped Loom data type;
- operation category: dataset, rows, or aggregate;
- success, unsupported mapping, missing publication, authorization failure, or
  transport failure;
- request duration.

Do not log row contents, filter values, authorization paths, or access tokens.

## Explicit non-goals

- adding `file`, `research_subject`, or other legacy aliases to Loom bundle
  publication;
- renaming Loom's default recipe outputs;
- creating a `Publication` dataframe output;
- changing ETL generation loading or recipe materialization;
- redesigning Explorer routes, labels, or page layout;
- preserving the old backend as an automatic runtime fallback;
- solving dataframe column-name parity inside the dataset-name mapping layer.

## Definition of done

The mapping migration is complete when:

1. Explorer can request all five default metadata datasets through its existing
   concepts while every Loom request uses a canonical recipe output name.
2. The representative Explorer flows load rows, filters, sorting, pagination,
   totals, and facets from Loom.
3. Authorization and multi-project federation are left to Loom and verified in
   integration testing.
4. Missing, empty, unauthorized, unsupported, and failed states are distinct.
5. Mapping, hook-contract, response-adapter, and representative UI tests pass.
6. No Loom publication alias was added for Explorer compatibility.
7. The old Explorer read path can be removed without changing the Loom recipe
   or ETL job.

