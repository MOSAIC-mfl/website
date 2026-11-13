# ADR 0004 — One dataset page with the id in the query string

**Status:** accepted

## Context
Static hosting cannot create a page per record at runtime, and records from several
catalogues share the site.

## Decision
`/catalogue/dataset/?id=<source>:<id>` renders any record. Old `/catalogue/MFL-…/` links
are redirected by `404.astro`.

## Consequences
+ New records need no website rebuild.
− Search engines see less per-record content (the API's JSON-LD endpoint was removed in
  2026-11). Can be revisited with prerendering, or JSON-LD embedded in the page, if SEO matters.
