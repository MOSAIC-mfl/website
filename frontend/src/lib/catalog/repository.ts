/**
 * Port: what the website needs from the catalogue. Pages and components depend on this interface
 * only; StaticCatalogRepository (GitHub Pages files) and LiveCatalogRepository (running API)
 * implement it. Adding another back end (a CDN, a mock for tests) means one more class, no UI change.
 */
import type { FacetCounts, RecordDetail, RecordSummary, SourceInfo } from '../api/types'
import type { LabelBook } from '../domain/labels'
import type { CatalogueQuery } from '../domain/query'
import type { SearchResult } from '../domain/search'

export interface CatalogueOverview {
  /** Records in the whole catalogue. */
  total: number
  sources: SourceInfo[]
  /** Counts per facet value over the whole catalogue. */
  facets: FacetCounts
  labels: LabelBook
}

export interface CatalogRepository {
  overview(): Promise<CatalogueOverview>
  search(query: CatalogueQuery): Promise<SearchResult>
  /** null when the record does not exist. */
  get(id: string): Promise<RecordDetail | null>
  /** The record as JSON, straight from the API. */
  recordLink(detail: RecordDetail): string
  /** Records sharing landscape or theme with `detail`, best matches first. */
  related(detail: RecordDetail, limit: number): Promise<RecordSummary[]>
}
