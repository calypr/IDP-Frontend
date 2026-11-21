# Explorer Builder Authoring Contract Refactor

## Handoff objective

Refactor the Explorer Builder, Gecko, and Loom so the Builder has one durable
authoring model and Loom is the sole component that converts dataframe intent
into an executable recipe.

The current system must no longer construct a recipe by combining semantic
concepts, technical FHIR paths, recipe-family candidates, cached checkbox
state, and old recipe fragments in the browser. Every selectable column that
Loom advertises must be accepted by Loom when applied against the same pinned
catalog snapshot. Routine Builder interaction must not produce HTTP 400.

This document is intended to be sufficient implementation context on its own.
Do not treat the work as a list of isolated 400-response patches. The goal is
to replace the broken boundary that permits the Builder and Loom to disagree.

## Repositories and relevant code

### IDP Frontend

Workspace root:

`/Users/peterkor/Desktop/FFNEW/IDP-Frontend`

Primary files:

- `packages/frontend/src/features/ExplorerBuilder/guided/GuidedBuilder.tsx`
- `packages/frontend/src/features/ExplorerBuilder/guided/candidateSelection.ts`
- `packages/frontend/src/features/ExplorerBuilder/guided/recipeRepair.ts`
- `packages/frontend/src/features/ExplorerBuilder/guided/semanticConcepts.ts`
- `packages/frontend/src/features/ExplorerBuilder/guided/fhirProjectMap.ts`
- `packages/frontend/src/features/ExplorerBuilder/previewRequests.ts`
- `packages/frontend/src/features/ExplorerBuilder/ExplorerBuilderPage.tsx`
- `packages/core/src/features/explorerBuilder/semanticConcepts.ts`
- `packages/core/src/features/explorerBuilder/types.ts`
- `packages/core/src/features/explorerBuilder/explorerBuilderApi.ts`

### Loom

The deployed recipe-candidate implementation is based on the Loom branch that
contains these commits:

- `2b9e7dd` semantic concept catalog
- `5b03035` semantic concept lowering
- `b281499` semantic selections in recipes
- `85839f0` recipe-driven column selection
- `05f0cbc` native recipe candidates
- `fbf689a` selected-family unknown-key behavior

The active local worktree during diagnosis was `/private/tmp/loom-pr22`. Locate
the durable Loom repository/branch containing the same history before making
final commits.

Primary files:

- `internal/dataframe/recipe/document_types.go`
- `internal/dataframe/recipe/document_validation.go`
- `internal/dataframe/recipe/schema/column_candidates.go`
- `internal/dataframe/semantic/concept_lowering.go`
- `internal/api/graphql/graph/query/recipe_column_candidates.go`
- `internal/api/graphql/graph/resolver/schema.resolvers.go`
- `internal/api/graphql/graph/schema/schema.graphqls`
- `internal/server/recipe_discovery.go`
- `internal/dataframe/recipe/engine/engine.go`

### Gecko

The active local worktree during diagnosis was
`/private/tmp/explorer-builder/gecko`. Locate its durable repository before
final commits.

Primary files:

- `internal/loom/builder.go`
- `internal/server/http/config/builder.go`
- `internal/server/http/config/builder_test.go`

## Confirmed architectural defects

### 1. One checkbox currently creates two executable declarations

For a semantic concept, `GuidedBuilder.applyTable` writes both:

1. A concrete recipe field with an executable selector.
2. A `conceptSelections` entry for the same column.

Example from the observed failure:

```json
{
  "fields": [
    {
      "name": "concept_c685bc...",
      "expr": { "select": "root.stage[].summary.text" },
      "conceptId": "concept_c685bc...",
      "ruleId": "CODEABLE_CONCEPT_VALUE"
    }
  ],
  "conceptSelections": [
    {
      "conceptId": "concept_c685bc...",
      "ruleId": "CODEABLE_CONCEPT_VALUE",
      "columnName": "concept_c685bc..."
    }
  ]
}
```

Loom's `LowerBundleConceptSelections` interprets `conceptSelections` as
instructions to generate concrete fields. It therefore attempts to generate a
second field for a column the frontend already generated.

The observed request currently fails before the duplicate is reached:

```text
CONCEPT_NOT_FOUND: concept "concept_c685bc..." is stale or absent from the
producer catalog
```

If that concept still existed, the same request would be vulnerable to a
column-name collision between the explicit field and the lowered concept.

### 2. Nested semantic selections are not part of Loom's recipe schema

The frontend writes `conceptSelections` on traversal nodes. Loom's
`recipe.Traversal` does not define that property. JSON decoding silently drops
it. The frontend therefore believes nested semantic identity is persisted when
Loom only receives the concrete traversal fields.

This is a schema-level incompatibility, not a transient catalog bug.

### 3. There are three competing column identity systems

| Source | Checkbox identity | Browser lowering behavior |
| --- | --- | --- |
| Semantic concept catalog | `concept_*` ID | Synthesizes an explicit field and `conceptSelections` |
| Recipe column candidates | Opaque candidate ID | Patches a native field/dynamic/pivot/extension family |
| Project-map technical fields | FHIR path/field ref | Synthesizes an explicit selector |

The active protocol changes according to which asynchronous request succeeded
and which node is currently inspected. These identities cannot safely share a
single `selectedFieldsByNode: Record<string, string[]>` without source and
snapshot information.

### 4. Native candidates only control the currently inspected node

`recipeCandidates` is one flat array for `candidateResourceType`. When another
node is selected, only that node is lowered through `selectedNativeCandidates`.
Old semantic selections and explicit fields remain elsewhere in the tree. A
single output can therefore contain several authoring protocols at once.

### 5. Candidate caching is not snapshot-safe

The frontend candidate cache is keyed by `outputName:nodePath`. It does not
include:

- recipe digest;
- dataset generation;
- catalog/resolved-schema digest;
- authorization-scope digest.

It merges old candidates into new responses and marks absent items unselected.
Consequently a checkbox can represent a candidate from an earlier recipe or
dataset generation while preview uses a different one.

### 6. The browser owns semantic compilation and traversal compilation

`GuidedBuilder.applyTable` currently performs all of these jobs:

- changes the dataframe row root;
- reverses the visual FHIR path;
- synthesizes traversal aliases and nested declarations;
- qualifies field selectors;
- generates output names and column names;
- converts semantic concepts to fields;
- patches native dataframe-producing families;
- reconstructs ExplorerConfig columns;
- preserves fragments from the previous recipe;
- immediately submits the result for preview.

This is compiler work embedded in a large React component. Loom subsequently
validates the browser's interpretation using different source metadata. The
400 rate is a predictable consequence.

### 7. Candidate discovery and preview do not share an explicit immutable
snapshot contract

The candidate response does not give the frontend a required token binding the
selection to the recipe digest, dataset generation, catalog digest, and auth
scope used to advertise it. Preview is therefore free to resolve against a
newer state.

### 8. Error status currently obscures authoring-state conflicts

The stale semantic selection above returns `INVALID_REQUEST`/400. HTTP 400
should be reserved for malformed JSON, malformed GraphQL variables, or an
unsupported wire schema. A stale server-advertised selection is a snapshot
conflict (409) or a well-formed authoring diagnostic (422), never malformed
input.

## Target architecture

### Principle 1: persist intent, compile recipes on the server

Introduce a versioned `ExplorerBuilderDocument` that is the durable editable
model. It describes what the steward chose, not how Loom happens to express it
as recipe AST nodes.

Recommended logical shape:

```ts
interface ExplorerBuilderDocumentV1 {
  schemaVersion: 1;
  project: string;
  outputs: BuilderOutputIntent[];
  explorer: ExplorerAuthoringDocument;
}

interface BuilderOutputIntent {
  id: string;                  // durable UI identity, independent of title
  name: string;                // safe physical output name
  title: string;               // Explorer display title
  visualStartResourceType: string;
  rowResourceType: string;     // final selected node; defines rows
  route: BuilderRouteEdgeRef[];
  nodeSelections: BuilderNodeSelection[];
}

interface BuilderNodeSelection {
  nodePath: string[];          // canonical Loom traversal aliases
  resourceType: string;
  selectedCandidateIds: string[];
}

interface BuilderRouteEdgeRef {
  id: string;                  // server-advertised immutable edge identity
  fromResourceType: string;
  toResourceType: string;
}
```

Do not store hand-built selectors, aliases, pivots, or dynamic family patches
in React state. Do not use display labels as identity.

### Principle 2: Loom owns the intent-to-recipe compiler

Add a Loom authoring operation that accepts the complete output intent and a
pinned authoring snapshot, then returns the canonical executable recipe.

Suggested GraphQL surface; exact naming may follow Loom conventions:

```graphql
type Query {
  dataframeRecipeAuthoringCatalog(
    input: DataframeRecipeAuthoringCatalogInput!
  ): DataframeRecipeAuthoringCatalog!
}

type Mutation {
  compileDataframeRecipeAuthoringIntent(
    input: CompileDataframeRecipeAuthoringIntentInput!
  ): CompiledDataframeRecipeAuthoringIntent!
}
```

The catalog response must contain:

- `snapshotToken` (opaque and required when compiling);
- `sourceGeneration`;
- `catalogDigest` or `resolvedSchemaDigest`;
- `authScopeDigest` or an equivalent server-bound scope identity;
- `baseRecipeDigest` when an existing recipe is being edited;
- every selected route node, not just the inspected node;
- canonical node paths and route-edge IDs;
- all selectable candidates grouped by node;
- candidate completeness and blocking diagnostics;
- existing/stale selection state;
- the exact emitted public column name for each candidate;
- filter/chart capability metadata derived from the emitted logical type;
- a stable candidate ID that is valid only for the returned snapshot.

The compile mutation must accept:

- `snapshotToken`;
- the base project recipe or immutable base recipe digest;
- complete output intent, including final row resource and route;
- selected candidate IDs for every node;
- expected output/draft version where relevant.

It must return:

- a canonical recipe document or canonical active output;
- canonical output/node paths;
- emitted dataframe columns and logical capabilities;
- normalized/stale selections;
- structured diagnostics;
- recipe digest;
- the source generation/resolved-schema digest actually used.

Loom must reject a token used against a different generation, recipe digest,
or authorization scope with a typed 409. It must never silently reinterpret a
candidate against a new catalog.

### Principle 3: one candidate protocol for every selectable column

The authoring catalog must adapt all underlying producer sources into the same
candidate contract:

- ordinary explicit FHIR fields;
- semantic concepts;
- dynamic maps;
- extension families;
- pivots;
- catalog projections.

The frontend may display semantic labels, examples, systems, codes, and family
grouping, but semantic concept IDs are provenance—not an alternate executable
selection protocol.

For an ordinary semantic field, the candidate should carry or resolve to a
native `recipe.Field`. For dynamic, extension, pivot, and projection choices,
the candidate should resolve to its native recipe family declaration. The
frontend sends only candidate IDs; Loom supplies selectors and family patches.

### Principle 4: one executable declaration per emitted column

Canonical compiled recipes must never contain both a concrete native
declaration and a `conceptSelections` instruction for the same column.

Recommended new behavior:

- Canonical Builder recipes contain concrete fields/native families only.
- Preserve semantic provenance on the concrete `recipe.Field` metadata already
  supported by `conceptId`, `ruleId`, and `label`, or add equivalent provenance
  to native family column metadata.
- Do not use `conceptSelections` as executable instructions for new Builder
  drafts.
- Retain legacy `conceptSelections` parsing only for migration of old drafts.

### Principle 5: ExplorerConfig binds to compiler output

Filters and charts operate on emitted dataframe columns, not candidate IDs or
FHIR paths. The compile response is the authoritative mapping:

```text
candidate ID -> emitted public column name -> logical type/capabilities
```

The frontend uses that mapping to preserve or prune ExplorerConfig table,
filter, and chart entries. For now only pie charts are authored. A chart toggle
must never affect recipe compilation or preview payload shape.

## Required invariants

Implement these as tests, not comments:

1. Every candidate advertised by Loom compiles successfully when selected
   against the same snapshot, unless its candidate carries a blocking
   diagnostic that prevents selection.
2. The browser never synthesizes a Loom selector from a label, example,
   concept ID, URL, or field path.
3. One selected candidate produces exactly one emitted dataframe column unless
   the candidate explicitly advertises a multi-column result.
4. Select-none, select-one, and select-all are represented exactly and remain
   stable after a candidate refresh.
5. Selecting a column on one node does not erase selections on any other node.
6. A candidate response cannot be merged across recipe, generation, catalog,
   or authorization-scope identities.
7. A new ingestion may mark selections stale but may not silently delete them.
8. The last selected resource defines dataframe rows; preceding resources are
   compiled as context traversals by Loom.
9. Candidate compilation, validation, preview, save, and publication use the
   same recipe normalization and semantic validation pipeline.
10. Routine authoring conflicts return 409 or 422 with code, path, details,
    request ID, and retryability. Only malformed wire input returns 400.
11. A chart/filter change changes ExplorerConfig only and cannot change recipe
    digest.
12. An unchanged authoring intent produces a deterministic canonical recipe
    digest.

## Implementation phases

### Phase 0: freeze the failure corpus and add observability

Before changing behavior:

1. Add redacted fixtures for every known failing request to a shared contract
   fixture directory. Include at minimum:
   - the stale `concept_c685bc...` root selection shown above;
   - nested Patient `conceptSelections` under Condition -> Observation ->
     Specimen -> Patient;
   - duplicate explicit semantic fields;
   - invalid selectors such as `root.https://...`;
   - root changes retaining Group expansion/identity;
   - dynamic selected subsets encountering an unselected extension URL;
   - candidate requests with old node paths;
   - select-none for every dataframe-producing family.
2. Record expected status, diagnostic code, field path, and next action for each
   fixture.
3. Ensure the frontend sends a request ID and intent digest; Gecko forwards it;
   Loom logs it with source generation, recipe digest, snapshot token digest,
   output, and node path.
4. Add counters for Builder candidate, compile, validate, and preview outcomes
   grouped by stable diagnostic code and stage.

Exit criterion: every known 400 can be replayed without the browser and traced
across all three services.

### Phase 1: specify the shared authoring contract

1. Write a short ADR in Loom defining:
   - the authoritative editable document;
   - snapshot-token semantics;
   - candidate identity lifetime;
   - native recipe compilation ownership;
   - semantic provenance versus executable declaration;
   - stale-selection behavior;
   - status-code taxonomy.
2. Add GraphQL schema types for the authoring catalog and compile mutation.
3. Generate or mirror TypeScript types from the GraphQL schema. Do not model
   these payloads as `Record<string, JSONValue>` in frontend feature code.
4. Version the intent schema independently from the executable recipe schema.
5. Decide where `ExplorerBuilderDocument` is persisted. Preferred ownership is
   Gecko because it already coordinates recipe and Explorer drafts. Persist it
   as one versioned builder draft, while continuing to persist Loom recipe and
   ExplorerConfig artifacts during Save.

Exit criterion: Loom, Gecko, and frontend compile against one documented set
of types, and no implementation relies on labels or inferred paths for
identity.

### Phase 2: build Loom's unified authoring catalog

1. Refactor the existing project map, semantic catalog, and recipe candidate
   queries behind a single service that operates on one pinned dataset
   generation and authorization scope.
2. Return all nodes in the selected output route in one response. Do not make
   the frontend assemble a cross-node catalog from independent requests.
3. Normalize every selectable source into a common candidate structure.
4. Include server-owned lowering data internally. Avoid exposing raw AST patch
   paths as the public client contract if the client does not need them.
5. Include `complete`, truncation reason, `maxColumns`, and blocking
   diagnostics per family and per node.
6. Include previously selected keys that are absent from the new generation as
   `stale: true`; keep their stable authored identity available for display.
7. Bind the response to an opaque snapshot token covering:
   - project;
   - source generation;
   - auth scope digest;
   - base recipe digest;
   - catalog/resolved-schema digest;
   - route identity.
8. Add deterministic sorting and pagination tests. Pagination must not change
   completeness or selection semantics.

Exit criterion: the frontend can render every checkbox for a complete route
from one response without querying the legacy semantic catalog directly.

### Phase 3: build Loom's intent compiler

1. Move row-root and route lowering from `GuidedBuilder.applyTable` into a Loom
   authoring compiler package.
2. Validate route-edge IDs against the pinned graph snapshot.
3. Root the output at `rowResourceType` and lower earlier visual nodes as
   supported context traversals using server-owned edge metadata.
4. Generate safe aliases and physical column names deterministically.
5. Apply candidate selections to their native recipe families:
   - `FIELD`: concrete `recipe.Field`;
   - `DYNAMIC`: native family with `columnMode: SELECTED` and exact keys;
   - `EXTENSION`: native extension mappings in selected mode;
   - `PIVOT`: native pivot declaration in selected mode;
   - `CATALOG_PROJECTION`: concrete resolved fields or an explicitly supported
     projection selection contract—never unsupported `columns` properties.
6. Preserve semantic provenance on native declarations without adding an
   executable `conceptSelections` duplicate.
7. Compile all selected nodes together so changing the inspected node cannot
   alter unrelated selections.
8. Return the canonical recipe plus emitted-column mapping.
9. Run the canonical recipe through exactly the same resolver used by
   validation, preview, and publication before returning success.
10. Add property tests: for every non-blocked advertised candidate, compiling
    an intent containing that candidate either succeeds or returns only a
    documented snapshot conflict—not a semantic 400.

Exit criterion: Loom can compile the complete example route and selections
without any browser-generated selector or traversal declaration.

### Phase 4: migrate legacy drafts on the server

Implement a typed migration from current project drafts to
`ExplorerBuilderDocumentV1` and canonical native recipes.

Migration rules:

1. If an output contains both an explicit concrete field and a matching
   `conceptSelections` entry, keep the concrete field, copy useful provenance,
   and remove the executable concept selection.
2. If an output contains only a valid `conceptSelections` entry, resolve it
   once against the pinned migration generation and convert it to a native
   declaration.
3. If a concept-only selection is stale, retain it as a stale intent selection
   and return a 422 migration diagnostic. Do not delete it or guess a selector.
4. Nested traversal `conceptSelections` cannot be trusted because Loom's typed
   schema never supported them. Preserve concrete nested fields and recover
   provenance only when an exact current candidate match exists.
5. Preserve existing native dynamic, pivot, extension, and projection family
   modes exactly.
6. Preserve ExplorerConfig table/filter/chart labels when their emitted column
   mapping remains exact.
7. Make migration idempotent and digest-stable.
8. Never mutate a published immutable revision. Migrate only editable project
   drafts or create a new draft derived from the old revision.

Expose migration as an explicit Loom/Gecko operation or as a server-side draft
load normalization result containing diagnostics. Do not reintroduce heuristic
`repairMalformedRecipe` behavior in the browser.

Exit criterion: loading and resaving an existing draft creates one canonical
representation per selected column and never silently loses selections.

### Phase 5: make Gecko the builder-draft coordinator

1. Add versioned persistence for `ExplorerBuilderDocument` or extend the
   existing builder draft record with this document.
2. Proxy the Loom authoring catalog and compile operations without rewriting
   their semantics.
3. Preserve snapshot token, generation, recipe digest, diagnostics, and request
   ID exactly.
4. Save flow:
   - persist builder intent draft;
   - compile intent through Loom;
   - persist canonical Loom recipe draft;
   - persist ExplorerConfig draft derived from emitted columns;
   - validate;
   - publish/materialize recipe;
   - publish ExplorerConfig pinned to the exact recipe revision;
   - activate immutable Explorer release.
5. If any digest/version changes during this sequence, stop with a typed 409.
6. Map Loom statuses by meaning:
   - 400 malformed/unsupported wire input only;
   - 409 snapshot, generation, digest, or draft conflict;
   - 422 actionable well-formed authoring/migration error;
   - 500 unclassified defect;
   - 503 actual service/dependency unavailability.

Exit criterion: Gecko never turns a well-formed Loom authoring diagnostic into
generic `INVALID_REQUEST`, `RECIPE_REQUEST_FAILED`, or 503.

### Phase 6: replace frontend construction with a reducer over intent

Break the large `GuidedBuilder.tsx` state machine into cohesive modules.

Recommended modules:

- `authoring/types.ts`: generated/shared intent and catalog types;
- `authoring/reducer.ts`: pure intent transitions;
- `authoring/catalog.ts`: request/cache keyed by snapshot identity;
- `authoring/compiler.ts`: API orchestration only, no AST generation;
- `authoring/presentation.ts`: emitted-column to ExplorerConfig mapping;
- `authoring/migration.ts`: consumes server migration results only;
- UI components for graph, compact column picker, and rendered Explorer.

Reducer actions should include:

- select output;
- choose visual start node;
- set final row node/route;
- select/deselect candidate at canonical node path;
- select all candidates in one family/node;
- clear selection without deleting stale identities;
- set display label;
- toggle filter;
- toggle pie chart.

Frontend rules:

1. Remove direct calls to `fetchSemanticConceptCatalog` from the integrated
   Builder after the unified catalog is available.
2. Remove `conceptSelectionsFor`, `semanticSelectionsFor`, selector synthesis,
   alias synthesis, traversal AST synthesis, and native-family patching from
   `GuidedBuilder`.
3. Remove `selectedNativeCandidates` after Loom compilation fully replaces it.
4. Retire `recipeRepair` after server migration/normalization is available.
5. Keep one canonical selection map keyed by `outputId + canonicalNodePath +
   candidateId`.
6. Cache the complete authoring catalog by snapshot token. Never merge catalogs
   with different tokens.
7. Keep previous successful UI data visible during refresh, but mark it stale
   and disable compilation until the new snapshot is reconciled.
8. Debounce compile/preview, cancel obsolete requests, and coalesce identical
   intent digests.
9. Apply compile responses only if their request intent digest still equals the
   current reducer state.
10. Build ExplorerConfig filters/charts solely from returned emitted column
    names and capability metadata.
11. Keep the current compact inline Filter/Chart controls. Do not reintroduce
    the discarded Advanced family UI during this refactor.

Exit criterion: searching frontend production code finds no construction of
`expr.select`, traversal aliases, `columnMode`, dynamic `columns`, pivot
declarations, extension mappings, or `conceptSelections` in the Builder.

### Phase 7: unify compile, preview, validation, and publication

1. Introduce one Loom internal pipeline:
   - validate snapshot token;
   - compile intent to canonical recipe;
   - structural recipe validation;
   - semantic/catalog resolution;
   - resolved-plan validation;
   - preview execution when requested;
   - publication/materialization when requested.
2. Candidate compilation and preview must use the same pinned generation.
3. Preview only the selected active output. Full Save validates every intended
   output deliberately.
4. Return canonical recipe digest and resolved-schema digest from compilation,
   preview, and publication so cross-stage equality can be asserted.
5. Prevent publication if catalog completeness is false, discovery is
   truncated, or a selected candidate is stale.

Exit criterion: the exact recipe digest compiled for the preview is the digest
saved and published unless the user changes intent.

### Phase 8: remove legacy paths

After migration telemetry shows no active dependency:

1. Stop emitting new `conceptSelections` from the integrated Builder.
2. Mark direct semantic concept lowering as legacy-only in Loom.
3. Remove the Builder's legacy semantic fallback UI. If unified catalog loading
   fails, retain prior data with an unavailable state rather than switching
   protocols.
4. Remove cross-generation candidate merging.
5. Remove browser recipe repair and AST-generation helpers.
6. Retain read compatibility for immutable legacy revisions.

Exit criterion: one authoring protocol remains in production code.

## Test plan

### Loom unit and property tests

- Candidate IDs are deterministic within a snapshot and rejected across
  snapshots.
- Every candidate kind compiles to the expected native declaration.
- Select-none, select-one, select-all, and stale selections at root and nested
  nodes.
- Final-node row root with Patient context and downstream Condition,
  Observation, Specimen, and DocumentReference routes.
- Repeated resource types/aliases in one route.
- Semantic provenance does not produce a second executable field.
- Migration of duplicate field plus `conceptSelections` is idempotent.
- Concept-only stale migration returns a path-specific 422.
- Incomplete/truncated catalogs block compile/publication.
- Fuzz intent and recipe input; malformed input may return 400 but must never
  panic or return an unclassified 5xx.

### Gecko contract tests

- Snapshot token and diagnostics are preserved byte-for-byte where possible.
- 409/422 statuses survive GraphQL HTTP-200 error envelopes.
- Compile output recipe digest is the digest saved and passed to publication.
- Concurrent draft/snapshot changes stop Save with 409.
- Builder draft, recipe draft, and ExplorerConfig draft cannot be published in
  mismatched versions.

### Frontend reducer tests

- Selecting one checkbox changes one intent entry and leaves every other node
  unchanged.
- Selecting Filter or Chart changes ExplorerConfig intent only.
- Catalog refresh with the same token updates metadata without resetting
  selection.
- A different token never merges candidates; old selections become stale until
  reconciled.
- Late compile/preview responses cannot overwrite newer intent.
- Select all followed by clear produces an explicit empty selected set.
- Route changes retain selections for nodes still in the route and preserve
  removed-node intent as stale/recoverable according to product rules.

### End-to-end contract fixtures

For every fixture, run:

```text
authoring catalog -> compile intent -> validate recipe -> preview -> save draft
-> publish/materialize -> publish ExplorerConfig -> activate release
```

Assert either complete success or an allow-listed typed 409/422. No known
fixture may return 400, 500, or 503.

Required scenarios:

- exact stale `concept_c685bc...` failure;
- nested Patient selections on Condition-rooted rows;
- filters and pie charts on eligible emitted columns;
- chart requested for a non-aggregatable column returns a local capability
  rejection and does not touch recipe preview;
- ingestion occurs between catalog fetch and compile;
- auth scope changes between catalog fetch and compile;
- selected dynamic key disappears or a new sibling key appears;
- duplicate labels with distinct candidate identities;
- empty selected family;
- legacy draft containing multiple outputs, one invalid and one active;
- reload after Save with both Continue editing and immutable release links.

## CI gates

Add cross-repository fixture versioning so Loom, Gecko, and frontend test the
same contract corpus.

Required gates:

1. Generated/shared schema types are current.
2. Every non-blocked advertised candidate compiles against its snapshot.
3. Every fixture returns success or an allow-listed 409/422 diagnostic.
4. No Builder contract fixture returns 400, 500, or 503.
5. No frontend Builder module synthesizes recipe AST properties. Enforce with a
   focused lint/architecture test for forbidden keys/imports.
6. Preview, save, and publish recipe digests match for unchanged intent.
7. Full Go tests, TypeScript compilation, focused Jest tests, and contract
   replay pass before deployment.

## Rollout sequence

1. Deploy Loom authoring catalog/compiler and legacy migration behind a feature
   flag. Keep existing APIs temporarily.
2. Deploy Gecko builder-document persistence and proxy support.
3. Run shadow compilation for current drafts: compile new intent alongside the
   old recipe without changing user-visible behavior. Compare emitted columns,
   row counts, and diagnostics.
4. Review mismatches and add explicit migration fixtures; do not add browser
   heuristics.
5. Enable the new frontend authoring reducer for a canary project.
6. Monitor statuses by stage and contract version. A 400 from a well-formed
   Builder request is a release-blocking defect.
7. Expand canary after preview/save/publish digest equality and column equality
   are stable.
8. Disable old Builder recipe construction.
9. Remove legacy write paths after an observation window; retain immutable
   revision read compatibility.

Use unique reversible image tags. Roll Loom first, Gecko second, and frontend
last. Verify readiness and live contract replay after each rollout. Roll back
the current layer immediately if it increases unclassified failures or changes
emitted dataframe columns unexpectedly.

## Implementation order for the executing agent

Execute in these slices; each slice should leave tests passing:

1. Add ADR, shared fixture corpus, request correlation, and status taxonomy
   tests.
2. Add Loom snapshot-bound unified authoring catalog for all nodes in one
   route.
3. Add Loom intent compiler and emitted-column mapping.
4. Add server-side legacy migration and exact stale-concept regression.
5. Add Gecko proxy/persistence and save-orchestration contract.
6. Add frontend typed authoring reducer and catalog client behind a feature
   flag.
7. Replace `GuidedBuilder.applyTable` recipe construction with compile calls.
8. Bind ExplorerConfig filters/charts to emitted compiler columns.
9. Run shadow comparison and migrate existing drafts.
10. Enable the new path, then remove legacy frontend authoring code.

Do not begin by deleting legacy code. First make the new path complete and
shadow-verifiable, then switch traffic, then remove the old path.

## Definition of done

The refactor is complete only when all of the following are true:

- The integrated Builder uses one typed authoring catalog and one candidate ID
  system for every node and column family.
- Loom, not React, compiles row roots, routes, selectors, aliases, fields,
  dynamic families, extensions, projections, and pivots.
- New Builder drafts contain no executable `conceptSelections` duplicates.
- Nested selections are represented by the supported canonical intent schema.
- Candidate and preview operations are bound to the same immutable snapshot.
- Filters and pie charts are presentation-only and use emitted column names.
- Existing drafts migrate without silent column loss.
- The known invalid-request corpus produces no 400, 500, or 503.
- Save publishes and activates an Explorer pinned to the exact canonical recipe
  revision previewed by the user.
- Frontend production code contains no fallback path that changes authoring
  protocol when a request fails.

