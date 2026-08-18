# Builder-to-Loom Reliability Plan

## Objective

Make this an enforced system invariant:

> Every request the Explorer Builder can produce either succeeds or returns a
> stable, actionable, non-5xx authoring diagnostic. A 503 is reserved for an
> actually unavailable dependency, never an invalid recipe or dataframe shape.

The work spans the Frontend, Gecko, and Loom. Fixing only the frontend would
hide backend contract defects; making Loom permissive without defining the
authoring semantics would silently produce incorrect dataframes.

## Confirmed failure chain

The current `patient__extension_by_url` failure is not a Loom outage:

1. Loom resolves a dynamic-map key set from the field catalog.
2. The dataframe query observes the additional runtime key
   `http://hl7.org/fhir/us/core/StructureDefinition-us-core-birthsex`.
3. Post-query validation rejects that key as `DynamicDriftError`.
4. Recipe preview does not classify that typed error, so GraphQL changes it to
   `INTERNAL_ERROR` and returns 500.
5. Gecko converts the upstream 500 to 503.
6. The Builder therefore reports infrastructure failure for a deterministic
   authoring/catalog conflict.

The implementation also contains a deeper contract ambiguity:

- A dynamic family's `columns` field represents both a catalog-discovered
  complete key set and an explicitly selected subset.
- Loom's transient `Discovered` flag is excluded from JSON, so that distinction
  is lost between requests and persisted revisions.
- The Builder writes exact user selections into `columns`. Loom then interprets
  every unselected runtime sibling as schema drift.
- Typed `extensionColumns` already allow unknown sibling extensions, while a
  generic `dynamicColumns` family over `extension[].url` does not. Equivalent
  data therefore receives incompatible treatment depending on declaration
  family.
- The field-catalog model exposes `distinct_truncated`, but the profiler never
  sets it. The resolver can therefore claim completeness without a reliable
  completeness signal.

## Known invalid-request corpus

The replay suite must begin with every failure already observed in the Builder:

| Failure | Current result | Owning prevention layer |
| --- | --- | --- |
| Frontend-only `columnMode` sent to Loom | 400 | Shared schema / Frontend serialization |
| Unsupported `columns` on a catalog projection | 400 | Shared schema / Frontend serialization |
| Duplicate field names in one node | 400 | Loom semantic validation, then local feedback |
| Selector such as `root.https://...` | 400 | Loom selector validation, then local feedback |
| Root changed while retaining old `expand`, identity, or families | 400 | Loom root compatibility validation and Builder state transition |
| Invalid unrelated output included with active preview | 400 | Active-output request scoping |
| Traversal path does not match the lowered recipe tree | 400 | Loom path validation and Builder route lowering |
| Explicit dynamic subset sees an unselected sibling key | 500 -> 503 | Persisted family-mode contract |
| Discovery key set is incomplete or stale | 500 -> 503 | Catalog snapshot/completeness and drift classification |
| Repeated identical automatic preview after failure | 400/503 flood | Frontend coalescing and retry policy |

Each fixture must preserve the original request, expected normalized response,
and request/correlation identifiers. Redact data values and credentials; retain
schema metadata needed to reproduce the failure.

## Phase 0: make failures reproducible and attributable

- Add a cross-service correlation envelope: Frontend request id, Gecko request
  id, Loom request id, normalized recipe digest, active output, and node path.
- Log the exact immutable inputs used by discovery and execution: project,
  dataset generation, authorization-scope digest, recipe revision/digest, and
  resolved-schema digest.
- Log family name, family mode, configured key count, discovered key count,
  completeness/truncation state, and a safe representation of an unexpected
  key. Do not log dataframe values.
- Build a command-line replay harness against Loom's parse, resolve, validate,
  and preview stages. Load the failure corpus as table-driven fixtures.
- Add stage timings and a terminal classification (`parse`, `semantic`,
  `catalog`, `compile`, `execute`, `postquery`) so "the request is invalid" is
  never the only evidence.

Exit criterion: a production request id identifies the exact failing stage and
can be replayed locally without the browser.

## Phase 1: define one durable dynamic-family contract

Add a persisted, versioned key policy to Loom's recipe schema. The exact wire
name can be finalized with the schema migration, but it must express these two
semantics:

- `DISCOVER_ALL`: Loom discovers the complete key set for the pinned dataset
  snapshot. Publication is blocked if completeness cannot be proven, discovery
  is truncated, or runtime keys disagree with that snapshot.
- `SELECTED`: `columns` is an authoritative projection subset. Other runtime
  keys are valid siblings and are ignored; selected keys that are unavailable
  are reported as stale, not deleted.

Required behavior:

- The policy survives draft save/load, revision publication, and materialized
  execution. Do not depend on a `json:"-"` field for semantics.
- Empty `SELECTED` means emit zero columns. It must not reactivate discovery.
- Legacy recipes that omit the policy retain their documented legacy behavior.
- Dynamic maps, typed extension families, pivots, and catalog projections use
  the same vocabulary for selected subset versus complete discovery.
- Loom owns wire-schema validation. The Frontend must not invent or strip
  undocumented fields to make requests pass.

Exit criterion: select-none, select-one, and select-all remain stable when new
FHIR keys appear, while `DISCOVER_ALL` reliably blocks incomplete publication.

## Phase 2: prove catalog and execution use the same snapshot

- For the failing Patient extension family, compare catalog distinct URLs with
  a direct distinct-key query over the exact project, generation, and effective
  authorization scope used by preview.
- Audit ingestion coverage, profiler merge behavior, cache invalidation, and
  generation activation. Verify that every executing document is represented
  by the catalog snapshot used to resolve it.
- Replace the currently ineffective truncation flag with explicit accounting:
  observed distinct count, returned count, configured bound, and
  `complete: true|false` with a reason.
- Make catalog snapshots immutable and addressable. Resolution and execution
  must pin the same dataset/catalog generation; a generation switch during a
  request must yield a typed conflict.
- Add a pre-execution anti-join/check for `DISCOVER_ALL` families so drift is
  diagnosed before building a large result, with the family path and counts.
- Invalidate caches by project and generation after successful ingestion and
  activation, and test stale-cache behavior explicitly.

Exit criterion: Loom can explain why a key is included, excluded, stale, or a
blocking drift using snapshot identity and completeness evidence.

## Phase 3: unify validation, preview, and publication

Create one pipeline used by all three operations:

1. Strict JSON/wire-schema parse.
2. Version/capability negotiation.
3. Structural validation.
4. Semantic and root-scope validation.
5. Catalog resolution against a pinned snapshot.
6. Resolved-plan validation.
7. Execution/post-query validation when the operation requires it.

Specific safeguards:

- Preview and candidate discovery validate only the requested active output,
  while draft publication validates the complete bundle intentionally.
- Reject duplicate names, invalid selectors, incompatible root declarations,
  impossible traversal paths, unsupported family properties, and ambiguous
  legacy modes with exact JSON paths.
- Return the normalized recipe or a server-generated patch/capability response
  where normalization is supported. Remove guess-based frontend repair once
  the server contract is available.
- Ensure a recipe cannot pass `validate` and then fail deterministic semantic
  or schema checks in `preview` without a classified diagnostic.

Exit criterion: the same recipe and snapshot receive compatible decisions and
diagnostics from candidates, validate, preview, and publish.

## Phase 4: repair the error taxonomy end to end

Use status codes by meaning:

- **400**: malformed JSON, GraphQL variables, or unsupported wire schema.
- **409**: dataset generation, catalog snapshot, recipe revision, or dynamic
  schema conflict that may succeed after the conflicting state changes.
- **422**: well-formed recipe with actionable authoring/semantic errors.
- **500**: an actual unclassified Loom defect, with an internal cause retained
  in logs.
- **503**: Loom or a required dependency is genuinely unavailable or timed out.

Immediate mappings:

- Map `DynamicDriftError` to the existing `DYNAMIC_SCHEMA_DRIFT` code with
  output, node/family path, expected/observed counts, unexpected keys, dataset
  generation, and retryability.
- Add that code to Loom's HTTP normalization/status mapping.
- Preserve GraphQL `code`, `fieldPath`, `details`, `requestId`, and `retryable`
  through Gecko without replacing them with `RECIPE_REQUEST_FAILED`.
- Remove legacy UI text referring to nonexistent retry controls. Retryability
  must come from the diagnostic, not a generic message.

Exit criterion: no known corpus fixture returns 500 or 503, and every response
identifies the failing recipe location and next corrective action.

## Phase 5: make the Builder a contract client, not a recipe repair engine

- Generate or share TypeScript request types from Loom's versioned authoring
  schema and expose supported capabilities through Gecko.
- Serialize only the active output for candidate/preview requests and the full
  bundle only for full-draft validation/publication.
- Keep one request per recipe digest: debounce changes, cancel stale work,
  coalesce identical in-flight requests, and do not automatically retry an
  unchanged deterministic failure.
- Treat checkbox state as durable authoring state independent from the latest
  candidate response. Refreshing candidates must not erase selections, filter
  settings, or chart settings.
- Keep the compact UI. Family policy may be represented internally without
  reintroducing confusing advanced controls until a clear product interaction
  is designed.

Exit criterion: a Builder-generated payload is schema-valid by construction,
and backend validation remains the authoritative safety boundary.

## Phase 6: adversarial verification and CI gates

Add cross-repository contract fixtures and tests for:

- Every request in the known invalid-request corpus.
- Dynamic families with zero, one, all, stale, new, and truncated keys.
- FHIR extension URLs absent from and newly added to a prior catalog snapshot.
- Root changes that previously retained Group expansion or invalid selectors.
- Nested and reversed traversal routes with selections at every node.
- Restricted, unrestricted, and restricted-empty authorization scopes.
- Catalog cache staleness, ingestion completion, and generation activation
  races.
- Large-cardinality families at, below, and above configured bounds.
- Property/fuzz tests for recipe parsing and semantic validation: arbitrary
  input must never panic or yield an unclassified 5xx.
- Differential tests asserting discovery's resolved keys equal direct runtime
  keys for the same immutable snapshot.
- Chaos tests proving only real dependency outage/timeout paths return 503.

CI gate:

> For every builder contract fixture, candidates, validation, preview, and
> publication either succeed or return an allow-listed non-5xx diagnostic with
> a code and path. Any unclassified 500/503 fails the build.

## Phase 7: rollout order

1. Ship Loom telemetry, typed drift errors, and non-5xx mappings.
2. Ship Gecko diagnostic preservation and correlation propagation.
3. Ship the persisted family key policy with legacy compatibility and migration
   tests.
4. Ship the Builder's generated/shared schema client and remove temporary
   repair heuristics.
5. Run shadow validation on saved drafts and report incompatibilities without
   blocking.
6. Canary Loom, then Gecko, then the Frontend; monitor errors by stage and code.
7. Re-save or explicitly migrate affected drafts only after shadow results are
   reviewed. Retain rollback compatibility for the previous recipe version.

## First implementation slice

The first slice should be deliberately narrow and deployable:

1. Classify `DynamicDriftError` as `DYNAMIC_SCHEMA_DRIFT` (409) in Loom preview.
2. Preserve its structured details through Gecko.
3. Add the exact `birthsex` request as a redacted replay regression.
4. Add the persisted `SELECTED` versus `DISCOVER_ALL` schema field and tests.
5. Make selected dynamic families ignore unselected sibling keys.
6. Make discovery families require an explicit, trustworthy completeness
   result before preview/publication.

This converts the present 503 into a useful diagnosis immediately, then fixes
the semantic contradiction that caused it rather than merely suppressing the
error.
