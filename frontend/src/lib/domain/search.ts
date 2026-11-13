/**
 * In-browser search over the static export — the same rules as mosaic-api `domain/search.py`:
 *  - words: every folded word of the query appears in the folded searchable text;
 *  - filters: OR inside a facet, AND across facets, compared with `key()`;
 *  - relevance: +3 per word in the title, +1 per word (the API also gives +2 for keywords; the
 *    static summaries carry no keywords, so the order of equally good hits may differ slightly).
 * Pure functions: no fetch, no DOM, no React.
 */
import type { FacetCounts, RecordSummary } from '../api/types'
import { FACETS, type Filters } from './facets'
import { SORT_TO_API, type CatalogueQuery } from './query'
import { fold, key } from './text'

export interface SearchResult {
  items: RecordSummary[]
  total: number
  /** Counts per facet value over ALL matching resources (not only this page). */
  facets: FacetCounts
  warnings: string[]
}

export function matches(r: RecordSummary, words: string[], filters: Filters, text: string): boolean {
  if (words.length && !words.every((w) => text.includes(w))) return false
  for (const facet of FACETS) {
    const wanted = filters[facet]
    if (!wanted?.length) continue
    const have = new Set((r.facets[facet] ?? []).map(key))
    if (!wanted.some((w) => have.has(key(w)))) return false
  }
  return true
}

function score(r: RecordSummary, words: string[]): number {
  const title = fold(r.title)
  return words.reduce((s, w) => s + 1 + (title.includes(w) ? 3 : 0), 0)
}

const endYear = (r: RecordSummary) => r.period?.[1] ?? r.period?.[0] ?? 0

export function countFacets(items: RecordSummary[]): FacetCounts {
  const out: FacetCounts = {}
  for (const facet of FACETS) out[facet] = {}
  for (const r of items) {
    for (const facet of FACETS) {
      for (const v of r.facets[facet] ?? []) out[facet][v] = (out[facet][v] ?? 0) + 1
    }
  }
  return out
}

export function search(
  all: RecordSummary[],
  texts: Record<string, string>,
  q: CatalogueQuery,
  warnings: string[] = [],
): SearchResult {
  const words = fold(q.text).split(' ').filter(Boolean)
  const hits = all.filter((r) => matches(r, words, q.filters, texts[r.id] ?? fold(r.title)))
  const { sort, order } = SORT_TO_API[q.sort]
  const dir = order === 'desc' ? -1 : 1
  const byTitle = (a: RecordSummary, b: RecordSummary) => fold(a.title).localeCompare(fold(b.title))
  if (sort === 'relevance') hits.sort((a, b) => score(b, words) - score(a, words) || byTitle(a, b))
  else if (sort === 'title') hits.sort((a, b) => dir * byTitle(a, b))
  else hits.sort((a, b) => dir * (endYear(a) - endYear(b)) || byTitle(a, b))
  const start = (q.page - 1) * q.pageSize
  return { items: hits.slice(start, start + q.pageSize), total: hits.length, facets: countFacets(hits), warnings }
}
