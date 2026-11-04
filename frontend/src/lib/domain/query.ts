/**
 * The state of a catalogue search, and how it is written in / read from the page URL.
 * URL parameters use the API's filter names, one parameter per value (values may contain commas).
 * Links from the previous website keep working through LEGACY_PARAMS / LEGACY_VALUES.
 */
import { FACETS, type FacetKey, type Filters, isFacet } from './facets'

export type SortKey = 'relevance' | 'recent' | 'oldest' | 'az' | 'za'

export interface CatalogueQuery {
  text: string
  filters: Filters
  sort: SortKey
  page: number
  pageSize: number
}

export const SORT_KEYS: readonly SortKey[] = ['relevance', 'recent', 'oldest', 'az', 'za']
export const PAGE_SIZES = [10, 25, 50] as const

/** API sort and order for each UI sort. */
export const SORT_TO_API: Record<SortKey, { sort: 'relevance' | 'title' | 'year'; order: 'asc' | 'desc' }> = {
  relevance: { sort: 'relevance', order: 'desc' },
  recent: { sort: 'year', order: 'desc' },
  oldest: { sort: 'year', order: 'asc' },
  az: { sort: 'title', order: 'asc' },
  za: { sort: 'title', order: 'desc' },
}

const LEGACY_PARAMS: Record<string, FacetKey> = {
  country: 'geography',
  living_landscape: 'landscape',
  mfl_theme: 'theme',
  data_type: 'data_kind',
  access_level: 'access',
}
const LEGACY_VALUES: Partial<Record<FacetKey, Record<string, string>>> = {
  access: { Open: 'public', Restricted: 'restricted', Internal: 'internal' },
  landscape: { GLB: 'not_specified' },
}

export function emptyQuery(): CatalogueQuery {
  return { text: '', filters: {}, sort: 'recent', page: 1, pageSize: 10 }
}

export function fromSearchParams(params: URLSearchParams): CatalogueQuery {
  const q = emptyQuery()
  const filters: Record<string, Set<string>> = {}
  for (const [rawKey, rawValue] of params) {
    const facet = isFacet(rawKey) ? rawKey : LEGACY_PARAMS[rawKey]
    if (!facet || !rawValue.trim()) continue
    const value = LEGACY_VALUES[facet]?.[rawValue] ?? rawValue.trim()
    ;(filters[facet] ??= new Set()).add(value)
  }
  for (const f of FACETS) if (filters[f]) q.filters[f] = [...filters[f]]
  q.text = params.get('q') ?? ''
  const sort = params.get('sort') as SortKey | null
  q.sort = sort && SORT_KEYS.includes(sort) ? sort : q.text ? 'relevance' : 'recent'
  const page = Number(params.get('page'))
  if (Number.isInteger(page) && page > 1) q.page = page
  const size = Number(params.get('per_page'))
  if ((PAGE_SIZES as readonly number[]).includes(size)) q.pageSize = size
  return q
}

export function toSearchParams(q: CatalogueQuery): URLSearchParams {
  const p = new URLSearchParams()
  for (const f of FACETS) for (const v of q.filters[f] ?? []) p.append(f, v)
  if (q.text.trim()) p.set('q', q.text.trim())
  const defaultSort: SortKey = q.text.trim() ? 'relevance' : 'recent'
  if (q.sort !== defaultSort) p.set('sort', q.sort)
  if (q.page > 1) p.set('page', String(q.page))
  if (q.pageSize !== 10) p.set('per_page', String(q.pageSize))
  return p
}

export function activeFilters(q: CatalogueQuery): { facet: FacetKey; value: string }[] {
  return FACETS.flatMap((facet) => (q.filters[facet] ?? []).map((value) => ({ facet, value })))
}

export function toggleFilter(q: CatalogueQuery, facet: FacetKey, value: string): CatalogueQuery {
  const current = q.filters[facet] ?? []
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  return { ...q, page: 1, filters: { ...q.filters, [facet]: next } }
}
