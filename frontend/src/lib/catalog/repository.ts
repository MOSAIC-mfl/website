/**
 * Port: what the website needs from the catalogue. Pages and components depend on this interface
 * only; StaticCatalogRepository (GitHub Pages files) and LiveCatalogRepository (running API)
 * implement it. Adding another back end (a CDN, a mock for tests) means one more class, no UI change.
 */
import type { FacetCounts, Manifest, ResourceDetail, ResourceSummary, SourceInfo } from '../api/types'
import type { LabelBook } from '../domain/labels'
import type { CatalogueQuery } from '../domain/query'
import type { SearchResult } from '../domain/search'

export interface CatalogueOverview {
  manifest: Manifest
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
  /** Machine-readable versions of a resource (MOSAIC JSON, schema.org JSON-LD). */
  recordLinks(detail: ResourceDetail): { json: string; jsonld: string }
  /** Resources sharing landscape or theme with `detail`, best matches first. */
  related(detail: ResourceDetail, limit: number): Promise<ResourceSummary[]>
}
