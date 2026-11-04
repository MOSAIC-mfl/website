# MOSAIC website — frontend

The MOSAIC website (Astro + React). Same pages, sections, fonts and styles as before; the
difference is **where the catalogue comes from**: the site no longer reads `data/datasets.json`
at build time, it reads the **MOSAIC API** ([mosaic-api](https://github.com/MOSAIC-mfl/mosaic-api))
when a page opens.

```
catalog       ──build──▶ dist/catalog.json ─┐
cdh-catalog (and others) ────────────────────┼─▶ mosaic-api ──▶ static JSON (GitHub Pages) ──▶ website
                                             │                 or FastAPI (local, live)
```

A change in the catalogue is visible on the website as soon as the API is republished;
the website only needs rebuilding when its own code changes.

**Landscape pages.** Every living landscape has a page, `/landscapes/<code>/` (e.g.
`/landscapes/ken-lvb/`): the site header, then the sections its profile lists (written in
mosaic-catalog, served by the API). Lake Victoria shows the **Basin Explorer** by Andrés Aguilar,
rebuilt here as a reusable map explorer with the same layout, layers, legends, story and studies.
How it is built and how to add a profile: [docs/landscape-profiles.md](docs/landscape-profiles.md).

## Run it locally

Requirements: Node 22 (`.nvmrc`), and the API (Python 3.12) from
[mosaic-api](https://github.com/MOSAIC-mfl/mosaic-api), cloned next to this repository.
Commands run in `frontend/`.

```bash
npm ci
cp .env.example .env          # choose the API mode (see below)
npm run dev                   # http://localhost:4321/website/
```

Two ways to serve the API, same results on the website:

| Mode | `.env` | Start the API |
|---|---|---|
| `static` (what GitHub Pages serves) | `PUBLIC_MOSAIC_API_MODE=static`<br>`PUBLIC_MOSAIC_API_URL=http://127.0.0.1:8001` | in `mosaic-api`: `python -m mosaic_api export`, then here `npm run api:static` |
| `live` (FastAPI, for development) | `PUBLIC_MOSAIC_API_MODE=live`<br>`PUBLIC_MOSAIC_API_URL=http://127.0.0.1:8000` | in `mosaic-api`: `python -m mosaic_api serve` |

The API only accepts the origins listed in `mosaic-api/config/mosaic-api.yaml`
(`http.cors_origins`: `localhost:4321`, `127.0.0.1:4321`, `mosaic-mfl.github.io`).

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Astro |
| `npm run lint` / `typecheck` / `test` | ESLint, `tsc --noEmit`, Vitest |
| `npm run gen:api` | Regenerates the TypeScript types from the API contract (`contract/openapi.json`) and the record schema (`contract/standard/record.schema.json`) |
| `npm run api:static` | Serves `mosaic-api/site` (cloned next to this repository) on :8001 with CORS, to try static mode |

When the API or the standard change, copy the new `docs/openapi.json` (mosaic-api) and
`dist/schema/*.json` (catalog) into `contract/` and run `npm run gen:api`;
`tsc` then points at every place in the website that must follow. CI fails if the
committed types do not match the contract.

## Where things are

| Path | Role |
|---|---|
| `src/lib/domain/` | Pure rules: query ⇄ URL, facets, labels, text folding, presentation helpers. No I/O, no React. |
| `src/lib/catalog/` | `CatalogRepository` port and its two adapters (`static`, `live`); `index.ts` chooses one from the config. |
| `src/lib/api/` | Types generated from the contract (never edited by hand) and readable aliases. |
| `src/lib/ui/` | React hooks (async loading, query in the URL). |
| `src/components/catalogue/`, `src/components/dataset/` | UI: one container (`CatalogueApp`, `DatasetDetail`) and presentational components. |
| `src/pages/` | Astro pages (unchanged sections). Dataset page: `/catalogue/dataset/?id=mosaic:MFL-…`. Landscape pages: `/landscapes/<code>/`. |
| `src/features/landscape/` | Landscape page: its sections (overview, map explorer, datasets, data status), each a module chosen by `kind`. |
| `src/features/explorer/` | The map explorer engine: domain rules, ports (map, data), MapLibre and GeoTIFF adapters, renderers per kind of layer, click inspectors, panels, React UI. |
| `src/profiles/<code>/` | Profile plugins: the few modules a profile needs beyond the core (KEN-LVB: the flood click). |
| `data/` | Map geometry for landscapes (site content, not catalogue). |

More: [docs/architecture.md](docs/architecture.md) and the decisions in [docs/adr](docs/adr).

## Pending (to review with the team)

- The text pages **About**, **Contribute** and **Metadata guide** still describe the old
  schema (`readiness_status`, old fields). They were not changed on purpose: their content
  needs review with Lizeth before it is rewritten for the new standard.
- The site reads the static API at mosaic-mfl.github.io/mosaic-api: it shows data once mosaic-api
  has published on Pages.
- The Lake Victoria explorer reads its data from where its author publishes it (GitHub Pages of
  anaguilarar/mosaic-lake-victoria and the Hugging Face dataset aaguilar90/mosaic-lake-victoria).
  Moving that data under MOSAIC is a separate decision.
