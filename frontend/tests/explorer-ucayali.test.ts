/**
 * The modules added for the Ucayali profile (PER-PCL): style-layers overlays, the attribute / value /
 * series inspectors, class charts, story steps with a focus feature, admin units without a country
 * field, per-variable climate scales. Fake engine and data, no browser.
 */
import { describe, expect, it } from 'vitest'
import pcl from './fixtures-landscape-per-pcl.json'
import { CORE_CHART_BUILDERS } from '../src/features/explorer/application/chart-builders'
import { ExplorerController } from '../src/features/explorer/application/explorer'
import { AssetRouter } from '../src/features/explorer/domain/assets'
import { parseExplorerConfig, type ExplorerConfig } from '../src/features/explorer/domain/config'
import { Options } from '../src/features/explorer/domain/options'
import { fillFields } from '../src/features/explorer/domain/template'
import { normalValue, stackScale, type GridMeta } from '../src/features/explorer/renderers/grid'
import { coreRegistry } from '../src/features/explorer/renderers/registry'
import type { RasterFile } from '../src/features/explorer/ports/data'
import { FakeData, FakeEngine } from './explorer-fakes'

const section = (pcl as { sections: { kind: string; config?: unknown }[] }).sections.find((s) => s.kind === 'map-explorer')!
const config: ExplorerConfig = parseExplorerConfig(section.config)

/** a 2 x 2 raster in EPSG:4326 around (-75, -9) whose bands are given per pixel */
const raster = (bands: number[][]): RasterFile => ({
  width: 2,
  height: 2,
  origin: [-75.1, -8.9],
  resolution: [0.1, -0.1],
  async read(_w, samples = [0]) {
    return samples.map((s) => [bands[s][0]])
  },
})

const controller = (files: Record<string, unknown> = {}) => {
  const engine = new FakeEngine()
  for (const layer of config.map.layers) engine.addLayer(layer)
  const ctl = new ExplorerController({
    config,
    registry: coreRegistry(),
    engine,
    assets: new AssetRouter(config.data),
    data: new FakeData(files),
    isNarrow: () => false,
  })
  return { ctl, engine }
}

const click = async (engine: FakeEngine) => {
  engine.clickHandler!({ lngLat: { lng: -75.05, lat: -8.95 }, point: { x: 1, y: 2 } })
  await new Promise((r) => setTimeout(r, 0))
}

describe('templates', () => {
  it('fills fields with filters, and gives a dash when nothing is known', () => {
    const p = { rh95: 295, date: 20190420, COBERTURA: 'Bosque_de_colina_baja', area_ha: 1897.5, n: 2063 }
    expect(fillFields('{rh95|scale:0.1|fixed:1}', p)).toBe('29.5')
    expect(fillFields('{date|date8}', p)).toBe('2019-04-20')
    expect(fillFields('{COBERTURA|spaces}', p)).toBe('Bosque de colina baja')
    expect(fillFields('{area_ha|num} ha · n = {n|int}', p)).toBe('1,897.5 ha · n = 2,063')
    expect(fillFields('{legal_doc}', p)).toBe('—')
  })
})

describe('Ucayali explorer', () => {
  it('reads the profile: vector overlays are style layers drawn under the mask', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    expect(config.overlays.map((o) => o.kind)).toContain('style-layers')
    for (const id of ['veg-fill', 'veg-line', 'pa-fill', 'gedi-grid-tiles', 'gedi-fp']) {
      expect(engine.layers.get(id)).toMatchObject({ visible: false, before: 'dim' })
    }
    await ctl.selectOverlay('veg_classes')
    expect(engine.isVisible('veg-fill')).toBe(true)
    expect(ctl.legend()?.title).toBe('Vegetation classes (co-produced with local experts)')
    await ctl.selectOverlay('protected_areas')
    expect(engine.isVisible('veg-fill')).toBe(false)
    expect(engine.isVisible('pa-line')).toBe(true)
  })

  it('shows the attributes of the clicked polygon, or says there is none', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    await ctl.selectOverlay('protected_areas')
    await click(engine)
    expect(ctl.store.get().inspection).toMatchObject({ title: 'Ucayali', blocks: [{ type: 'rows' }, { type: 'note', text: 'No protected area here.' }] })
    engine.hits = [{ layer: 'pa-fill', properties: { name: 'Imiria', category: 'Área de Conservación Regional', kind: 'ACR (regional)', year: 2010, area_legal_ha: 135737.6 } }]
    await click(engine)
    const ins = ctl.store.get().inspection!
    expect(ins.title).toBe('Imiria')
    expect(ins.blocks[1]).toEqual({
      type: 'rows',
      rows: [
        ['Category', 'Área de Conservación Regional'],
        ['Kind', 'ACR (regional)'],
        ['Created', '2010'],
        ['Legal document', '—'],
        ['Legal area', '135,738 ha'],
      ],
    })
  })

  it('combines the nearest GEDI footprint with the 1 km cell values', async () => {
    const { ctl, engine } = controller({ 'query/gedi_rh95_1km.tif': raster([[287], [41]]) })
    await ctl.start()
    await ctl.selectOverlay('gedi')
    engine.hits = [
      { layer: 'gedi-fp', properties: { rh95: 100, rh50: 50, date: 20200101 }, at: { x: 30, y: 30 } },
      { layer: 'gedi-fp', properties: { rh95: 312, rh50: 171, date: 20210305 }, at: { x: 11, y: 21 } },
    ]
    await click(engine)
    const ins = ctl.store.get().inspection!
    expect(ins.title).toBe('GEDI footprint')
    const kpis = ins.blocks.filter((b) => b.type === 'kpis').flatMap((b) => (b.type === 'kpis' ? b.items.map((i) => `${i.label}=${i.value}`) : []))
    expect(kpis).toEqual(['RH95 · this footprint=31.2', 'RH50=17.1', 'Date=2021-03-05', 'Mean RH95 · 1 km cell=28.7', 'Shots in the cell=41'])
  })

  it('lists the department totals of a series by class', async () => {
    const forest = { classes: { '1': 'Water', '3': 'Forest loss 2001–2024' }, regions: { Ucayali: { '1': 2741.74, '3': 6054.47 } } }
    const { ctl, engine } = controller({ 'series/forest_classes.json': forest })
    await ctl.start()
    await ctl.selectOverlay('forest_loss')
    await click(engine)
    const ins = ctl.store.get().inspection!
    expect(ins.title).toBe('Forest & loss · Ucayali')
    expect(ins.blocks[0]).toMatchObject({ type: 'kpis', items: [{ label: 'Water', value: '2,742', unit: 'km²' }, { label: 'Forest loss 2001–2024', value: '6,054' }] })
  })

  it('names provinces and districts from their own fields', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    ctl.toggle('admin')
    engine.hits = [
      { layer: 'districts-hit', properties: { district: 'RAIMONDI', province: 'ATALAYA' } },
      { layer: 'provinces-hit', properties: { province: 'ATALAYA' } },
    ]
    await click(engine)
    expect(ctl.store.get().inspection).toMatchObject({ title: 'Ucayali', blocks: [{ type: 'rows', rows: [['Place', '8.95° S, 75.05° W'], ['District', 'RAIMONDI'], ['Province', 'ATALAYA']] }, { type: 'note', text: 'Sentinel-2 mosaic · 30 m' }] })
  })

  it('plays a chapter step: layer, focus feature, camera box', async () => {
    const { ctl, engine } = controller()
    await ctl.start()
    ctl.setFloating('stories')
    const ch = config.story!.chapters.find((c) => c.id === 'heights')!
    await ctl.enterChapter(ch)
    expect(engine.isVisible('story-veg-line')).toBe(true) // outlines
    expect(engine.filters.get('story-veg-focus')).toEqual(['==', ['get', 'PLOTID'], 'SC_338'])
    await ctl.playStep(ch.visual!.steps![1], ch)
    expect(ctl.store.get().overlay).toBe('gedi')
    expect(engine.filters.get('story-veg-focus')).toEqual(['==', ['get', 'PLOTID'], 'SC_344'])
    expect(engine.flights.at(-1)).toMatchObject({ bounds: [-74.9404, -8.4055, -74.9264, -8.3941] })
    const fire = config.story!.chapters.find((c) => c.id === 'forest_loss')!
    await ctl.playStep(fire.visual!.steps![1], fire)
    expect(ctl.store.get().overlay).toBe('fire')
    expect(ctl.timeControl()?.caption.strong).toBe('2024')
    ctl.closeFloating()
    expect(engine.isVisible('story-veg-focus')).toBe(false)
  })

  it('draws class charts largest first', async () => {
    const t = { classes: [{ label: 'Purma', ratio_mean: 0.36, group: 'forest', n: 47 }, { label: 'Mature', ratio_mean: 0.58, group: 'forest', n: 2063 }] }
    const chart = config.story!.chapters.find((c) => c.id === 'shape')!.visual!.charts![0]
    const blocks = await CORE_CHART_BUILDERS['class-bars'](new Options(chart, 'chart'), new FakeData({ 'series/cooley_tables.json': t }))
    const spec = blocks[0].type === 'chart' ? blocks[0].spec : null
    expect(spec?.kind).toBe('hbars')
    if (spec?.kind === 'hbars') {
      expect(spec.rows.map((r) => r.label)).toEqual(['Mature', 'Purma'])
      expect(spec.rows[0].tip).toBe('Mature: 0.58 (Table 4a; n = 2,063 footprints, Table 2a)')
      expect(spec.options.max).toBe(1)
    }
  })
})

describe('climate grids', () => {
  it('reads per-variable scales and real-unit normals, and the older format', () => {
    const base = { scale: 0.1 } as GridMeta
    expect(stackScale({ ...base, scales: { precip: 1, tmean: 10 } }, 'precip')).toBe(1)
    expect(stackScale({ ...base, scales: { precip: 1, tmean: 10 } }, 'tmean')).toBe(0.1)
    expect(stackScale(base, 'precip')).toBe(0.1)
    expect(normalValue({ ...base, normals_encoding: 'float32, nodata NaN, real units' }, 1902.4)).toBe(1902.4)
    expect(normalValue({ ...base, normals_encoding: 'float32, nodata NaN, real units' }, NaN)).toBeNull()
    expect(normalValue(base, 19024)).toBeCloseTo(1902.4)
    expect(normalValue(base, -32768)).toBeNull()
  })
})
