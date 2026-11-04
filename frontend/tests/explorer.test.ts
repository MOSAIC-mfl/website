/**
 * Map explorer: pure rules (assets, configuration, geometry, series, URL hash, legends), chart
 * builders, renderers and the controller against a fake map engine and fake data. No browser.
 */
import { describe, expect, it } from 'vitest'
import lvb from './fixtures-landscape-ken-lvb.json'
import { CORE_CHART_BUILDERS } from '../src/features/explorer/application/chart-builders'
import { ExplorerController } from '../src/features/explorer/application/explorer'
import { AssetRouter, EMPTY_COLLECTION } from '../src/features/explorer/domain/assets'
import { ConfigError, parseExplorerConfig, type ExplorerConfig } from '../src/features/explorer/domain/config'
import { formatHash, parseHash } from '../src/features/explorer/domain/hash'
import { pointInPolygon, toUtm } from '../src/features/explorer/domain/geo'
import { legendFrom } from '../src/features/explorer/domain/legend'
import { Options } from '../src/features/explorer/domain/options'
import { classify, monthRange, monthlyMeans, seasonalTotals, yearLabels } from '../src/features/explorer/domain/series'
import type { DataSource, GridStack, RasterFile } from '../src/features/explorer/ports/data'
import type { CompareOptions, MapClick, MapEngine } from '../src/features/explorer/ports/map-engine'
import { coreRegistry } from '../src/features/explorer/renderers/registry'

const explorerSection = (lvb as { sections: { kind: string; config?: unknown }[] }).sections.find((s) => s.kind === 'map-explorer')!
const config: ExplorerConfig = parseExplorerConfig(explorerSection.config)

// ---- fakes ----------------------------------------------------------------------------------------
class FakeEngine implements MapEngine {
  ready = Promise.resolve()
  layers = new Map<string, { visible: boolean; before?: string }>()
  sources = new Set<string>()
  flights: unknown[] = []
  clickHandler: ((e: MapClick) => void) | null = null
  addSource(id: string) {
    this.sources.add(id)
  }
  addLayer(spec: { id: string; layout?: unknown }, before?: string) {
    const vis = (spec.layout as { visibility?: string } | undefined)?.visibility !== 'none'
    if (!this.layers.has(spec.id)) this.layers.set(spec.id, { visible: vis, before })
  }
  hasLayer(id: string) {
    return this.layers.has(id)
  }
  setVisible(id: string, v: boolean) {
    const l = this.layers.get(id)
    if (l) l.visible = v
  }
  isVisible(id: string) {
    return !!this.layers.get(id)?.visible
  }
  setGeoJSON() {}
  queryAt() {
    return []
  }
  project() {
    return { x: 10, y: 20 }
  }
  onClick(h: (e: MapClick) => void) {
    this.clickHandler = h
    return () => {}
  }
  onLayerClick() {
    return () => {}
  }
  flyTo(c: unknown) {
    this.flights.push(c)
  }
  jumpTo() {}
  setPadding() {}
  containerHeight() {
    return 600
  }
  hasTerrain() {
    return true
  }
  setTerrainExaggeration() {}
  comparing = false
  async compare(_o: CompareOptions) {
    this.comparing = true
  }
  closeCompare() {
    this.comparing = false
  }
  isComparing() {
    return this.comparing
  }
  destroy() {}
  visible() {
    return [...this.layers.entries()].filter(([, l]) => l.visible).map(([id]) => id)
  }
}

class FakeData implements DataSource {
  constructor(private readonly files: Record<string, unknown> = {}) {}
  url(path: string) {
    return `https://data.example/${path}`
  }
  async json<T>(path: string): Promise<T> {
    if (!(path in this.files)) throw new Error(`missing ${path}`)
    return this.files[path] as T
  }
  async bytes(): Promise<ArrayBuffer> {
    return new ArrayBuffer(0)
  }
  async raster(path: string): Promise<RasterFile> {
    const r = this.files[path] as RasterFile | undefined
    if (!r) throw new Error(`missing ${path}`)
    return r
  }
  async grid(): Promise<GridStack> {
    throw new Error('no grid')
  }
}

const controller = (files: Record<string, unknown> = {}) => {
  const engine = new FakeEngine()
  for (const layer of config.map.layers) engine.addLayer(layer) // the base style
  const assets = new AssetRouter(config.data)
  const registry = coreRegistry()
  registry.registerInspector('flood-query', () => ({ inspect: async () => ({ target: 'popover', title: 'flood', blocks: [] }) }))
  const ctl = new ExplorerController({ config, registry, engine, assets, data: new FakeData(files), isNarrow: () => false })
  return { ctl, engine }
}

// ---- pure rules -----------------------------------------------------------------------------------
describe('assets', () => {
  const a = new AssetRouter(config.data)
  it('routes files to the root that serves them', () => {
    expect(a.url('meta/layers.json')).toBe('https://anaguilarar.github.io/mosaic-lake-victoria/data/meta/layers.json')
    expect(a.url('tiles/terrain.pmtiles')).toMatch(/^https:\/\/anaguilarar\.github\.io\//)
    expect(a.url('tiles/flood_years.pmtiles')).toMatch(/^https:\/\/huggingface\.co\//)
    expect(a.pmtiles('tiles/s2_rgb.pmtiles')).toBe('pmtiles://https://anaguilarar.github.io/mosaic-lake-victoria/data/tiles/s2_rgb.pmtiles?v=13')
    expect(a.glyphs('fonts/{fontstack}/{range}.pbf')).toContain('/data/fonts/{fontstack}/{range}.pbf')
  })
  it('never requests withheld files, even from a local copy', () => {
    expect(a.source({ type: 'geojson', data: { asset: 'vectors/basin.geojson' } }).data).toBe(EMPTY_COLLECTION)
    expect(new AssetRouter(config.data, 'http://127.0.0.1:8002/KEN-LVB').isWithheld('vectors/basin.geojson')).toBe(true)
    expect(new AssetRouter(config.data, 'http://127.0.0.1:8002/KEN-LVB/').url('meta/a b.json')).toBe('http://127.0.0.1:8002/KEN-LVB/meta/a%20b.json')
  })
  it('rejects paths that leave the data folder', () => {
    expect(() => a.url('../secret')).toThrow()
  })
})

describe('configuration', () => {
  it('reads the published Lake Victoria explorer', () => {
    expect(config.overlays.map((o) => o.id)).toContain('spi3')
    expect(config.story?.chapters.length).toBeGreaterThan(5)
    expect(config.about.sources.length).toBeGreaterThan(10)
  })
  it('fails with a readable message', () => {
    expect(() => parseExplorerConfig({ ...config, groups: ['Base'] })).toThrow(ConfigError)
    expect(() => parseExplorerConfig({ ...config, data: { roots: {}, default_root: 'x' } })).toThrow(/default_root/)
    expect(() => new Options({ kind: 'x', n: 'a' }, 'here').num('n')).toThrow(/here\.n/)
  })
})

describe('geometry and series', () => {
  it('projects to UTM like the explorer (zone 36 south)', () => {
    const [x, y] = toUtm(32736, { lng: 33, lat: -1 })
    expect(x).toBeCloseTo(500000, 3)
    expect(y).toBeCloseTo(9889469.8, 0) // 10 000 km minus 1° of meridian arc × 0.9996
    expect(() => toUtm(4326, { lng: 0, lat: 0 })).toThrow()
  })
  it('tests points in polygons', () => {
    const sq = { type: 'Polygon' as const, coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] }
    expect(pointInPolygon({ lng: 1, lat: 1 }, sq)).toBe(true)
    expect(pointInPolygon({ lng: 3, lat: 1 }, sq)).toBe(false)
  })
  it('computes the series the panels and charts show', () => {
    expect(monthRange('2019-11', 3)).toEqual(['2019-11', '2019-12', '2020-01'])
    expect(seasonalTotals({ '2019-10': 1, '2019-11': 2, '2019-12': 3, '2020-10': 1 }, [10, 11, 12])).toEqual([['2019', 6]])
    expect(monthlyMeans([{ d: '2020-01-02', v: 1 }, { d: '2020-01-20', v: 3 }], (p) => p.d, (p) => p.v)).toEqual([['2020-01', 2]])
    expect(yearLabels(['2019', '2020', '2020-02'])).toEqual(['', '2020', ''])
    const spi = [{ max: -2, label: 'extremely dry' }, { max: -1, label: 'dry' }, { below: 1, label: 'near normal' }, { label: 'wet' }]
    expect([-2.5, -1.2, 0, 1.4].map((v) => classify(v, spi))).toEqual(['extremely dry', 'dry', 'near normal', 'wet'])
  })
  it('keeps the shareable state in the URL hash', () => {
    const h = parseHash('#layer=precip&var=tmean&season=ond&year=2020&cell=34.5,-0.2&lake=1', ['lake'])
    expect(h).toMatchObject({ layer: 'precip', time: { var: 'tmean', season: 'ond', year: '2020' }, cell: { lng: 34.5, lat: -0.2 }, panel: 'lake' })
    expect(parseHash(formatHash(h), ['lake'])).toMatchObject(h)
  })
  it('fills legend templates', () => {
    const m = legendFrom({ kind: 'classes', title: 'Land cover {year}', classes: [{ name: 'Trees', rgb: [1, 2, 3] }] }, { year: 2020 })
    expect(m).toMatchObject({ title: 'Land cover 2020', rows: [{ color: 'rgb(1,2,3)', label: 'Trees' }] })
  })
})

describe('chart builders', () => {
  it('turns the story charts of the profile into charts', async () => {
    const data = new FakeData({
      'series/precip_basin.json': { monthly: { '2019-10': 200, '2019-11': 300, '2019-12': 158, '2020-10': 10, '2020-11': 10, '2020-12': 10 } },
      'series/forest_loss.json': { regions: { 'Lake Victoria Basin': { '2016': 1, '2017': 5 }, Nzoia: { '2016': 1, '2017': 2 } } },
    })
    const ond = config.story!.chapters.find((c) => c.id === 'rains')!.visual!.charts![0]
    const [block] = await CORE_CHART_BUILDERS['seasonal-total'](new Options(ond, 't'), data)
    expect(block).toMatchObject({ type: 'chart', spec: { kind: 'line', options: { series: [{ values: [658, 30] }], annotations: [{ at: 0, label: '2019 · 658 mm' }] } } })
    const forest = config.story!.chapters.find((c) => c.id === 'treecover')!.visual!.charts![0]
    const blocks = await CORE_CHART_BUILDERS['annual-bars'](new Options(forest, 't'), data)
    expect(blocks.map((b) => b.type)).toEqual(['chart', 'multiples'])
  })
})

// ---- renderers and controller -------------------------------------------------------------------------
describe('explorer controller', () => {
  it('registers every overlay hidden and shows one at a time', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    expect(engine.visible()).not.toContain('ov-flood_years')
    await ctl.selectOverlay('flood_years')
    expect(engine.isVisible('ov-flood_years')).toBe(true)
    await ctl.selectOverlay('flood_excl')
    expect(engine.isVisible('ov-flood_years')).toBe(false)
    expect(engine.isVisible('ov-flood_excl')).toBe(true)
    expect(ctl.legend()?.title).toMatch(/excluded/)
    expect(ctl.attribution()).toContain('Copernicus EMS GFM')
  })
  it('switches variants and years', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    await ctl.selectOverlay('flood_freq')
    expect(ctl.legend()?.switch?.options.map((o) => o.id)).toEqual(['all', 'mam', 'ond'])
    await ctl.setVariant('ond')
    expect(engine.isVisible('ov-flood_freq-ond')).toBe(true)
    expect(engine.isVisible('ov-flood_freq-all')).toBe(false)
    await ctl.selectOverlay('landcover')
    expect(ctl.timeControl()?.caption.strong).toBe('2023')
    await ctl.time({ type: 'slider', value: 0 })
    expect(engine.isVisible('landcover-2017')).toBe(true)
    expect(ctl.legend()?.title).toBe('Land cover 2017 (Esri/Impact Observatory)')
  })
  it('keeps one floating panel and toggles the rail', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    ctl.setFloating('about')
    ctl.setFloating('stories')
    expect(ctl.store.get().floating).toBe('stories')
    expect(engine.isVisible('story-labels')).toBe(true) // story mode shows the story labels
    ctl.closeFloating()
    expect(engine.isVisible('story-labels')).toBe(false)
    ctl.toggle('admin')
    expect(engine.isVisible('adm1-line')).toBe(true)
    expect(ctl.rail().map((g) => g.group)).toEqual(config.groups)
  })
  it('shows the place on a click with no overlay, and the overlay inspector otherwise', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    engine.clickHandler!({ lngLat: { lng: 34.5, lat: -0.2 }, point: { x: 1, y: 2 } })
    await new Promise((r) => setTimeout(r, 0))
    expect(ctl.store.get()).toMatchObject({ floating: 'popover', inspection: { title: 'Terrain', blocks: [{ type: 'rows', rows: [['Place', '0.20° S, 34.50° E']] }, { type: 'note', text: 'Copernicus GLO-30' }] } })
    await ctl.selectOverlay('flood_years')
    engine.clickHandler!({ lngLat: { lng: 34.5, lat: -0.2 }, point: { x: 1, y: 2 } })
    await new Promise((r) => setTimeout(r, 0))
    expect(ctl.store.get().inspection?.title).toBe('flood')
  })
  it('applies a story chapter: overlay, highlight, camera', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    const ch = config.story!.chapters.find((c) => c.id === 'treecover')!
    await ctl.enterChapter(ch)
    expect(ctl.store.get().overlay).toBe('forest_loss')
    expect(engine.isVisible('nyando-hl')).toBe(true)
    expect(engine.flights.at(-1)).toMatchObject({ lng: 35.45, lat: -0.35 })
  })
})
