# ADR 0005 — One page per landscape, made of sections chosen by the profile

**Status:** superseded by [ADR 0008](0008-landscapes-explorer-map-visualization.md) (2026-11-13)

## Context
The deliverables ask for a profile page for every living landscape; the Lake Victoria Basin Explorer
is the first rich one, and more will follow with other themes or sections of their own.

## Decision
`/landscapes/<code>/` exists for every landscape. The page is built with the site header and title;
its sections come from the API at runtime and each `kind` is a registered component. The map
explorer is one section kind, loaded lazily.

## Consequences
+ A profile changes without rebuilding the site; a new landscape page needs no code.
+ New section kinds are added without touching the page or the other sections.
− Section content needs JavaScript (as the catalogue).
