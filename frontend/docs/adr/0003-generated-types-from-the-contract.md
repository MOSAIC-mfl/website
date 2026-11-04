# ADR 0003 — Types generated from the API contract and the record schema

**Status:** accepted

## Decision
`src/lib/api/schema.d.ts` is generated from mosaic-api's OpenAPI document and
`record.d.ts` from the standard's `record.schema.json`. They are never edited by hand; CI
regenerates them and fails on any difference.

## Consequences
+ A breaking change in the API or the standard is a TypeScript error in the website.
− Updating the contract is a manual copy into `contract/` (until the repos are published
  and the contract can be fetched from GitHub Pages).
