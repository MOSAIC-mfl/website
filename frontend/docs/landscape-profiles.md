# Landscape pages and the map explorer

A landscape page (`src/pages/landscapes/[slug].astro`, one per code in `data/landscapes.json`) is
built at compile time with the site header, breadcrumb and title. Its content is read from mosaic-api
when the page opens (`GET /v1/landscapes/{code}`), so a new or changed profile needs no rebuild.

```
LandscapePage (container)         features/landscape/LandscapePage.tsx
  intro (summary, status)  ·  section navigation (sticky)
  for each section of the profile:  sectionModule(kind)  ->  React component
      overview             features/landscape/sections/Overview.tsx
      map-explorer         features/landscape/sections/MapExplorer.tsx  ->  ExplorerApp (lazy: MapLibre is only loaded here)
      catalogue-datasets   features/landscape/sections/Datasets.tsx     (the catalogue's DatasetCard)
      data-status          features/landscape/sections/DataStatus.tsx   (gap analysis)
```

## The map explorer

It is the Lake Victoria Basin Explorer (Andrés Aguilar, anaguilarar/mosaic-lake-victoria @ 0d22fe2)
rebuilt so that any profile can use it: what was in its JavaScript is now configuration
(`explorer.yaml` in mosaic-catalog) and modules chosen by `kind`. Its look is kept: the layout, the
rail, the panels, the time bar, the legends, the story drawer and the data palettes; its CSS is ported
in `src/styles/explorer.css` (scoped under `.lvx`) with the site's MOSAIC tokens. Under the site
header it gets a slim bar with its title and the "Uses & studies" button.

```
features/explorer/
  domain/          pure rules, tested: config (parse + types), assets (where each file is served),
                   legend, color ramps, geo (UTM, point in polygon), series, hash (shareable state),
                   blocks (what panels show, as data), options (typed reads of module options)
  ports/           MapEngine (the map), DataSource (files: JSON, byte ranges, COG windows, grids)
  adapters/        maplibre/engine.ts (MapLibre 6 + PMTiles; lazy layers; swipe comparison),
                   data.ts (HTTP + geotiff)
  renderers/       one class per kind of overlay, all with the same interface (OverlayRenderer):
                   raster-tiles, year-tiles, climate-grid, index-grid; registry.ts maps kind -> class
  inspectors/      what a click shows: cell-sum, class-at-point, annual-series, region-series
  panels/          side panels: series-summary (the lake level panel)
  application/     ExplorerController (the only place that changes what the map shows),
                   chart builders for story charts, a small store
  charts/          the explorer's own SVG charts, vendored (svg-charts.js, typed in svg-charts.d.ts)
  ui/              React components (container ExplorerApp, Rail, Legend, TimeBar, Popover,
                   SidePanel, Blocks, StoryDrawer, AboutPanel)
  plugins.ts       profile plugins, loaded only on their landscape page
profiles/ken-lvb/  Lake Victoria plugin: the flood click (its query raster's codes)
```

**Rules that keep it extensible.**

- Components never import MapLibre or geotiff; they talk to the controller, which talks to ports.
- A renderer owns its layers and returns models (legend, time bar, click result). Nothing writes HTML
  strings: panels are `Block`s drawn by `ui/Blocks.tsx`.
- One state, in the controller's store: the active overlay, its time and variant, which floating
  panel is open (one at a time), the story chapter. No `window.*` hooks.
- What changes per profile is configuration. New behaviour is a new module registered by kind.

## Adding things

| To add | Where | Then |
|---|---|---|
| A landscape page with the standard sections | nothing (every landscape has one) | — |
| A curated page | mosaic-catalog `landscapes/<CODE>/profile.yaml` | `validate-landscapes` |
| A map explorer like Lake Victoria for other data | `explorer.yaml` with the same kinds | — |
| A new kind of section | a component in `features/landscape/sections/`, registered in `registry.ts` | name it in the profile |
| A new kind of layer | a class implementing `OverlayRenderer` in `features/explorer/renderers/`, registered in `coreRegistry()` | `kind:` on the overlay |
| A click on a data format of one profile | `src/profiles/<code>/index.ts` (a `ProfilePlugin`), listed in `features/explorer/plugins.ts` | `inspect: {kind: ...}` |
| A story chart from a series | a `ChartBuilder` in `application/chart-builders.ts` or in a plugin | `charts: [{builder: ...}]` |

## Data locally

The explorer reads its files where the profile says (`data.roots`, `data.routes`). To work offline,
put the files in `<folder>/<CODE>/` and set `PUBLIC_MOSAIC_PROFILE_DATA` (see `.env.example`); files
the profile marks `withheld` are never requested, from anywhere.
