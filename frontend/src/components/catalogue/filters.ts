import type { FacetKey } from '../../lib/domain/facets'

export interface FilterDef {
  key: FacetKey
  label: string
}

/** Shown first, as in the approved design (Lizeth's catalogue). */
export const PRIMARY_FILTERS: FilterDef[] = [
  { key: 'geography', label: 'Country' },
  { key: 'landscape', label: 'Living Landscape' },
  { key: 'theme', label: 'Theme' },
  { key: 'processing_status', label: 'Readiness Status' },
]

/** Behind "More filters". Catalogue tells MOSAIC's own records from those of connected catalogues. */
export const MORE_FILTERS: FilterDef[] = [
  { key: 'data_kind', label: 'Data Type' },
  { key: 'access', label: 'Access Level' },
  { key: 'license', label: 'License' },
  { key: 'source', label: 'Catalogue' },
]
