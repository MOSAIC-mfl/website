/**
 * What the Landscapes page shows about each landscape's data, worked out from mosaic-api
 * (`GET /v1/landscapes` and `GET /v1/landscapes/{code}`). Pure functions: no fetch, no DOM.
 *
 *  - the dataset count of every landscape (the selector list, the pins, the badge);
 *  - whether a landscape has a map profile (the "Map visualization" section);
 *  - data coverage: which of the standard's themes have at least one dataset, and how many
 *    datasets are public (the ring and the open-access figure of "Key insights").
 */
import type { DataStatus, LandscapeSummary } from '../api/types'

/** Section kind of a profile's map explorer (mosaic-catalog profiles, mosaic-api SectionOut.kind). */
export const MAP_SECTION = 'map-explorer'

/** Access value counted as open access (standard vocabulary `access`). */
export const OPEN_ACCESS = 'public'

export interface ThemeCoverage {
  id: string
  label: string
  hasData: boolean
}

export interface LandscapeInsights {
  count: number
  /** Every theme of the standard, in vocabulary order, with or without data here. */
  themes: ThemeCoverage[]
  withData: number
  missing: string[]
  open: number
}

export interface LandscapeIndexEntry {
  count: number
  hasMap: boolean
}

export function hasMapProfile(l: Pick<LandscapeSummary, 'sections'>): boolean {
  return l.sections.some((s) => s.kind === MAP_SECTION)
}

/** One entry per landscape code: dataset count and map profile. */
export function landscapeIndex(list: Pick<LandscapeSummary, 'code' | 'counts' | 'sections'>[]): Map<string, LandscapeIndexEntry> {
  return new Map(list.map((l) => [l.code, { count: l.counts.datasets ?? 0, hasMap: hasMapProfile(l) }]))
}

/**
 * Coverage of one landscape. `themeLabels` is the standard's theme vocabulary ({id: label}); its
 * order is the order of the list of missing themes. Themes outside the vocabulary are ignored.
 */
export function landscapeInsights(
  status: Pick<DataStatus, 'total' | 'by_theme' | 'by_access'>,
  themeLabels: Record<string, string>,
): LandscapeInsights {
  const themes = Object.entries(themeLabels).map(([id, label]) => ({ id, label, hasData: (status.by_theme[id] ?? 0) > 0 }))
  return {
    count: status.total,
    themes,
    withData: themes.filter((t) => t.hasData).length,
    missing: themes.filter((t) => !t.hasData).map((t) => t.label),
    open: status.by_access[OPEN_ACCESS] ?? 0,
  }
}

/** Codes ordered as the selector lists them: most datasets first, then by name. */
export function byDatasetCount<T extends { code: string; name: string }>(items: T[], index: Map<string, LandscapeIndexEntry>): T[] {
  const n = (code: string) => index.get(code)?.count ?? 0
  return [...items].sort((a, b) => n(b.code) - n(a.code) || a.name.localeCompare(b.name))
}

export const datasetWord = (n: number): string => (n === 1 ? 'dataset' : 'datasets')
