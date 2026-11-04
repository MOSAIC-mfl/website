# ADR 0007 — Explorer libraries: npm packages, MapLibre 6, the author's charts vendored

**Status:** proposed

## Decision
- MapLibre, PMTiles, geotiff and maplibre-gl-compare are npm dependencies with exact versions (the
  explorer loaded them from a CDN as globals).
- MapLibre 6.14.0 instead of the explorer's 5.7.3: versions up to 6.4.0 have a critical XSS advisory
  (GHSA-jrc7-96c5-q579). 6.14.0 is the newest release older than two weeks. Its worker is shipped as
  a separate asset (`setWorkerUrl`).
- The explorer's SVG charts (its `charts.js`) are vendored as `svg-charts.js`, trimmed to the two
  charts it uses, with a TypeScript declaration, so the charts look exactly as their author designed.

## Consequences
+ Pinned, auditable dependencies; no CDN at runtime.
− Upgrading MapLibre needs the explorer's checks re-run (terrain, lazy layers, comparison).
