/**
 * Port: landscape pages (profiles published by mosaic-catalog, served by mosaic-api with the data
 * status of each landscape). Separate from CatalogRepository (interface segregation): the catalogue
 * pages do not need it. Both adapters (static, live) implement both ports.
 */
import type { LandscapePage, LandscapeSummary } from '../api/types'

export interface LandscapeRepository {
  landscapes(): Promise<LandscapeSummary[]>
  /** code or slug, any case; null when there is no such landscape */
  landscape(codeOrSlug: string): Promise<LandscapePage | null>
}
