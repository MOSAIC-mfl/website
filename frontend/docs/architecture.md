# mosaic-web architecture

## 1. Goal

Keep the approved website (pages, sections, typography, styles) and replace its data layer:
the catalogue is read from `mosaic-api` at runtime, with types generated from the API
contract, so the website and the API cannot silently drift apart.

## 2. Layers (ports and adapters)

```
pages (Astro)  ──▶  components (React, presentational)
                         ▲
                    containers: CatalogueApp, DatasetPage, CatalogueStats, ProfileMap
                         │ use
              ┌──────────┴───────────┐
        lib/ui (hooks)          lib/domain (pure rules)
              │                        ▲
              ▼                        │
     lib/catalog/repository.ts  ── CatalogRepository (port)
              ▲                 ▲
   static-repository.ts   live-repository.ts      (adapters)
   filters + hashed JSON   openapi-fetch → FastAPI
```

* **Domain** (`lib/domain`) has no I/O and no React: query ⇄ URL parameters (including the
  old parameter names, so old links keep working), facets, labels, text folding,
  presentation helpers. It is what the tests cover first.
* **Port** `CatalogRepository`: `overview()`, `search(query)`, `get(id)`, `recordLink(id)`,
  `related(detail)`. Components depend only on it (dependency inversion).
* **Adapters**:
  * `StaticCatalogRepository` reads the export that GitHub Pages serves (`v1/sources.json`,
    and the internal index `v1/_index/index.json` → content-hashed shards). Search and facet counts run in the browser with the same rules
    as the API. Files are fetched once and memoized; a failed fetch is retried next time.
  * `LiveCatalogRepository` calls the FastAPI routes through `openapi-fetch`, typed by
    `schema.d.ts`: `/v1/sources` and one page of `/v1/records?include_facets=true` (the counts)
    once, then `/v1/records`; search, counts and sorting happen on the server.
* **Filters:** those of `GET /v1/records`: country, living landscape, theme and readiness
  (`processing_status`) first; data type, access, licence and catalogue under "More filters". The API has no
  filters endpoint (mosaic-api ADR-0007): the labels are the website's own
  (`lib/domain/vocab-labels.ts`, generated from the standard's vocabularies by
  `npm run gen:labels -- <mosaic-standard>/vocab`; catalogue names from `/v1/sources`), and the counts
  are made over the records.
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

## 5. What is on screen

Lizeth's redesign (website `main`, 2026-11-12) is kept as it is; what depends on the catalogue is
read from the API in the browser:

* **Home:** the figures (datasets, landscapes, countries) - `lib/ui/catalogue-figures.ts`.
* **Landscapes** (`/landscapes`, `components/landscapes/`): her explorer (selector, photos, locator
  map, key insights, section menu). Its controller (`explorer/controller.ts`) gets dataset counts,
  data coverage over the standard's 16 themes, open access and whether a landscape has a map profile
  from `ExplorerData` (`lib/ui/landscape-explorer-data.ts`, pure rules in
  `lib/domain/landscape-insights.ts`). "Map visualization" shows only for landscapes with a profile.
* **Catalogue:** her filters, tiles / list, readiness legend, on `CatalogueApp` and the repository.
* **Dataset page:** her header, four tabs and side column (`components/dataset/`), with more of the
  standard v0.2: access points, processing steps, contacts, funding, publications, completeness.
* **Readiness** is the standard's optional `processing_status`, declared by the contributor and
  never inferred (`lib/domain/readiness.ts`); records without it read "Not stated".
* Landscape texts and photos stay in the site (`data/landscape_profiles.json`,
  `data/landscape_photos.json`); only catalogue figures come from the API.

## 6. Quality gates

`npm run lint`, `npm run typecheck`, `npm test` (Vitest: domain rules and both adapters
against fixtures), `npm run build`, and a check that generated types match the contract
(`.github/workflows/ci.yml`).
