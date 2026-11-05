/**
 * Contract types. Everything here comes from generated files:
 *  - schema.d.ts  ← mosaic-api OpenAPI (contract/openapi.json)        `npm run gen:api`
 *  - record.d.ts  ← MOSAIC standard JSON Schema (contract/standard/)  `npm run gen:api`
 * A breaking change in the API or the standard fails `npm run typecheck`, not production.
 */
import type { components } from './schema'
import type { MosaicRecord } from './record'

type S = components['schemas']

export type ResourceSummary = S['ResourceSummary']
export type SourceInfo = S['SourceOut']
/** GET /v1/filters: versions, totals, filter options (value, label, count) and other labels. */
export type FiltersInfo = S['FiltersOut']
export type FilterOption = S['FilterOption']
export type Labels = Record<string, Record<string, string>>
export type FacetCounts = Record<string, Record<string, number>>
export type Provenance = S['ProvenanceOut']
export type Quality = S['QualityOut']

/** ResourceDetail with `record` typed as a MOSAIC standard record. */
export type ResourceDetail = Omit<S['ResourceDetail'], 'record'> & { record: MosaicRecord }

export type { MosaicRecord }
export type AccessPoint = NonNullable<MosaicRecord['data']>[number]
export type Contact = NonNullable<MosaicRecord['contact']>[number]

export type LandscapeSummary = S['LandscapeSummaryOut']
export type LandscapePage = S['LandscapeOut']
export type LandscapeSection = S['SectionOut']
export type DataStatus = S['DataStatusOut']
