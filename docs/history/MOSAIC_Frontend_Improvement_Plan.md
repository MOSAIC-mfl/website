# MOSAIC Frontend — Improvement Plan

**Goal:** a simple, easy-to-navigate site for the primary audience — **CGIAR researchers and centre focal points** doing geospatial data discovery.
**Bias:** remove friction and clutter before adding anything. When motion or decoration isn't justified, delete it.
**Framing held throughout:** MOSAIC is a coordination **network + metadata system** that *connects* to external services and sibling CGIAR hubs — never a "repository / platform / database". "Connect, don't duplicate."
**Status:** evaluation done **and implemented** — see Implementation status below.
**Date:** 2026-06-22 (evaluation) · 2026-06-23 (implementation).

---

## Implementation status (2026-06-23)

Implemented and verified (build clean: **67 pages**, lint clean; smoke-tested in the dev server). Two pre-existing cosmetic font warnings remain; the pre-existing `tsc` strictness errors in `utils/filterDatasets.ts` were left untouched (not introduced here, `astro build` is unaffected).

**Done** — recs #1–#20, #23, #26:
- #1/#2 Home badges routed through `StatusBadge`/`AccessBadge` (latent `null` crash + unstyled badge fixed; third inline badge system gone).
- #3 `prefers-reduced-motion` block + `scroll-behavior` reset; #4 `metric-card` blur deleted; #5 `.ds-view-btn` `gap` animation deleted; #6 `.ds-card:hover` lift gated behind `@media (hover:hover) and (pointer:fine)`.
- #7 chip border → teal; #15 `DatasetThumbnail` re-paletted to the MOSAIC palette (no forest-green); #20 data-type badges → MOSAIC tints.
- #8 `.data-table` scrolls on mobile; #9 detail breadcrumb → shared `Breadcrumb.astro` (+ Home); #13 citation → `var(--font-mono)`.
- #12 malformed `<ellipse>` fixed; #14 seven orphaned web-fonts deleted; #23 `<noscript>` STAC pointer added; #26 filter island → `client:visible`.
- #10 footer reconciled to nav labels, Contact moved out of "Contribute"; #11/#16 Contribute dropdown + its JS removed, "Contribute" is now one top-level link.
- #17 Contribute pages merged **4 → 2** (How-to + Metadata Guide; `qc-workflow` + `governance` deleted, their unique content folded in).
- #18 "Back to catalogue" + browser Back now restore filters/search/sort (URL-synced + sessionStorage); #19 build-time "Related datasets" strip on the detail page.
- Bonus correctness: replaced the **fabricated landscape codes** with the real provisional set, and aligned the Country + Data-Type vocab tables to the actual data.

**Deferred (optional polish, low value / higher churn — left for a later pass):** #21 flatten the remaining decorative SVGs, #22 trim Home/About copy duplication, #24 converge heroes onto `PageHero`, #25 rename misleading colour tokens.

**Content decisions — made by Lizeth and applied end-to-end (2026-06-23):**
- **Readiness scale → 3-stage** (`Raw / Processed / Validated`). Frontend copy aligned (Metadata Guide table + How-to steps de-jargoned). *Backend:* the pipeline already emitted only 3 stages (`transform.map_readiness`) — no 5-stage vocabulary existed there, so nothing to change. The 5-stage was a frontend-copy artifact only; now gone.
- **Access label → "Internal"**, renamed **end-to-end**: pipeline `registry.py` (`VALID_ACCESS` + `ACCESS_ALIASES` mapping `CGIAR-internal → Internal`), spec docs, regenerated STAC + `datasets.json` (74/74 validation pass; 8 datasets now `Internal`), and the frontend (`AccessLevel` type, `AccessBadge`, `[id].astro`, filter). Zero `CGIAR-internal` remain in code or data.
- **Landscape codes & names:** fabricated codes replaced with the real provisional set, and the **names filled in from the pipeline vocab** (e.g. `ETH-OG` → Omo-Gibe Basin, `IND-CH` → Central India Highlands, `CIV-NZ` → N'Zi Watershed). National fallbacks (`*-NAT`) and `GLB-UNSPEC` remain provisional pending your final landscape-list sign-off.

---

## 1. Executive summary — the 5 moves that matter most

1. **Fix the broken Home badges (and a latent build crash).** `index.astro:101-102` builds badge classes by hand: status lookup misses (data is `Raw/Processed/Validated`, the lookup table uses a different 5-stage scale → empty class), and `access_level.toLowerCase()` produces `badge-cgiar-internal`, which has **no CSS rule** (renders unstyled) and **throws on a `null` value** — it only survives today because the first three featured rows happen to be non-null. Route all badges through the existing `AccessBadge.astro` / `StatusBadge.astro`. *Cheap, high-trust, removes a third parallel badge system.*
2. **Flatten the navigation and merge the over-built Contribute section.** A click-to-open **Contribute dropdown** (plus its JS) is unjustified for a 9-page site and hides the very journey focal points need. Collapse it to one top-level link, and merge the **4 Contribute pages → 2** (How-to + Metadata Guide) by folding in the duplicated Quality-control and access-tier content. *The single biggest structural simplification.*
3. **Reconcile the vocabulary that breaks trust.** Three live, mutually-contradictory readiness scales (data says `Raw/Processed/Validated`; Home + QC + Metadata Guide advertise a 5-stage `Registered → … → Analytics-ready`), plus **fabricated landscape codes** in the Metadata Guide that don't exist in the real data. For a network whose value proposition *is* trustworthy provenance, statuses and codes that don't reconcile are the single largest credibility leak. *These are content decisions for Lizeth — see §3 and §8.*
4. **Close the accessibility gaps and delete the unjustified motion.** `prefers-reduced-motion` is honored **nowhere** (and `scroll-behavior: smooth` is global); hover motion isn't gated for touch; `.ds-view-btn` animates `gap` (a layout property); `metric-card` carries a `backdrop-filter: blur` that has nothing to blur. One reduced-motion block + a hover gate + two deletions fixes all of it. The motion baseline is otherwise already restrained (no keyframes, no `transition: all`, no `scale(0)`).
5. **Bring the brand home and cut the decoration tax.** Four bespoke "map-like" SVG systems compete for attention; the per-card thumbnail generator runs seeded PRNG art on up to 50 cards using the **forbidden MFL forest-green** palette, the chip border is forest-green, and the data-type badges are an off-palette rainbow. Keep one contour treatment, flatten thumbnails to a theme colour + icon, and return every colour to the MOSAIC palette.

---

## 2. Method

**What was evaluated** — all 9 pages and the shared shell, reading the actual source:

- Pages: `index.astro` (Home), `about.astro`, `contact.astro`, `catalogue/index.astro`, `catalogue/[id].astro`, `landscapes/index.astro`, `contribute/{index,governance,metadata-guide,qc-workflow}.astro`.
- Shell: `BaseLayout.astro`, `layout/{Header,Nav,Footer}.astro`.
- Components: `ui/{AccessBadge,StatusBadge,Icon,PageHero,Breadcrumb}.astro`; `catalogue/{CatalogueFilter,DatasetCard,DatasetGrid,DatasetThumbnail}.tsx`; `LandscapeLocatorMap.astro`.
- Styles: `variables.css`, `global.css`, `catalogue.css`. Data: `frontend/data/*.json`.

**Three skills applied:**

- **ui-ux-pro-max** (design-intelligence engine) — queries run against the `ux`, `style`, and `typography` domains: *navigation/IA/findability*, *data tables / filters / faceted search / empty states*, *forms / labels / validation*, *performance / images / layout shift*, *typography hierarchy*, *whitespace & visual hierarchy*. Findings cited where they apply (breadcrumbs at 3+ levels; empty states need message + action; tables overflow on mobile; color-alone encoding; images need dimensions; fonts load without layout shift).
- **emil-design-eng** — UI-polish & animation philosophy: animation must be justified; do less but do it well; CSS transitions over keyframes; only animate transform/opacity; honor reduced motion; menus used often should not animate.
- **review-animations** — the **Ten Non-Negotiable Standards**, applied to every transition/transform in the CSS and components.

**Team:** ux-researcher (IA & navigation), ui-ux-designer (visual hierarchy, brand, motion), product-manager (Impact × Effort, acceptance criteria, scope discipline), frontend-developer (read-only feasibility + independent technical scan, including a clean `npm run build`).

---

## 3. Cross-cutting findings

### Navigation & IA

| Finding | Why it hurts simplicity/navigation | Fix | Basis |
|---|---|---|---|
| **Contribute dropdown** (`Nav.astro:40-73` + `<script>` 328-354) hides 4 pages behind a click | Adds an interaction cost + ~50 lines of JS/ARIA wiring for a 9-page site; hides the contribution journey from focal points | Collapse to one top-level **Contribute** link → How-to. Remove the dropdown + its JS | recognition over recall; minimalist nav |
| **Over-built Contribute section** — really 1 task page + 3 reference pages | QC Workflow overlaps How-to *and* the detail-page readiness legend; Governance's access-tier table duplicates Metadata Guide's | Merge 4 → 2: keep How-to + Metadata Guide; fold QC + access-tier in | consistency & standards (Nielsen #4) |
| **Footer redundant + miscategorized** (`Footer.astro:36-43`) | "Contact" sits under the **Contribute** heading; labels differ from nav ("Dataset Catalogue" vs "Catalogue"); link set is an inconsistent subset | Reconcile labels to nav; move Contact out of Contribute | recognition over recall |
| **"Back to catalogue" loses filter/scroll state** (`[id].astro:151`) | A filtered researcher lands back at the unfiltered top and must re-apply filters | Preserve via querystring/`history` (filters are read from URL params but never written back — `CatalogueFilter.tsx:96-110`) | recognition over recall |
| **No "Related datasets" on detail** | A researcher who finds one layer has no one-click path to siblings | Add a build-time strip (same landscape/theme, exclude self, cap ~4) — the *one* worthwhile addition; stays within "connect" (links within the catalogue, no new data) | findability |
| **Two breadcrumb implementations** | `catalogue/[id]` hand-rolls an inline breadcrumb that omits Home; contribute/* use the shared component | Use `Breadcrumb.astro` everywhere; include Home | ui-ux-pro-max: breadcrumbs at 3+ levels |

*Verdict on the discovery journey:* Home → Catalogue → filter → detail **works**, and Landscapes cards correctly deep-link into a filtered catalogue. The friction is concentrated in the Contribute section and in losing filter state on the way back.

### Visual hierarchy & layout

- **Four bespoke "map-like" SVG systems** compete for the "geospatial identity": home-hero contour (14 paths + 5 ellipses), `PageHero` contour, catalogue painted-terrain scene, and a per-card generative thumbnail. For someone scanning for a dataset this is decoration tax. **Keep one** contour treatment (`PageHero`), flatten the catalogue header to a gradient, simplify thumbnails. *(emil: do less but do it well; "beauty is leverage" — the aggregate here is noise.)*
- **`metric-card { backdrop-filter: blur(6px) }`** (`catalogue.css:75`) blurs a flat gradient — no visible payoff, real compositing cost (and the only `backdrop-filter` in the codebase). **Delete.**
- **Card density and list-default view are right** for researchers scanning metadata. Keep.

### Typography & brand consistency

- **Headings consistently Georgia, body consistently Calibri** via `--font-title` / `--font-body`. Good; no font-driven layout shift (brand fonts are system-resolved). *(ui-ux-pro-max: fonts load without layout shift — satisfied.)*
- **Forbidden forest-green leftovers** (the brand rule says do not mix the old MFL green with the MOSAIC palette):
  - `.chip` border `rgba(11,79,58,.2)` (`catalogue.css:412`) is forest green on a teal chip → use `rgba(13,92,107,.2)`.
  - **`DatasetThumbnail.tsx` uses forest green on 5 of 6 theme palettes** (`#1d3a16`, `#2f5320`, `#14331d`, …) — the **largest** surviving green violation, on the most-repeated UI element. Re-palette to teal/amber/terracotta.
- **Off-palette data-type badge rainbow** (`catalogue.css:697-707`): sky/violet/pink. Only Raster/Vector/Tabular/Mixed appear in the data, so timeseries/model/survey are dead rules. Collapse to MOSAIC tints. (The functional traffic-light `--status-*` / `--access-*` tokens are a reasonable semantic exception.)
- **Misleading token names (tech debt):** `--color-green-*` and `--color-cgiar-teal*` all resolve to teal; `metric-icon--green` is teal and `--teal` is terracotta. Harmless at runtime, but a future editor will be misled. Rename only when touching those files.
- **Raw `monospace`** on the detail citation (`[id].astro:130`) bypasses `--font-mono`.

### Motion / animation (vs the Ten Standards)

**Baseline is good:** no `transition: all`, no `@keyframes`, no `scale(0)`/pure-fade entrances, no ease-in-on-UI, no JS/spring animation. Standards 3, 4, 5, 6, 9 are satisfied by absence. The real gaps:

| Issue | Standard | Fix |
|---|---|---|
| `prefers-reduced-motion` honored nowhere; `scroll-behavior: smooth` is global (`global.css:14`) | **#8 Accessibility** | One `@media (prefers-reduced-motion: reduce)` block (in `global.css`) that resets `scroll-behavior` and neutralises the `.ds-card` transform. Keep colour/opacity transitions — reduce ≠ zero. |
| Hover motion never gated for touch; `.ds-card:hover { translateY(-2px) }` sticks on tap (`catalogue.css:485-489`) | **#8 Accessibility** | Wrap the transform `:hover` in `@media (hover:hover) and (pointer:fine)`. |
| `.ds-view-btn` transitions `gap` then nudges it on hover (`catalogue.css:602,605`) | **#7 GPU-only** + **#1 Justified** | Delete the `gap` from the transition and the hover nudge; keep background/color. |
| Skip-link animates `top` (`Nav.astro:140`) | **#7 GPU-only** | Benign (one element, keyboard-only, 100ms). Low priority; `translateY` would be the correct form. |

Everything else (nav-link colour, focus rings, pagination, chip-remove opacity, button background) is small, justified, GPU-or-cheap feedback — **keep**. The dropdown/mobile-menu correctly use an instant `hidden` toggle with **no** animation — that is the right choice for a frequently-used menu (Standard 2); do not add motion there.

### Accessibility

- **Strong baseline:** global `:focus-visible` rule + dark-background overrides + per-component focus rings; no focus-state gaps found. Skip-link present. 44px min touch targets in the nav.
- **Gaps:** reduced-motion (above); `.data-table` has **no mobile overflow wrapper** (`global.css:118`) so the Metadata Guide's 4-column tables overflow on phones — wrap in `overflow-x:auto`; the locator-map dots distinguish landscape vs country-fallback by **colour alone** (consider a shape/stroke difference). *(ui-ux-pro-max: tables overflow on mobile; don't convey info by color alone.)*
- **JS-disabled:** the catalogue is one `client:load` island, so with JS off it renders blank. Low impact (researchers run JS) but a `<noscript>` note pointing to the STAC endpoint is cheap insurance and reinforces "connect to the source of truth."

### Performance

- **Build is clean** — 69 pages in ~780ms. Two cosmetic vite warnings: the IBM Plex Mono `@font-face` URLs in `variables.css:10,18` "didn't resolve at build time" (assets resolve at runtime).
- **~210KB of orphaned web fonts shipped to `dist/`:** `public/fonts/` carries Inter (3) + SpaceGrotesk (4) woff2 files referenced by **no** CSS — dead weight from the old brand. Safe to delete the 7 files.
- **Layout-property transitions:** only the two flagged (`gap`, skip-link `top`). No width/height/margin transitions elsewhere.
- **Images:** all three `<img>` carry explicit `width`/`height` — no CLS. Thumbnails are size-constrained — no shift.
- **JS:** a single island (`CatalogueFilter`, `client:load`, ~163KB, served only on `/catalogue`). `client:visible` would defer it (it sits below the hero + map) — minor win. Moving the thumbnail PRNG to a static Astro component would drop it from the JS bundle entirely.

---

## 4. Per-page findings

**Home (`index.astro`)** — *fix / simplify.* Fix the badge bug + latent null crash (lines 101-102) by routing through the badge components. Fix the malformed `<ellipse>` (line 44, duplicate `cy`/`rx`). Simplify the 19-element hero contour field and reuse the `PageHero` treatment. Trim the About duplication (two blocks restate About). Keep the stats bar, "How it works" 3 steps, and CTAs.

**About (`about.astro`)** — *keep.* Genuinely strong copy; the "What it is not" list is exactly the framing discipline the brief wants. No changes (inline styles are fine and on-brand). Minor: it says "not a file repository" — acceptable as contrast, but watch the framing rule.

**Catalogue list (`catalogue/index.astro` + islands)** — *simplify / fix.* Flatten the painted-terrain hero to a gradient. Delete `metric-card` blur (75); fix the green chip border (412); delete the `.ds-view-btn` gap animation (602/605); gate `.ds-card:hover` for touch. Keep the list-default view, filter sidebar, active chips, empty state (message + action — correct), and pagination.

**Dataset detail (`catalogue/[id].astro`)** — *fix.* Replace the inline breadcrumb with `Breadcrumb.astro` (+ Home). Wrap the overview `.data-table` for mobile. Citation → `var(--font-mono)` (line 130). Make "Back to catalogue" preserve filters and add a "Related datasets" strip. Keep the STAC pointer, access-by-tier logic, readiness explanation, and suggested citation — the source-of-truth signalling is correct here. (~40 inline styles: not urgent.)

**Landscapes (`landscapes/index.astro`)** — *keep.* Card grid with dataset counts, deep-links into a filtered catalogue, honest "Interactive map coming soon" panel. No action.

**Contribute / How-to (`contribute/index.astro`)** — *keep, becomes the section landing.* Checklist + 5-step process + FAQ as native `<details>` (no JS — correct). Receives the folded-in Quality-control content (L2).

**Contribute / Governance & Access (`governance.astro`)** — *merge.* Access-tier table is clear but duplicates the Metadata Guide's Access Level table; fold the user-facing access content into Metadata Guide and the eligibility/ownership into How-to. Wrap tables for mobile.

**Contribute / Metadata Guide (`metadata-guide.astro`)** — *fix / keep as the single reference.* Worst mobile-table offender (two 4-column tables) — wrap them. **Contains fabricated landscape codes** (`KEN-LV`, `ETH-GT`, `IND-WG`) that don't exist in the data — content decision for Lizeth (§8).

**Contribute / QC Workflow (`qc-workflow.astro`)** — *merge / retire as a nav-level page.* Clear 5-stage layout, but it overlaps How-to and the detail-page legend, and presents the **5-stage** readiness vocabulary that the catalogue (3-stage) contradicts. Fold into How-to / Metadata Guide; resolve the vocabulary (§8).

**Contact (`contact.astro`)** — *keep.* Four GitHub-issue-template buttons + direct contact. Simple and complete. No changes.

---

## 5. Prioritized recommendations (sorted by impact-per-effort)

Effort: **S** < ½ day · **M** ½–2 days · **L** > 2 days.

| # | Recommendation | Impact | Effort | Files (`frontend/src/...`) | Skill / standard |
|---|---|:--:|:--:|---|---|
| 1 | Route Home badges through `AccessBadge`/`StatusBadge`; fixes unstyled badge **and** latent `null` crash | H | S | `pages/index.astro:101-102`; `components/ui/{AccessBadge,StatusBadge}.astro` | consistency; ui-ux-pro-max: color/labels |
| 2 | Eliminate the third (inline) badge system across pages | H | S | `pages/index.astro`, `components/catalogue/DatasetCard.tsx` | component consolidation |
| 3 | Add `prefers-reduced-motion` block + gate `scroll-behavior` | H | S | `styles/global.css:14` | Standard 8 |
| 4 | Delete `metric-card` `backdrop-filter: blur` | M | S | `styles/catalogue.css:75` | emil: justified cost |
| 5 | Delete `.ds-view-btn` `gap` transition + hover nudge | M | S | `styles/catalogue.css:602,605` | Standards 1 & 7 |
| 6 | Gate `.ds-card:hover` transform for touch | M | S | `styles/catalogue.css:485-489` | Standard 8 |
| 7 | Fix forest-green `.chip` border → teal | M | S | `styles/catalogue.css:412` | brand rule (no MFL green) |
| 8 | Wrap `.data-table` in `overflow-x:auto` (mobile) | M | S | `styles/global.css:118`; `pages/contribute/metadata-guide.astro` | ui-ux-pro-max: tables overflow |
| 9 | `catalogue/[id]` → shared `Breadcrumb.astro` + Home crumb | M | S | `pages/catalogue/[id].astro:28-33`; `components/ui/Breadcrumb.astro` | ui-ux-pro-max: breadcrumbs 3+ levels |
| 10 | Reconcile footer labels with nav; move Contact out of "Contribute" | M | S | `components/layout/Footer.astro:36-43` | recognition over recall |
| 11 | De-jargon "QC Workflow" → "Quality control" in nav/links | M | S | `components/layout/Nav.astro`, `Footer.astro` | match system & real world |
| 12 | Fix malformed `<ellipse>` (duplicate attrs) | L | S | `pages/index.astro:44` | code hygiene |
| 13 | Citation block → `var(--font-mono)` | L | S | `pages/catalogue/[id].astro:130` | brand consistency |
| 14 | Delete 7 orphaned web-font files | L | S | `public/fonts/` (Inter, SpaceGrotesk) | performance |
| 15 | Re-palette `DatasetThumbnail` off the forest-green family | M | M | `components/catalogue/DatasetThumbnail.tsx` | brand rule (largest green violation) |
| 16 | Flatten the nav: remove Contribute dropdown + its JS | H | M | `components/layout/Nav.astro:12-17,40-73,109-122,328-354` | minimalist nav; recognition over recall |
| 17 | Merge 4 Contribute pages → 2 | H | M | `pages/contribute/{index,metadata-guide}.astro`; delete `qc-workflow`, `governance` | consistency & standards |
| 18 | "Back to catalogue" preserves filter/scroll state | H | M | `pages/catalogue/[id].astro`; `components/catalogue/CatalogueFilter.tsx:96-110` | recognition over recall |
| 19 | "Related datasets" strip on detail (build-time) | M | M | `pages/catalogue/[id].astro`; `frontend/data/datasets.json` | findability |
| 20 | Bring data-type badges into the MOSAIC palette | M | S–M | `styles/catalogue.css:697-707` | brand rule |
| 21 | Flatten home-hero + catalogue-terrain SVGs to one contour treatment | M | M | `pages/index.astro:25-48`, `catalogue/index.astro:24-65` | emil: do less, well |
| 22 | Trim Home/About content duplication | M | M | `pages/index.astro` | consistency |
| 23 | `<noscript>` note on catalogue → STAC endpoint | L | S | `pages/catalogue/index.astro` | resilience; "connect to source of truth" |
| 24 | Converge home/catalogue heroes onto `PageHero` | L | M–L | `components/ui/PageHero.astro`; `pages/index.astro`, `catalogue/index.astro` | component consolidation |
| 25 | Rename misleading colour tokens/classes (tech debt) | L | M | `styles/variables.css`; `styles/catalogue.css` | maintainability |
| 26 | Defer the filter island (`client:visible`) | L | S | `pages/catalogue/index.astro:119` | performance |

---

## 6. Quick wins (do first — low effort, high/medium impact)

These are all **S** and none blocks on a content decision except the *wording* inside #1/#11.

1. **#1 — Route Home badges through the components** (fixes unstyled badge + latent `null` build crash). **H**
2. **#3 — Add the `prefers-reduced-motion` block** + gate `scroll-behavior`. **H**
3. **#4 — Delete `metric-card` `backdrop-filter: blur`.** 
4. **#5 — Delete the `.ds-view-btn` `gap` animation.**
5. **#6 — Gate `.ds-card:hover` transform for touch.**
6. **#7 — Fix the forest-green chip border.**
7. **#8 — Wrap `.data-table` for mobile overflow.**
8. **#9 — Detail breadcrumb → shared component (+ Home).**
9. **#10 — Reconcile footer labels; move Contact out of "Contribute".**
10. **#12 — Fix the malformed `<ellipse>`.**
11. **#13 — Citation → `var(--font-mono)`.**
12. **#14 — Delete 7 orphaned web-font files.**

---

## 7. Roadmap

**Phase 1 — Quick wins & trust fixes (1 sprint).** All of §6, plus de-jargon "QC Workflow" (#11). Outcome: no broken/unstyled UI, reduced-motion honored, mobile tables usable, brand greens gone from the chip, lighter `dist/`.

**Phase 2 — Structural simplification (1–2 sprints).** Flatten the nav (#16) and merge the Contribute pages 4 → 2 (#17). Preserve filter state + add "Related datasets" on the detail page (#18, #19). Re-palette the thumbnails (#15) and the data-type badges (#20). Trim Home/About duplication (#22). Outcome: a measurably shorter, less redundant site with a smoother discovery loop.

**Phase 3 — Polish & consolidation (as capacity allows).** Flatten the remaining decorative SVGs (#21), converge heroes onto `PageHero` (#24), add the `<noscript>` note (#23), defer the filter island (#26), rename the misleading colour tokens (#25). Outcome: one hero, one contour, one badge path, honest token names.

---

## 8. Content decisions for Lizeth (not frontend bugs — do not auto-fix in code)

The frontend should display whatever the registry / `datasets.json` actually contains; it must not invent a reconciliation. Three decisions are needed:

1. **Readiness-status scale — pick ONE.** Live today: the data + types and the detail-page legend use **`Raw / Processed / Validated`** (3-stage); Home, QC Workflow, and the Metadata Guide advertise a **5-stage** scale (`Registered only → Under review → Accepted → Validated → Analytics-ready`) with **no backing data**. A researcher who reads "Analytics-ready" then never sees it loses trust in the provenance the network is built to provide. *Highest-priority decision.* Once chosen, registry + `datasets.json` + all page copy align.
2. **Landscape codes — confirm and freeze.** *(Partly handled.)* The Metadata Guide's **fabricated** codes (`KEN-LV / ETH-GT / IND-WG …`) have been replaced with the real **provisional** set (`KEN-NAT / ETH-OG / IND-CH / MEK-3S / ZWE-MB / GLB-UNSPEC …`), with landscape **names marked "TBC"** where unknown. Still needs you: confirm the canonical names + codes and freeze them, then the "TBC" names can be filled in.
3. **Access-level label — "Internal" vs "CGIAR-internal".** The data and `[id].astro:108`'s conditional use `CGIAR-internal`; the Metadata Guide and Governance pages display `Internal`. Choose the canonical user-facing label; copy, data, and the conditional then all use the same string.

---

## Who did what

- **ux-researcher** — page inventory, navigation/footer audit, labeling, the discovery journey, breadcrumbs, and the simpler proposed IA (flatten the dropdown, merge Contribute 4 → 2). Surfaced the readiness-vocabulary and landscape-code mismatches.
- **ui-ux-designer** — visual hierarchy, typography, brand/palette audit, component consistency, empty/loading/error states, and the component-by-component motion audit against the Ten Standards.
- **product-manager** — deduped both reviews into the prioritized backlog with Impact × Effort and acceptance criteria, separated quick wins from larger work, and broke out the content decisions (holding scope to "connect, don't duplicate").
- **frontend-developer** — read-only feasibility (file paths, S/M/L, blockers) and a clean `npm run build`. Independently caught the latent `null` access-level crash, ~210KB of orphaned fonts, and the forest-green thumbnail palette (the largest brand violation).
- **Coordinator** — ran the ui-ux-pro-max queries, read the shared shell + CSS to ground and reconcile findings, resolved overlaps (three badge issues → one root cause; two breadcrumbs → one fix), and synthesized this plan.

*No source code was modified. This document is the only file written.*
