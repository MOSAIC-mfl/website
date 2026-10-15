export type Country =
  | 'Cambodia'
  | 'Colombia'
  | "Côte d'Ivoire"
  | 'Ethiopia'
  | 'Global'
  | 'India'
  | 'Kenya'
  | 'Laos'
  | 'Peru'
  | 'Senegal'
  | 'Tanzania'
  | 'Tunisia'
  | 'Vietnam'
  | 'Zimbabwe'

// Canonical living-landscape codes (approved 2026-07-21).
// 'GLB' is not a landscape: it is the special value carried by
// global / cross-landscape datasets.
export type Landscape =
  | 'COL-CUM'
  | 'PER-PCL'
  | 'SEN-FK'
  | 'CIV-NZ'
  | 'TUN-NW'
  | 'ETH-OG'
  | 'KEN-LVB'
  | 'KEN-LEI'
  | 'ZWE-MB'
  | 'IND-CH'
  | 'MEK-3S'
  | 'GLB'

// How much of the world a dataset actually covers, relative to the
// landscape collection it is published under.
export type Coverage = 'landscape' | 'national' | 'global'

export type MflTheme =
  | 'Boundaries / admin units'
  | 'Land cover / land use'
  | 'Ecosystem condition'
  | 'Degradation / land health'
  | 'Water / hydrology'
  | 'Biodiversity / ecosystems'
  | 'Pressures / drivers'
  | 'Ecosystem services'
  | 'Hotspots / leverage points'
  | 'Scenarios / future risks'
  | 'Decision-support outputs'
  | 'Agrobiodiversity / crops'
  | 'Socio-economic / livelihoods'

export type DataType = 'Raster' | 'Vector' | 'Tabular' | 'Mixed'

export type AccessLevel = 'Open' | 'Internal' | 'Restricted'

export type ReadinessStatus = 'Raw' | 'Processed' | 'Validated'

export interface Dataset {
  // Always present
  id: string
  title: string
  living_landscape: Landscape
  readiness_status: ReadinessStatus

  // Added by the catalog pipeline (2026-07): display name for the
  // living_landscape code, true coverage, and the landscape centroid
  // [lon, lat] (EPSG:4326) used by the locator map.
  landscape_name?: string
  coverage?: Coverage
  centroid?: number[] | null

  // Controlled-vocabulary fields — may be null for incomplete / flagged records
  country: Country | null
  mfl_theme: MflTheme | null
  data_type: DataType | null
  access_level: AccessLevel | null
  license: string | null

  // Optional descriptive fields
  description?: string | null
  formats?: string[]
  source?: string | null
  contact?: string | null
  spatial_resolution?: string | null
  temporal_coverage?: string | null
  download_url?: string | null
  metadata_url?: string | null
  citation?: string | null
  // Earth Engine asset identifier (MOSAIC's own STAC field
  // mosaic:gee_asset_id). An id, not a URL: the assets are private.
  gee_asset_id?: string | null
}
