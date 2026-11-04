/**
 * Section kinds a landscape page can contain. A new kind (e.g. an action hub, a hotspot analysis) is a
 * component registered here; profiles then name it in their sections. Unknown kinds are skipped with a
 * note, so a profile written for a newer website still opens.
 */
import { DataStatusSection } from './DataStatus'
import { DatasetsSection } from './Datasets'
import { MapExplorerSection } from './MapExplorer'
import { OverviewSection } from './Overview'
import type { SectionModule } from './types'

const SECTIONS: Record<string, SectionModule> = {
  overview: OverviewSection,
  'map-explorer': MapExplorerSection,
  'catalogue-datasets': DatasetsSection,
  'data-status': DataStatusSection,
}

export function sectionModule(kind: string): SectionModule | null {
  return SECTIONS[kind] ?? null
}

/** sections drawn edge to edge (no page container) */
export const FULL_WIDTH = new Set(['map-explorer'])
