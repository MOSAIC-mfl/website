/**
 * How resources are shown: small pure helpers shared by the cards, the detail page and the home page.
 * They turn MOSAIC values into the words the approved design uses.
 */
import type { RecordSummary } from '../api/types'
import type { LabelBook } from './labels'
import { NOT_SPECIFIED } from './facets'

/** Data type of a resource for its icon: the approved icons are Raster / Vector / Tabular / Mixed. */
export type DataTypeIcon = 'Raster' | 'Vector' | 'Tabular' | 'Mixed' | null

export function dataTypeIcon(kinds: string[] = []): DataTypeIcon {
  const k = kinds.filter((x) => x !== NOT_SPECIFIED)
  if (k.length === 0) return null
  if (k.length > 1 || k[0] === 'mixed') return 'Mixed'
  return ({ raster: 'Raster', vector: 'Vector', tabular: 'Tabular' } as const)[k[0] as 'raster'] ?? 'Mixed'
}

export function periodText(period: (number | null)[] | null | undefined): string | null {
  if (!period) return null
  const [start, end] = period
  if (start && end) return start === end ? `${start}` : `${start}–${end}`
  if (start) return `${start} onwards`
  if (end) return `until ${end}`
  return null
}

export const ACCESS_LABEL: Record<string, string> = { public: 'Open', restricted: 'Restricted', 'non-public': 'Not public' }
export const ACCESS_BADGE: Record<string, string> = {
  public: 'badge badge-open',
  restricted: 'badge badge-restricted',
  'non-public': 'badge badge-internal',
}

export function joinLabels(book: LabelBook, facet: string, values: string[], max = 3): string | null {
  const shown = values.filter((v) => v !== NOT_SPECIFIED).slice(0, max).map((v) => book.label(facet, v))
  if (shown.length === 0) return null
  const rest = values.length - shown.length
  return rest > 0 ? `${shown.join(', ')} +${rest}` : shown.join(', ')
}

/** URL of a resource's page on this site. */
export function datasetHref(base: string, id: string): string {
  // ':' is valid in a query string; keeping it makes the link readable (…?id=mosaic:MFL-2026-079).
  return `${base}/catalogue/dataset/?id=${encodeURIComponent(id).replace(/%3A/gi, ':')}`
}

export function primarySpecs(r: RecordSummary, book: LabelBook): string[] {
  const kinds = joinLabels(book, 'data_kind', r.facets.data_kind ?? [])
  const geometry = joinLabels(book, 'geometry', r.facets.geometry ?? [])
  return [kinds, geometry, periodText(r.period)].filter((x): x is string => !!x)
}
