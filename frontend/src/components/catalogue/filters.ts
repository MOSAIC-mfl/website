import type { FacetKey } from '../../lib/domain/facets'

export interface FilterDef {
  key: FacetKey
  label: string
}

/** Shown open, as in the approved design. */
export const PRIMARY_FILTERS: FilterDef[] = [
  { key: 'geography', label: 'Country' },
  { key: 'landscape', label: 'Living Landscape' },
  { key: 'theme', label: 'Theme' },
  { key: 'source', label: 'Catalogue' },
]

/** Behind "More filters". */
export const MORE_FILTERS: FilterDef[] = [
  { key: 'data_kind', label: 'Data Type' },
  { key: 'geometry', label: 'Geometry' },
  { key: 'spatial', label: 'Spatial' },
  { key: 'method', label: 'Access Method' },
  { key: 'access', label: 'Access Level' },
  { key: 'license', label: 'License' },
  { key: 'status', label: 'Metadata' },
]
