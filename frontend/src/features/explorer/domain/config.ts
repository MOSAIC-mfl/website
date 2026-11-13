/**
 * The map explorer configuration, as published in a landscape profile (mosaic-catalog:
 * landscapes/<CODE>/explorer.yaml, schema/landscape/explorer.schema.json).
 *
 * The catalogue validates the documents when it builds; `parseExplorerConfig` only checks what the
 * website relies on, so a malformed profile fails with a readable message instead of a broken map.
 * Each renderer and inspector reads its own options from its config block (see `options.ts`).
 */

export type LngLatTuple = [number, number]

export interface Camera {
  lng: number
  lat: number
  zoom?: number
  pitch?: number
  bearing?: number
  /** [west, south, east, north]: frame this box (lng/lat stay its centre, for the URL and jumps) */
  bounds?: [number, number, number, number]
  /** share of the visible map the box fills (default 0.6) */
  fill?: number
}

/** A chip under a chapter: switches the layer (and its time), highlights a feature, moves the map. */
export interface ChapterStep {
  label: string
  camera?: Camera
  layer?: string
  time?: Record<string, string | number>
  focus?: string
}

export type AssetRef = { asset: string } | { pmtiles: string }

export interface DataRoute {
  prefix?: string
  path?: string
  root: string
}

export interface DataConfig {
  roots: Record<string, string>
  default_root: string
  routes?: DataRoute[]
  withheld?: string[]
  withheld_reason?: string
  tiles_version?: string
  report?: string
}

/** A MapLibre source or layer, with {asset}/{pmtiles} references still to resolve. */
export type StyleSourceSpec = { type: string } & Record<string, unknown>
export type StyleLayerSpec = { id: string; type: string; source?: string } & Record<string, unknown>

export interface MapConfig {
  center: LngLatTuple
  zoom: number
  pitch?: number
  bearing?: number
  min_zoom?: number
  max_zoom?: number
  max_pitch?: number
  max_bounds?: [LngLatTuple, LngLatTuple]
  sky?: Record<string, unknown>
  glyphs?: string
  terrain?: { source: string; exaggeration?: number; min?: number; max?: number; step?: number }
  attribution?: string
  sources: Record<string, StyleSourceSpec>
  layers: StyleLayerSpec[]
}

export interface RailItemConfig {
  id: string
  group: string
  title: string
  swatch?: string
  source_ref?: string
  record?: string
  attribution?: string
}

export interface ToggleConfig extends RailItemConfig {
  default?: boolean
  layers: string[]
}

/** Options of a module (renderer, inspector, panel): free keys read by that module. */
export type ModuleOptions = { kind: string } & Record<string, unknown>

export type PanelConfig = RailItemConfig & ModuleOptions & { open_on_click?: string }

export interface LegendClass {
  value?: number
  name: string
  rgb?: [number, number, number]
  color?: string
}

export type LegendConfig =
  | { kind: 'steps'; title: string; colors: string[]; labels: string[]; notes?: string[]; source?: string }
  | { kind: 'classes'; title: string; classes: LegendClass[]; notes?: string[]; source?: string }

export interface VariantConfig {
  id: string
  label: string
  asset: string
  legend?: LegendConfig
}

export type OverlayConfig = RailItemConfig &
  ModuleOptions & {
    before?: string
    legend?: LegendConfig
    inspect?: ModuleOptions
    variants?: VariantConfig[]
  }

export interface ClickConfig {
  title?: string
  source?: string
  admin?: {
    layers: string[]
    visible_layer?: string
    units?: Record<string, [string, string]>
    /** property holding the unit's name in each layer (default `name`) */
    name_fields?: [string, string]
    /** when the layers carry no country / iso properties (one-country landscapes) */
    country?: string
    iso?: string
  }
}

export interface ChapterVisual {
  type?: string
  layers?: string[]
  camera?: Camera
  time?: Record<string, string | number>
  show?: string[]
  charts?: ModuleOptions[]
  figure?: string
  alt?: string
  steps?: ChapterStep[]
  /** the feature the chapter is about (story.map.focus: which layers, which field) */
  focus?: string
  note?: string
  pending_note?: string
  exposure?: Record<string, unknown>
  action?: string
  compare?: { overlay: string; left_label?: string; right_label?: string }
}

export interface StoryNumber {
  value: string
  label: string
  source?: { kind: 'study' | 'app'; citation?: string; page?: string; method?: string }
}

export interface Chapter {
  id: string
  title: string
  text: string
  status?: 'ready' | 'pending' | 'provisional' | null
  placeholder?: string
  visual?: ChapterVisual
  numbers?: StoryNumber[]
  sources?: string[]
}

export interface StoryConfig {
  title: string
  note?: string
  map?: {
    sources?: Record<string, StyleSourceSpec>
    layers?: StyleLayerSpec[]
    while_open?: string[]
    highlights?: Record<string, string[]>
    /** layers drawn only around one feature (`visual.focus` / a step's `focus`): `field` == the value */
    focus?: { layers: string[]; field: string }
  }
  chapters: Chapter[]
}

export interface StudyCard {
  id: string
  question: string
  kind: 'published' | 'explore'
  finding?: string
  caveat?: string
  citation?: string
  doi?: string
  layers?: string[]
  open_panel?: string
  camera?: Camera
  time?: Record<string, string | number>
  /** buttons instead of "Show me on the map": the same layer at two dates, ... */
  steps?: { label: string; layer?: string; time?: Record<string, string | number>; camera?: Camera }[]
  /** what the map shows for this card (e.g. context only, not the study's data) */
  map_note?: string
  /** why no layer is shown */
  data_note?: string
}

export interface StudiesConfig {
  note?: string
  cards: StudyCard[]
}

export interface SourceEntry {
  id: string
  title: string
  source?: string
  period?: string
  units?: string
  licence?: string
  citation?: string
  attribution?: string
  caveats?: string
  placeholder?: boolean
  record?: string | null
}

export interface ExplorerConfig {
  title: string
  tagline?: string
  data: DataConfig
  map: MapConfig
  groups: string[]
  toggles: ToggleConfig[]
  panels: PanelConfig[]
  click: ClickConfig
  overlays: OverlayConfig[]
  story: StoryConfig | null
  studies: StudiesConfig | null
  about: { intro?: string; licence?: string; sources: SourceEntry[] }
}

export class ConfigError extends Error {
  constructor(where: string, problem: string) {
    super(`Explorer configuration, ${where}: ${problem}`)
    this.name = 'ConfigError'
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

function need<T>(ok: boolean, value: T, where: string, problem: string): T {
  if (!ok) throw new ConfigError(where, problem)
  return value
}

function list<T>(v: unknown, where: string, check: (item: unknown, at: string) => T): T[] {
  if (v == null) return []
  need(Array.isArray(v), v, where, 'must be a list')
  return (v as unknown[]).map((item, i) => check(item, `${where}[${i}]`))
}

function railItem<T extends RailItemConfig>(v: unknown, at: string, groups: string[]): T {
  need(isObject(v), v, at, 'must be a mapping')
  const o = v as Record<string, unknown>
  need(typeof o.id === 'string' && o.id.length > 0, o, at, 'needs an id')
  need(typeof o.title === 'string', o, `${at} (${o.id})`, 'needs a title')
  need(groups.includes(String(o.group)), o, `${at} (${o.id})`, `group '${String(o.group)}' is not in groups`)
  return o as unknown as T
}

/** Checks the parts the website relies on and fills the optional lists. */
export function parseExplorerConfig(raw: unknown): ExplorerConfig {
  need(isObject(raw), raw, 'root', 'must be a mapping')
  const r = raw as Record<string, unknown>
  const data = need(isObject(r.data), r.data, 'data', 'missing') as unknown as DataConfig
  need(isObject(data.roots) && data.default_root in data.roots, data, 'data', 'default_root must name one of roots')
  const map = need(isObject(r.map), r.map, 'map', 'missing') as unknown as MapConfig
  need(Array.isArray(map.center) && map.center.length === 2, map, 'map.center', 'must be [lng, lat]')
  need(Array.isArray(map.layers) && map.layers.length > 0, map, 'map.layers', 'needs at least one layer')
  need(isObject(map.sources), map, 'map.sources', 'must be a mapping')
  const groups = list(r.groups, 'groups', (g, at) => need(typeof g === 'string', String(g), at, 'must be text'))
  const overlays = list(r.overlays, 'overlays', (o, at) => {
    const ov = railItem<OverlayConfig>(o, at, groups)
    return need(typeof ov.kind === 'string', ov, `${at} (${ov.id})`, 'needs a kind')
  })
  const ids = [...overlays.map((o) => o.id)]
  const toggles = list(r.toggles, 'toggles', (t, at) => {
    const tg = railItem<ToggleConfig>(t, at, groups)
    return need(Array.isArray(tg.layers), tg, `${at} (${tg.id})`, 'needs layers')
  })
  const panels = list(r.panels, 'panels', (p, at) => {
    const pn = railItem<PanelConfig>(p, at, groups)
    return need(typeof pn.kind === 'string', pn, `${at} (${pn.id})`, 'needs a kind')
  })
  ids.push(...toggles.map((t) => t.id), ...panels.map((p) => p.id))
  const dup = ids.find((id, i) => ids.indexOf(id) !== i)
  need(dup === undefined, null, 'rail', `id '${dup}' is used twice`)
  const story = isObject(r.story) && Array.isArray(r.story.chapters) ? (r.story as unknown as StoryConfig) : null
  const studies = isObject(r.studies) && Array.isArray(r.studies.cards) ? (r.studies as unknown as StudiesConfig) : null
  const about = isObject(r.about) ? r.about : {}
  return {
    title: need(typeof r.title === 'string', String(r.title), 'title', 'missing'),
    tagline: typeof r.tagline === 'string' ? r.tagline : undefined,
    data,
    map,
    groups,
    toggles,
    panels,
    click: isObject(r.click) ? (r.click as ClickConfig) : {},
    overlays,
    story,
    studies,
    about: {
      intro: typeof about.intro === 'string' ? about.intro : undefined,
      licence: typeof about.licence === 'string' ? about.licence : undefined,
      sources: Array.isArray(about.sources) ? (about.sources as SourceEntry[]) : [],
    },
  }
}
