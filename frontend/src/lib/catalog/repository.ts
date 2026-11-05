/**
 * Port: what the website needs from the catalogue. Pages and components depend on this interface
 * only; StaticCatalogRepository (GitHub Pages files) and LiveCatalogRepository (running API)
 * implement it. Adding another back end (a CDN, a mock for tests) means one more class, no UI change.
 */
import type { FacetCounts, FiltersInfo, ResourceDetail, ResourceSummary, SourceInfo } from '../api/types'
import type { LabelBook } from '../domain/labels'
import type { CatalogueQuery } from '../domain/query'
import type { SearchResult } from '../domain/search'

export interface CatalogueOverview {
  /** GET /v1/filters: versions, totals, filter options. */
  info: FiltersInfo
  sources: SourceInfo[]
  /** Counts per facet value over the whole catalogue. */
  facets: FacetCounts
  labels: LabelBook
}

export interface CatalogRepository {
  overview(): Promise<CatalogueOverview>
  search(query: CatalogueQuery): Promise<SearchResult>
  /** null when the resource does not exist. */
  get(id: string): Promise<ResourceDetail | null>
  /** The resource as JSON, straight from the API. */
  recordLink(detail: ResourceDetail): string
  /** Resources sharing landscape or theme with `detail`, best matches first. */
  related(detail: ResourceDetail, limit: number): Promise<ResourceSummary[]>
}
