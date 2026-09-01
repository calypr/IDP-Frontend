# Sample Commons

`@gen3/samplecommons` is the small Next.js host used to exercise and demonstrate
the Gen3 core and frontend packages. It supplies the application shell, tenant
theme assets, API routes, and example page composition; reusable UI and state
remain in `@gen3/frontend` and `@gen3/core`.

## Development

From the repository root:

```bash
npm install
NEXT_PUBLIC_GEN3_COMMONS_NAME=gen3 npm run dev:app
```

The application defaults to the `gen3` tenant. Set
`NEXT_PUBLIC_GEN3_COMMONS_NAME` to another checked-in tenant directory under
`packages/sampleCommons/config` to preview its theme and settings. Open
`http://localhost:3000` after the dev server starts.

Useful package scripts include:

- `npm run dev` — run this Next.js host with Turbopack.
- `npm run build` — create the production Next.js build.
- `npm run build:colors` — generate shifted theme colors for the selected tenant.
- `npm run build:icons` — bundle configured Iconify assets.
- `npm run getSchema` — regenerate configuration schema output.
- `npm run getDRSToHostname` — regenerate DRS hostname mappings.

Explorer navigation is supplied by the runtime Gecko configuration and Explorer
data is loaded from Loom. Tenant directories therefore contain only the assets
that are still consumed by the application (theme, page, service, and icon
configuration).
