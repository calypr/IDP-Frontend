# Recipe Builder Authorship and Save Flow

## Delivered behavior

- **Save** is the sole lifecycle action. It persists the project recipe and
  Explorer drafts, validates the recipe, materializes its revision, validates
  and publishes the Explorer configuration pinned to that recipe revision,
  then activates the release.
- Progress is reported as saving, validating, materializing, publishing the
  Explorer, and activating. Failures retain the API diagnostics.
- Publication requires Gecko's non-empty `authoringDigest`. The builder
  refreshes the saved recipe when necessary and reports an
  `AUTHORING_DIGEST_MISSING` diagnostic locally instead of sending an invalid
  publish request.
- Success returns the editable builder link and the immutable activated
  Explorer link.

## Recipe-family authoring

- The normal picker remains focused on individual usable columns, including
  pivot candidates.
- Advanced per-family discovery and pivot configuration is deliberately
  deferred. It needs a purpose-built pivot interaction that communicates the
  resulting table shape; generic `AUTO`/`SELECTED` mode controls were removed
  from the builder rather than exposing that implementation detail.
- Incomplete discovery, catalog truncation, and `maxColumns` diagnostics are
  surfaced as publication-blocking conditions. Repeated-value families warn
  where their configured value policy can reduce values.
- Selections are intentionally retained across re-ingestion. Candidate
  diagnostics identify stale/unavailable keys rather than silently deleting
  them.

## Product direction: integrated Explorer authorship

This builder replaces the narrow Configurator handoff with one authoring unit:
the Loom dataframe recipe and the ExplorerConfig that is validated, published,
and activated against its exact recipe revision. The UI must not imply that
these can drift independently.

### Explorer presentation controls

For each emitted dataframe column, the builder stores one display name and
allows the steward to independently add it as an Explorer filter and/or chart.
The display name becomes the table header, filter label, and chart title.
Charts are deliberately limited to Pie charts for now. Re-rendering a table
retains these controls for columns that still exist and removes references to
columns that no longer do. **Render Explorer** shows those configured filters
and charts alongside the existing in-memory table sample; applying a preview
filter updates the displayed rows and preview charts together.

### Final-node row grain

The desired FHIR workflow starts from patient context and follows references
downstream, while the *last selected resource* defines the dataframe rows
(for example, files rather than patients). Loom already supports generated
reverse/inbound FHIR routes: the builder keeps the visual patient-to-file
path, roots the generated recipe at its final node, and lowers earlier nodes
as context traversals. `rowGrain` remains descriptive; `rootResourceType`
controls the actual emitted rows.

### Frontend/Loom request boundary

- Preview and column-candidate requests send only the active output. An
  invalid legacy table elsewhere in the project draft must not poison the
  table currently being edited.
- One recipe digest produces at most one automatic preview request. Failed
  digests remain coalesced until the recipe changes or the steward explicitly
  retries.
- Changing `rootResourceType` clears every declaration scoped to the former
  root (`expand`, `identity`, fields, filters, traversals, pivots, aggregates,
  slices, dynamic maps, extensions, and catalog projections). In particular,
  a Group-member expansion must never survive a change to Condition rows.
- Loom should return stable validation code/path/details in GraphQL error
  extensions, and Gecko must preserve those extensions as builder diagnostics
  instead of reducing them to `RECIPE_REQUEST_FAILED`.
- Column checkboxes remain interactive for every inspected populated dataset.
  Selecting a reachable downstream concept automatically adds the shortest
  directed multi-hop route; disconnected selections remain selected so the
  dataset can be promoted to a new row root instead of presenting dead-looking
  controls.

## Compatibility commitments

- Untouched platform-default recipes remain in their existing discovery mode.
- Only the project draft/family that a steward edits is converted to selected
  mode.
- Nested controls lower into the selected traversal node's native recipe
  declarations.
- Explorer releases remain immutable and editing remains update-authorized.

## Verification checklist

- Save a changed draft, reload both returned links, and confirm the published
  Explorer is pinned to the returned recipe revision.
- Confirm an empty digest shows `AUTHORING_DIGEST_MISSING` without a Gecko 400.
- Exercise root and nested family select-one/select-all/select-none paths.
- Confirm a partial candidate response blocks publication and legacy recipes
  without `columnMode` still materialize unchanged.
- Confirm changing a GroupMember table to Condition rows does not retain
  `root.member[]`, and one checkbox interaction emits no more than one preview.
