# Site Map

The IDP Data Platform provides an interactive infographic site map that gives a visual overview of all available pages and features. The diagram is accessible at `/SiteMap` once the application is running.

## Overview

The site map page renders a hierarchical, color-coded diagram using [React Flow](https://reactflow.dev/). It is organized into six functional sections, each visually connected to the root platform node.

![IDP Data Platform – Site Map](images/site-map.png)

## Sections

| Section | Accent Color | Pages |
|---------|-------------|-------|
| **Discovery** | Teal `#0d95A1` | Discovery |
| **Data** | Blue `#255990` | Data Library, Data Dictionary, Crosswalk, File Summary |
| **Analysis & Tools** | Crimson `#892115` | Analysis, Explorer, Query, Configurator, Workspace |
| **Apps & Notebooks** | Indigo `#474787` | Apps, AI Search, CALYPR, Miller, Notebook Lite, Cohort Builder, SMMART |
| **User & Profile** | Slate `#5b5b7a` | Profile, My Projects |
| **Administration** | Orange `#b75113` | Workspace Mgmt, Authorization, Analysis Admin |

## Navigation

The site map is reachable from the top navigation bar via the **Site Map** menu item, or by navigating directly to `/SiteMap`.

## Interaction

- **Click** any page node to navigate directly to that page.
- **Scroll / pinch** to zoom in and out.
- **Drag** the canvas to pan around the diagram.
- Use the **Controls** panel (bottom-left) to zoom to fit, zoom in, or zoom out.

## Implementation

The site map is implemented as a Next.js server-side-rendered page in `packages/sampleCommons/src/pages/SiteMap.tsx`. It uses the `@xyflow/react` library (already a project dependency) with three custom node types:

- **`RootNode`** – The platform root node (dark purple).
- **`CategoryNode`** – Section headers with color-coded left-border accents.
- **`PageNode`** – Individual clickable page cards that link to their respective routes.
