# Project Explorer

The Explorer displays published metadata through Loom. Loom applies Gen3 authorization and queries the active ClickHouse publication; the browser has no database credentials. Publish selected META NDJSON files from the project Source tab, then open Explorer.

Explorer Builder is disabled by default for this release. Its direct route returns 404 and the viewer hides its Builder link. Existing Builder code remains available for a later release. To opt into authoring in a development deployment, set `NEXT_PUBLIC_GEN3_EXPLORER_BUILDER_ENABLED=true` before starting Next.js or building its image. The Docker build supports the same build argument. This flag controls UI availability; Loom still enforces authorization.
