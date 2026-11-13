# Landscapes and the map explorer

The Landscapes page (`/landscapes`, Lizeth's explorer in `components/landscapes/`) shows every living
landscape: selector, photos, locator map, key insights and a section menu. Its catalogue figures and
which landscapes have a map profile are read from mosaic-api when the page opens
(`GET /v1/landscapes`, `GET /v1/landscapes/{code}`), so a new dataset or profile needs no rebuild.

**Map visualization** appears in the section menu only for a landscape whose profile has a
`map-explorer` section (today KEN-LVB and PER-PCL). It shows the profile - map, story, studies:

```
/landscapes#KEN-LVB/map     explorer panel  ->  ProfileMapPanel (React island, client:idle)
/landscapes/ken-lvb/map/    full screen     ->  ProfileMap
                                              -> GET /v1/landscapes/{code} -> map-explorer section
                                              -> MapExplorer -> ExplorerApp (lazy: MapLibre loads here)
```

Both are kept while the team chooses one. The explorer's controller tells the island which
landscape to show (`lx:map-code` event); closing the panel unmounts the map.

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
                   raster-tiles, year-tiles, climate-grid, index-grid, style-layers (the overlay's own
                   MapLibre sources and layers: vectors, points); registry.ts maps kind -> class
  inspectors/      what a click shows: cell-sum, class-at-point, annual-series, region-series (core.ts);
                   feature-attributes, value-at-point, series-values, combined (attributes.ts)
  panels/          side panels: series-summary (the lake level panel)
  application/     ExplorerController (the only place that changes what the map shows),
                   chart builders for story charts, a small store
  charts/          the explorer's own SVG charts, vendored (svg-charts.js, typed in svg-charts.d.ts)
  ui/              React components (container ExplorerApp, Rail, Legend, TimeBar, Popover,
                   SidePanel, Blocks, StoryDrawer, AboutPanel)
  plugins.ts       profile plugins, loaded only with their profile
profiles/ken-lvb/  Lake Victoria plugin: the flood click (its query raster's codes)
```

The Ucayali profile (PER-PCL) needs no plugin: its vector layers, clicks and class charts are core
modules (`style-layers`, `feature-attributes`, `value-at-point`, `series-values`, `combined`,
`class-bars`), and story `steps` with `layer`, `time`, `focus` and camera `bounds` are part of the
story drawer.

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
| A landscape in the explorer | the site's `data/landscapes.json` (+ geometry, photos, texts in `data/`) | — |
| A map profile ("Map visualization") | mosaic-catalog `landscapes/<CODE>/profile.yaml` with a `map-explorer` section and its `explorer.yaml` | `validate-landscapes` |
| A map explorer like Lake Victoria for other data | `explorer.yaml` with the same kinds | — |
| A new section of the Landscapes page | `sectionList` in `LandscapeExplorer.astro` and its panel; data from the API through `ExplorerData` | — |
| A new kind of layer | a class implementing `OverlayRenderer` in `features/explorer/renderers/`, registered in `coreRegistry()` | `kind:` on the overlay |
| A click on a data format of one profile | `src/profiles/<code>/index.ts` (a `ProfilePlugin`), listed in `features/explorer/plugins.ts` | `inspect: {kind: ...}` |
| A story chart from a series | a `ChartBuilder` in `application/chart-builders.ts` or in a plugin | `charts: [{builder: ...}]` |

## Data locally

The explorer reads its files where the profile says (`data.roots`, `data.routes`). To work offline,
put the files in `<folder>/<CODE>/` and set `PUBLIC_MOSAIC_PROFILE_DATA` (see `.env.example`); files
the profile marks `withheld` are never requested, from anywhere.
