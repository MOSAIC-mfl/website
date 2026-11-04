# ADR 0001 — The website reads the catalogue from mosaic-api at runtime

**Status:** accepted (local, pending team review)

## Context
The old website read the catalogue YAML files at build time. Every catalogue change needed a
website rebuild, the website reimplemented filters and validation, and it could only show
MOSAIC records.

## Decision
The website contains no catalogue data. React islands load it from mosaic-api when the page
opens. Pages, sections and styles stay the approved ones.

## Consequences
+ Catalogue and website evolve and deploy independently; other catalogues (CDH) appear for free.
+ One place for search and validation rules (the API and its contract).
− The catalogue needs JavaScript; `<noscript>` points to the API.
− Dataset pages are one client-rendered page (`/catalogue/dataset/?id=`), see ADR 0004.
