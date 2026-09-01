# Explorer read-path inventory

The Explorer configuration still uses its established `guppyConfig.dataType`
values. The adapter boundary is `packages/core/src/features/loom/mapping.ts`;
all requests below use the canonical value returned by `toLoomDataType`.

| Explorer surface | Previous request | Loom request | Existing consumer shape |
| --- | --- | --- | --- |
| `pages/Explorer/data.ts` shared-field discovery | Guppy `_mapping` | `dataframeDataset` column metadata | `SharedFieldMapping` |
| `CohortPanel` facets | Guppy grouped aggregations | `dataframeAggregate` COUNT by field | `AggregationsData` |
| `CohortPanel` total | Guppy count aggregation | `dataframeAggregate` COUNT | `number` |
| `ExplorerTable` rows | Guppy offset rows/count | `dataframeRows` with opaque cursor | `JSONObject[]`, row count |
| `QueryRowDetailsPanel` | Guppy single-row query | `dataframeRows` with an ID filter | one `JSONObject` |
| download actions | Guppy download endpoint | Loom dataframe export | JSON/CSV/TSV blob or JSON rows |

The canonical mapping is:

- `file` and `document_reference` -> `DocumentReference`
- `research_subject` -> `ResearchSubject`
- `specimen` -> `Specimen`
- `medication_administration` -> `MedicationAdministration`
- `group_member` -> `GroupMember`

Loom metadata is also the availability boundary. Explorer distinguishes an
unsupported type, transport/authorization failure, missing dataset, a
non-`READY` dataset, and a `READY` dataset with zero rows. There is no Guppy
runtime fallback.
