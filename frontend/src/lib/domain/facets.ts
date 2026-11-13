/**
 * The catalogue filters: the filters of GET /v1/records (mosaic-api domain/facets.py FILTERS). Each
 * record also carries other facet values (`summary.facets.geometry`, `.status`…) for display.
 */
export const FACETS = ['geography', 'landscape', 'theme', 'processing_status', 'data_kind', 'access', 'license', 'source'] as const

export type FacetKey = (typeof FACETS)[number]

export const NOT_SPECIFIED = 'not_specified'

export type Filters = Partial<Record<FacetKey, string[]>>

export function isFacet(value: string): value is FacetKey {
  return (FACETS as readonly string[]).includes(value)
}
