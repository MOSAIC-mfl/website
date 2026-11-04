/** The catalogue filters: one definition per facet of the API (`summary.facets`). */
export const FACETS = [
  'geography', 'landscape', 'theme', 'source',
  'data_kind', 'geometry', 'spatial', 'method', 'access', 'license', 'status', 'resource_type',
] as const

export type FacetKey = (typeof FACETS)[number]

export const NOT_SPECIFIED = 'not_specified'

export type Filters = Partial<Record<FacetKey, string[]>>

export function isFacet(value: string): value is FacetKey {
  return (FACETS as readonly string[]).includes(value)
}
