import type { Dataset } from './types'

export interface FilterState {
  country: string[]
  living_landscape: string[]
  mfl_theme: string[]
  readiness_status: string[]
  data_type: string[]
  access_level: string[]
  license: string[]
}

/**
 * One filter facet against one dataset field.
 *
 * Several catalogue fields are nullable, because a record may legitimately not
 * carry a country, theme, type, access level or licence. A dataset with no
 * value for a facet cannot be one of the selected values, so an active filter
 * excludes it; with no filter selected, everything passes.
 */
function matchesFacet(selected: string[], value: string | null): boolean {
  if (selected.length === 0) return true
  return value !== null && selected.includes(value)
}

export function filterDatasets(datasets: Dataset[], filters: FilterState): Dataset[] {
  return datasets.filter(
    (d) =>
      matchesFacet(filters.country, d.country) &&
      matchesFacet(filters.living_landscape, d.living_landscape) &&
      matchesFacet(filters.mfl_theme, d.mfl_theme) &&
      matchesFacet(filters.readiness_status, d.readiness_status) &&
      matchesFacet(filters.data_type, d.data_type) &&
      matchesFacet(filters.access_level, d.access_level) &&
      matchesFacet(filters.license, d.license),
  )
}

export function emptyFilters(): FilterState {
  return {
    country: [],
    living_landscape: [],
    mfl_theme: [],
    readiness_status: [],
    data_type: [],
    access_level: [],
    license: [],
  }
}
