# ADR 0006 — The map explorer: configuration, renderers by kind, profile plugins

**Status:** proposed (to review with the team, and with Andrés Aguilar for the explorer)

## Context
The Lake Victoria explorer works and its science is careful (licences, caveats, verified citations),
but its code mixed configuration, content and behaviour (a 750-line app.js, window.* hooks, panels
built with innerHTML), so another profile meant copying it.

## Decision
- Keep its design and behaviour; rebuild its structure: ports (MapEngine, DataSource), adapters
  (MapLibre, HTTP + geotiff), renderers per kind of overlay with one interface, inspectors and panels
  per kind, one controller with explicit state, React components that only draw.
- Everything profile-specific is configuration (mosaic-catalog `explorer.yaml`), converted from the
  explorer's own files and code by a script that only reads its repository.
- Code only one profile needs goes in a plugin (`src/profiles/<code>/`), loaded on its page only.

## Consequences
+ A second explorer with the same kinds of data is configuration only.
+ Each module is testable alone (tests run the controller against a fake map and fake data).
− Two places to look (profile + website) when something new is needed; the profile check warns
  about kinds the website does not know.
