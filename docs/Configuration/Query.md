# Query configuration

Query configuration uses version 2 endpoint and mode records. The page loads
the configured service, fetches its GraphQL schema, and uses the selected mode
to provide its default query and variables.

```json
{
  "version": 2,
  "endpoints": {
    "loomGraph": {
      "url": "/loom/graphql/graph",
      "service": "loom",
      "surface": "graph"
    },
    "loomFlat": {
      "url": "/loom/graphql/flat",
      "service": "loom",
      "surface": "flat"
    }
  },
  "modes": [
    {
      "id": "loom-fhir-graph",
      "label": "Loom Graph",
      "endpoint": "loomGraph",
      "preset": "loom-fhir-graph"
    },
    {
      "id": "loom-fhir-dataframe",
      "label": "Loom Dataframe",
      "endpoint": "loomGraph",
      "preset": "loom-fhir-dataframe"
    },
    {
      "id": "loom-flat",
      "label": "Loom Flat",
      "endpoint": "loomFlat",
      "preset": "loom-flat"
    }
  ],
  "defaultMode": "loom-flat"
}
```

Supported services and presets are:

- `loom-fhir-graph`: binds the selected `PROGRAM-PROJECT` to `input.project`.
- `loom-fhir-dataframe`: binds the selected `PROGRAM-PROJECT` to `input.project`.
- `loom-flat`: adds a `project_id EQ PROGRAM-PROJECT` filter to the flat input.
- `guppy-flat`: adds `auth_resource_path` using `/programs/PROGRAM/projects/PROJECT`.
- `generic`: executes the configured query without automatic project binding.

The Query page reads the canonical project selector from `project_id`. The
legacy `project` query parameter is accepted once and rewritten to
`project_id`. Accessible projects come from Gecko, and the Run button is
disabled when a project-bound mode has no valid accessible project selected.

Endpoint URLs may be absolute HTTP/HTTPS URLs or root-relative paths. URLs
with credentials, fragments, protocol-relative syntax, or unsafe schemes are
rejected. Loom graph and flat endpoints must use their matching GraphQL path.

Older configurations containing only `graphQLEndpoint` are normalized locally
for compatibility. New configuration should use version 2.
