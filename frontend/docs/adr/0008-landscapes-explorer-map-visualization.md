# ADR 0008 — Landscapes: Lizeth's explorer, figures from the API, map profile in "Map visualization"

**Status:** accepted (2026-11-13, merge of the redesign with the API-based website)

## Context
The redesign on `main` (2026-11-12) replaced the per-landscape pages with one explorer on
`/landscapes`, with a section menu that already had "Map visualization". The API-based branch had
one page per landscape (ADR 0005) with the map explorer as a section.

## Decision
- The explorer is kept as designed. What depends on the catalogue (dataset counts, data coverage
  over the 16 themes, open access, whether a map profile exists) is read from mosaic-api in the
  browser through the `ExplorerData` port; landscape texts and photos stay in the site.
- "Map visualization" shows the landscape's map profile (map, story, studies) for landscapes that
  have one; it is hidden otherwise. Two ways are kept while the team chooses: embedded in the panel
  and full screen at `/landscapes/<code>/map/`.
- `/landscapes/<code>/` and its other sections are removed; old links go to `/landscapes#CODE`.

## Consequences
+ One look for all landscapes; a new profile or dataset needs no rebuild.
+ The explorer stays plain DOM (fast first paint); React and MapLibre load only for the map.
- One of the two map variants will be removed after the review.
