/**
 * Display labels for filter values, and the reverse: turning what someone typed or linked
 * ('Perú', 'Pressures / drivers', 'cc by 4.0') into the canonical value (PER, pressures-drivers,
 * CC-BY-4.0). Same resolution as mosaic-api `CatalogService.resolve_filters`.
 */
import type { FacetCounts, Labels, SourceInfo } from '../api/types'
import { FACETS, type FacetKey, type Filters, NOT_SPECIFIED } from './facets'
import { key } from './text'
import { VOCAB_LABELS } from './vocab-labels'

/** Labels of values that are not in a vocabulary (as mosaic-api FIXED_LABELS). */
const FIXED_LABELS: Labels = {
  spatial: { yes: 'Spatial', no: 'Not spatial' },
  geometry: { point: 'Points', line: 'Lines', polygon: 'Polygons', mixed: 'Mixed' },
  license: { other: 'Other licence' },
  processing_status: { not_specified: 'Not stated' },
}

export class LabelBook {
  /**
   * The website's own labels (the API has no filters endpoint): the standard's vocabularies
   * (vocab-labels.ts), fixed labels, and the catalogue names from GET /v1/sources. `counts` are the
   * values present in the catalogue, so a value typed or linked by its code is always known.
   */
  static of(sources: SourceInfo[], counts: FacetCounts = {}): LabelBook {
    const labels: Labels = { ...VOCAB_LABELS, source: Object.fromEntries(sources.map((s) => [s.id, s.name])) }
    for (const [facet, fixed] of Object.entries(FIXED_LABELS)) labels[facet] = { ...labels[facet], ...fixed }
    return new LabelBook(labels, counts)
  }

  private readonly aliases: Record<string, Map<string, string>> = {}

  constructor(
    private readonly labels: Labels,
    known: FacetCounts = {},
  ) {
    for (const facet of FACETS) {
      const map = new Map<string, string>()
      for (const value of Object.keys(known[facet] ?? {})) map.set(key(value), value)
      for (const [value, label] of Object.entries(labels[facet] ?? {})) {
        if (!map.has(key(value))) map.set(key(value), value)
        if (!map.has(key(label))) map.set(key(label), value)
      }
      this.aliases[facet] = map
    }
  }

  label(facet: FacetKey | string, value: string): string {
    return this.labels[facet]?.[value] ?? (value === NOT_SPECIFIED ? 'Not specified' : value)
  }

  /** Canonical values, plus a warning for each value that matches nothing known. */
  resolve(filters: Filters): { filters: Filters; warnings: string[] } {
    const out: Filters = {}
    const warnings: string[] = []
    for (const facet of FACETS) {
      const values = filters[facet]
      if (!values?.length) continue
      out[facet] = values.map((v) => {
        const canon = this.aliases[facet]?.get(key(v))
        if (canon === undefined) warnings.push(`${facet}='${v}' matches no value of this filter`)
        return canon ?? v
      })
    }
    return { filters: out, warnings }
  }
}
