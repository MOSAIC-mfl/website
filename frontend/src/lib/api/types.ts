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
export type Manifest = S['Manifest']
export type SourceInfo = S['SourceOut']
export type Labels = S['Labels']['labels']
export type FacetCounts = Record<string, Record<string, number>>
export type Provenance = S['ProvenanceOut']
export type Quality = S['QualityOut']

/** ResourceDetail with `record` typed as a MOSAIC standard record. */
export type ResourceDetail = Omit<S['ResourceDetail'], 'record'> & { record: MosaicRecord }

export type { MosaicRecord }
export type AccessPoint = NonNullable<MosaicRecord['data']>[number]
export type Contact = NonNullable<MosaicRecord['contacts']>[number]

export type LandscapeSummary = S['LandscapeSummaryOut']
export type LandscapePage = S['LandscapeOut']
export type LandscapeSection = S['SectionOut']
export type DataStatus = S['DataStatusOut']
