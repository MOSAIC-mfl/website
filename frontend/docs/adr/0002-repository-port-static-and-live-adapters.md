# ADR 0002 — One repository port, static and live adapters

**Status:** accepted

## Context
In production the API is static JSON on GitHub Pages (no server, no budget). In development
the FastAPI server is more convenient and is the reference implementation.

## Decision
Components depend on `CatalogRepository`. Two adapters implement it: static (manifest +
hashed files, search in the browser with the API's rules) and live (`openapi-fetch`).
The mode is chosen by `PUBLIC_MOSAIC_API_MODE`.

## Consequences
+ Switching to a hosted API later is a configuration change.
+ Both adapters are tested against the same fixtures.
− The browser search duplicates the API rules; `text.ts` and `text.py` are kept identical
  and tested with the same cases.
