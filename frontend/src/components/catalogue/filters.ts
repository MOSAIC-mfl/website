import type { FacetKey } from '../../lib/domain/facets'

export interface FilterDef {
  key: FacetKey
  label: string
}

/** The four filters of the API (GET /v1/records), shown open as in the approved design. */
export const PRIMARY_FILTERS: FilterDef[] = [
  { key: 'geography', label: 'Country' },
  { key: 'landscape', label: 'Living Landscape' },
  { key: 'theme', label: 'Theme' },
  { key: 'source', label: 'Catalogue' },
]
