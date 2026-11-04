# MOSAIC website

The public website of MOSAIC, the open geospatial data network for living landscapes: a catalogue of spatial datasets from CGIAR centres working across the Multifunctional Landscapes (MFL) Science Programme Living Landscapes.

**Live site:** https://mosaic-mfl.github.io/website/

[![Deploy to GitHub Pages](https://github.com/MOSAIC-mfl/website/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/MOSAIC-mfl/website/actions/workflows/deploy-pages.yml)
[![Lint Frontend](https://github.com/MOSAIC-mfl/website/actions/workflows/lint-frontend.yml/badge.svg)](https://github.com/MOSAIC-mfl/website/actions/workflows/lint-frontend.yml)

---

## Contents

- [Local development](#local-development)
- [Repository structure](#repository-structure)
- [Where the catalogue comes from](#where-the-catalogue-comes-from)
- [Contributing](#contributing)
- [Branch strategy](#branch-strategy)
- [Deployment](#deployment)
- [License](#license)

---

## Local development

**Prerequisites:** Node 22 (`nvm use` reads `.nvmrc`), npm. To work against a local API: Python
3.12 and [mosaic-api](https://github.com/MOSAIC-mfl/mosaic-api) cloned next to this repository.

```bash
# 1. Clone the repository
git clone https://github.com/MOSAIC-mfl/website.git
cd website/frontend

# 2. Install dependencies
npm ci

# 3. Choose where the catalogue is read from (see frontend/README.md)
cp .env.example .env

# 4. Start the development server
npm run dev
# → http://localhost:4321/website/

# 5. Checks (the same ones CI runs)
npm run lint
npm run typecheck
npm test
npm run build
```

Without a `.env`, the site reads the published static API (https://mosaic-mfl.github.io/mosaic-api).
Details, the two API modes and the code layout: [frontend/README.md](frontend/README.md).

---

## Repository structure

```
website/
├── .github/
│   ├── workflows/
│   │   ├── deploy-pages.yml    # build frontend/ and publish on Pages (push to main)
│   │   └── lint-frontend.yml   # contract types, lint, typecheck, tests, build (PRs and main)
│   ├── ISSUE_TEMPLATE/         # bug, content fix, dataset request
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── dependabot.yml          # weekly grouped updates: npm (frontend/) and the pinned actions
├── frontend/                   # the site: Astro + React (README inside)
│   ├── src/
│   │   ├── pages/              # site pages, dataset page, landscape pages /landscapes/<code>/
│   │   ├── lib/                # domain rules, catalogue repository (static / live API), generated API types
│   │   ├── features/           # landscape page sections, map explorer engine
│   │   ├── profiles/           # landscape profile plugins (ken-lvb)
│   │   ├── components/ layouts/ styles/
│   ├── contract/               # API contract (openapi.json) and record schema the types are generated from
│   ├── data/                   # map geometry for the landscapes (site content, not catalogue)
│   ├── docs/                   # architecture, decisions (adr/), landscape profiles
│   ├── scripts/ tests/ public/
│   └── package.json
├── scripts/
│   └── build_map_outlines.py   # frontend/data/landscape_outlines.json from the catalogue boundaries
├── docs/history/               # earlier planning notes
└── .nvmrc                      # Node 22
```

---

## Where the catalogue comes from

The website holds no dataset list. The records live in
[MOSAIC-mfl/catalog](https://github.com/MOSAIC-mfl/catalog) (MOSAIC metadata standard v0.1),
[mosaic-api](https://github.com/MOSAIC-mfl/mosaic-api) harvests them (and other catalogues, such
as the CGIAR Climate Data Hub) and publishes a static JSON API on GitHub Pages, and the pages read
that API when they open. A change in the catalogue shows on the site once the API is republished,
with no rebuild of the website.

To add or update a dataset, open a pull request on the catalog repository, or use its
"Register a new dataset" issue form. Non-technical contributors can also open a
[Dataset catalogue update issue](https://github.com/MOSAIC-mfl/website/issues/new?template=dataset_update.yml) here.

Landscape pages (`/landscapes/<code>/`) are described by profiles in the catalog repository
(`landscapes/<CODE>/`); see [frontend/docs/landscape-profiles.md](frontend/docs/landscape-profiles.md).

---

## Contributing

For code or content changes:
1. Create a feature branch from `main`
2. Make your changes in `frontend/`
3. Ensure `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` pass
4. Open a pull request using the PR template

All PRs require at least one review before merging to `main`.

---

## Branch strategy

| Branch | Purpose | Protected |
|---|---|---|
| `main` | Production — always deployable | Yes |
| `feature/*` | New features or pages | No |
| `fix/*` | Bug fixes | No |
| `hotfix/*` | Urgent production fixes | No |

Delete branches after merge.

---

## Deployment

The site deploys automatically to GitHub Pages on every push to `main` via the `deploy-pages.yml`
workflow. The build reads the static API at `https://mosaic-mfl.github.io/mosaic-api`
(`PUBLIC_MOSAIC_API_MODE=static`) and is served under `/website`.

**One-time setup (repository admin):** In Settings > Pages, set Source to **GitHub Actions**.

**Deployment time:** ~3–5 minutes from push to live.

**Rollback:** Re-run a previous successful workflow from the Actions tab.

---

## License

Site code and documentation: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

Individual datasets have their own licenses — see each dataset entry in the catalogue.
