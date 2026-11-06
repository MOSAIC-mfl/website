/**
 * The catalogue filters: the four filters of GET /v1/records (mosaic-api ADR-0007). Each
 * record also carries other facet values (`summary.facets.data_kind`, `.access`…) for display.
 */
export const FACETS = ['geography', 'landscape', 'theme', 'source'] as const

export type FacetKey = (typeof FACETS)[number]

export const NOT_SPECIFIED = 'not_specified'

export type Filters = Partial<Record<FacetKey, string[]>>

export function isFacet(value: string): value is FacetKey {
  return (FACETS as readonly string[]).includes(value)
}
