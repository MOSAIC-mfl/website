/** Headline figures of the catalogue, from the facet counts (home page, catalogue page). */
import type { FacetCounts } from '../api/types'
import { NOT_SPECIFIED } from './facets'

export const isRegion = (geo: string): boolean => geo === 'global' || geo.startsWith('m49:')

export function distinctValues(counts: Record<string, number> = {}, exclude: (v: string) => boolean = () => false): number {
  return Object.keys(counts).filter((v) => v !== NOT_SPECIFIED && !exclude(v)).length
}

export function headline(total: number, facets: FacetCounts) {
  return {
    resources: total,
    landscapes: distinctValues(facets.landscape),
    countries: distinctValues(facets.geography, isRegion),
  }
}
