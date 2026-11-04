# mosaic-web architecture

## 1. Goal

Keep the approved website (pages, sections, typography, styles) and replace its data layer:
the catalogue is read from `mosaic-api` at runtime, with types generated from the API
contract, so the website and the API cannot silently drift apart.

## 2. Layers (ports and adapters)

```
pages (Astro)  ──▶  components (React, presentational)
                         ▲
                    containers: CatalogueApp, DatasetDetail, CatalogueStats
                         │ use
              ┌──────────┴───────────┐
        lib/ui (hooks)          lib/domain (pure rules)
              │                        ▲
              ▼                        │
     lib/catalog/repository.ts  ── CatalogRepository (port)
              ▲                 ▲
   static-repository.ts   live-repository.ts      (adapters)
   manifest + hashed JSON  openapi-fetch → FastAPI
```

* **Domain** (`lib/domain`) has no I/O and no React: query ⇄ URL parameters (including the
  old parameter names, so old links keep working), facets, labels, text folding,
  presentation helpers. It is what the tests cover first.
* **Port** `CatalogRepository`: `overview()`, `search(query)`, `get(id)`, `recordLinks(id)`,
  `related(detail)`. Components depend only on it (dependency inversion).
* **Adapters**:
  * `StaticCatalogRepository` reads the export that GitHub Pages serves (`v1/manifest.json`
    → content-hashed shards). Search and facet counts run in the browser with the same rules
    as the API. Files are fetched once and memoized; a failed fetch is retried next time.
  * `LiveCatalogRepository` calls the FastAPI routes through `openapi-fetch`, typed by
    `schema.d.ts`; search, facets and sorting happen on the server.
  * Both turn network failures into `ApiError`, which `LoadState` shows with a retry button.
* **Composition root** (`lib/catalog/index.ts`): reads `PUBLIC_MOSAIC_API_MODE` /
  `PUBLIC_MOSAIC_API_URL` and builds one repository. Adding another backend means one new
  adapter, no change in components (open/closed).
* **UI**: containers own state and talk to the repository; the other components receive
  props and render the same markup and class names as the approved site.

## 3. Rules shared with the API

* **Text folding** (`domain/text.ts`) is the same function as `mosaic_api/domain/text.py`:
  case, accents (all Unicode marks), symbols and separators are ignored, so "PERÚ", "peru"
  and "Perú" match in search, filters and ids.
* **Filter values** are resolved by id or label; unknown values produce a warning shown to
  the user instead of an empty page.
* **Facets and statuses** come from the API vocabulary (`/v1/labels`), not from lists in the
  website.

## 4. URLs

* Catalogue: `/catalogue/?q=…&geography=…&theme=…&sort=…&page=…` (old names such as
  `country`, `mfl_theme`, `access_level=Open` are still accepted).
* Dataset: `/catalogue/dataset/?id=<source>:<id>`, one static page for every record of every
  catalogue. Old links `/catalogue/MFL-…/` are redirected by `404.astro`.

## 5. What changed on screen (and what did not)

Same pages, sections, fonts, colours and components. Adapted to the new metadata:
completeness badge (complete / incomplete with the missing fields), access level and access
method, source catalogue (MOSAIC, CDH), new filters (geometry, spatial, access method,
metadata status), JSON / JSON-LD links to the record, "Other ways to access it".
Counts on the home and landscape pages are read from the API.

## 6. Quality gates

`npm run lint`, `npm run typecheck`, `npm test` (Vitest: domain rules and both adapters
against fixtures), `npm run build`, and a check that generated types match the contract
(`.github/workflows/ci.yml`).
