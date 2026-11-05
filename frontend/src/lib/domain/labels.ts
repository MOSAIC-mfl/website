/**
 * Display labels for filter values, and the reverse: turning what someone typed or linked
 * ('Perú', 'Pressures / drivers', 'cc by 4.0') into the canonical value (PER, pressures-drivers,
 * CC-BY-4.0). Same resolution as mosaic-api `CatalogService.resolve_filters`.
 */
import type { FacetCounts, FiltersInfo, Labels } from '../api/types'
import { FACETS, type FacetKey, type Filters, NOT_SPECIFIED } from './facets'
import { key } from './text'

/** Counts per filter value over the whole catalogue, from GET /v1/filters. */
export function catalogueCounts(info: FiltersInfo): FacetCounts {
  const out: FacetCounts = {}
  for (const [facet, options] of Object.entries(info.filters)) {
    out[facet] = Object.fromEntries(options.map((o) => [o.value, o.count]))
  }
  return out
}

export class LabelBook {
  /** Labels of the filter options and of the other coded values, from GET /v1/filters. */
  static fromFilters(info: FiltersInfo): LabelBook {
    const labels: Labels = { ...info.labels }
    for (const [facet, options] of Object.entries(info.filters)) {
      labels[facet] = Object.fromEntries(options.map((o) => [o.value, o.label]))
    }
    return new LabelBook(labels, catalogueCounts(info))
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
