/**
 * Adapter: MapEngine on MapLibre GL JS, with PMTiles archives and a swipe comparison.
 *
 * Two behaviours of the explorer are kept as they were:
 * - lazy PMTiles layers (its layers.js): a hidden raster overlay is added, with its source, the first
 *   time it is shown, so opening the page does not read ~65 archive headers;
 * - the comparison (its compare.js): a second map built from the main map's style, with the swiper
 *   keyboard-operable, terrain off and pitch 0 while open, and the view restored on close.
 */
import * as maplibregl from 'maplibre-gl'
import type { LayerSpecification, MapGeoJSONFeature, SourceSpecification, StyleSpecification } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import Compare from '@maplibre/maplibre-gl-compare'
import '@maplibre/maplibre-gl-compare/dist/maplibre-gl-compare.css'
import { Protocol } from 'pmtiles'
// MapLibre 6 loads its worker from a separate, self-contained module: ship it as an asset
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import type { Camera, StyleLayerSpec } from '../../domain/config'
import type { LngLat } from '../../domain/format'
import type { CompareOptions, FeatureHit, MapClick, MapEngine, Padding, ScreenPoint } from '../../ports/map-engine'

let protocolAdded = false

export interface EngineOptions {
  container: HTMLElement
  style: StyleSpecification
  camera: Camera
  minZoom?: number
  maxZoom?: number
  maxPitch?: number
  maxBounds?: [[number, number], [number, number]]
  terrain?: { source: string; exaggeration: number }
}

const NO_PADDING: Padding = { top: 0, bottom: 0, left: 0, right: 0 }

export class MapLibreEngine implements MapEngine {
  readonly ready: Promise<void>
  private readonly map: maplibregl.Map
  private readonly lazy = new Map<string, { layer: StyleLayerSpec; before?: string }>()
  private readonly pendingSources = new Map<string, Record<string, unknown>>()
  private readonly terrainSpec: { source: string; exaggeration: number } | undefined
  private cmp: { compare: { remove(): void; setSlider(x: number): void; currentPosition: number; on(e: string, f: () => void): void }; mapB: maplibregl.Map; ui: HTMLElement[]; saved: { pitch: number; maxPitch: number }; onClose: () => void } | null = null

  constructor(private readonly opts: EngineOptions) {
    if (!protocolAdded) {
      maplibregl.setWorkerUrl(workerUrl)
      maplibregl.addProtocol('pmtiles', new Protocol().tile)
      protocolAdded = true
    }
    this.terrainSpec = opts.terrain
    const c = opts.camera
    this.map = new maplibregl.Map({
      container: opts.container,
      style: opts.style,
      center: [c.lng, c.lat],
      zoom: c.zoom ?? 6,
      pitch: c.pitch ?? 0,
      bearing: c.bearing ?? 0,
      minZoom: opts.minZoom,
      maxZoom: opts.maxZoom,
      maxPitch: opts.maxPitch,
      maxBounds: opts.maxBounds,
      attributionControl: false,
    })
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left')
    this.ready = new Promise((resolve) => {
      this.map.once('load', () => {
        if (opts.style.sky) this.map.setSky(opts.style.sky)
        if (this.terrainSpec && this.map.getSource(this.terrainSpec.source)) this.map.setTerrain(this.terrainSpec)
        resolve()
      })
    })
  }

  // ---- sources and layers ------------------------------------------------------------------------
  addSource(id: string, spec: Record<string, unknown>): void {
    if (this.map.getSource(id) || this.pendingSources.has(id)) return
    this.pendingSources.set(id, spec)
  }

  private ensureSource(id: string | undefined): void {
    if (!id || this.map.getSource(id)) return
    const spec = this.pendingSources.get(id)
    if (spec) {
      this.map.addSource(id, spec as unknown as SourceSpecification)
      this.pendingSources.delete(id)
    }
  }

  private before(id: string | undefined): string | undefined {
    return id && this.map.getLayer(id) ? id : undefined
  }

  addLayer(spec: StyleLayerSpec, before?: string, lazy = false): void {
    if (this.map.getLayer(spec.id) || this.lazy.has(spec.id)) return
    const hidden = (spec.layout as { visibility?: string } | undefined)?.visibility === 'none'
    if (lazy && hidden) {
      this.lazy.set(spec.id, { layer: spec, before })
      return
    }
    this.ensureSource(spec.source)
    this.map.addLayer(spec as unknown as LayerSpecification, this.before(before))
  }

  hasLayer(id: string): boolean {
    return !!this.map.getLayer(id) || this.lazy.has(id)
  }

  setVisible(id: string, visible: boolean): void {
    if (this.map.getLayer(id)) {
      this.map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
      return
    }
    const entry = this.lazy.get(id)
    if (entry && visible) {
      this.lazy.delete(id)
      this.ensureSource(entry.layer.source)
      const layer = { ...entry.layer, layout: { ...(entry.layer.layout as object), visibility: 'visible' } }
      this.map.addLayer(layer as unknown as LayerSpecification, this.before(entry.before))
    }
  }

  isVisible(id: string): boolean {
    return !!this.map.getLayer(id) && this.map.getLayoutProperty(id, 'visibility') !== 'none'
  }

  setFilter(id: string, filter: unknown[] | null): void {
    if (this.map.getLayer(id)) {
      this.map.setFilter(id, filter as maplibregl.FilterSpecification | null)
      return
    }
    const entry = this.lazy.get(id)
    if (entry) entry.layer = { ...entry.layer, filter: filter ?? undefined }
  }

  setGeoJSON(sourceId: string, data: unknown): void {
    const src = this.map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined
    src?.setData(data as GeoJSON.GeoJSON)
  }

  queryAt(point: ScreenPoint, layers: string[], radius = 0): FeatureHit[] {
    const present = layers.filter((l) => this.map.getLayer(l))
    if (!present.length) return []
    const where: [number, number] | [[number, number], [number, number]] = radius
      ? [
          [point.x - radius, point.y - radius],
          [point.x + radius, point.y + radius],
        ]
      : [point.x, point.y]
    return this.map.queryRenderedFeatures(where, { layers: present }).map((f: MapGeoJSONFeature) => {
      const hit: FeatureHit = { layer: f.layer.id, properties: f.properties ?? {} }
      if (f.geometry.type === 'Point') {
        const [lng, lat] = f.geometry.coordinates
        hit.at = this.project({ lng, lat })
      }
      return hit
    })
  }

  project(lngLat: LngLat): ScreenPoint {
    const p = this.map.project([lngLat.lng, lngLat.lat])
    return { x: p.x, y: p.y }
  }

  // ---- events -------------------------------------------------------------------------------------
  onClick(handler: (e: MapClick) => void): () => void {
    const f = (e: maplibregl.MapMouseEvent) => handler({ lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat }, point: { x: e.point.x, y: e.point.y } })
    this.map.on('click', f)
    return () => this.map.off('click', f)
  }

  onLayerClick(layer: string, handler: (e: MapClick) => void): () => void {
    const f = (e: maplibregl.MapLayerMouseEvent) => handler({ lngLat: { lng: e.lngLat.lng, lat: e.lngLat.lat }, point: { x: e.point.x, y: e.point.y } })
    const enter = () => (this.map.getCanvas().style.cursor = 'pointer')
    const leave = () => (this.map.getCanvas().style.cursor = '')
    this.map.on('click', layer, f)
    this.map.on('mouseenter', layer, enter)
    this.map.on('mouseleave', layer, leave)
    return () => {
      this.map.off('click', layer, f)
      this.map.off('mouseenter', layer, enter)
      this.map.off('mouseleave', layer, leave)
    }
  }

  // ---- camera ---------------------------------------------------------------------------------------
  /* freezeElevation: without it, terrain elevation updates can break a flight mid-way (explorer note) */
  /** the zoom at which [w, s, e, n] fills `fill` of the map left free by the padding */
  private boundsZoom(b: [number, number, number, number], fill: number, padding?: Padding): number {
    const box = this.map.getContainer()
    const p = padding ?? { top: 0, bottom: 0, left: 0, right: 0 }
    const w = (box.clientWidth - p.left - p.right) * fill
    const h = (box.clientHeight - p.top - p.bottom) * fill
    const my = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
    const sx = ((b[2] - b[0]) / 360) * 512
    const sy = (Math.abs(my(b[3]) - my(b[1])) / (2 * Math.PI)) * 512
    return Math.min(this.map.getMaxZoom(), Math.log2(Math.min(w / sx, h / sy)))
  }

  flyTo(camera: Camera, options: { duration?: number; padding?: Padding } = {}): void {
    const b = camera.bounds
    this.map.flyTo({
      center: b ? [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] : [camera.lng, camera.lat],
      zoom: b ? this.boundsZoom(b, camera.fill ?? 0.6, options.padding) : (camera.zoom ?? 8),
      pitch: camera.pitch ?? 0,
      bearing: camera.bearing ?? 0,
      duration: options.duration ?? 1600,
      freezeElevation: true,
      ...(options.padding ? { padding: options.padding } : {}),
    })
  }

  jumpTo(camera: Camera): void {
    this.map.jumpTo({ center: [camera.lng, camera.lat], zoom: camera.zoom ?? 10, pitch: camera.pitch ?? 0, bearing: camera.bearing ?? 0 })
  }

  setPadding(padding: Padding, animate = true): void {
    if (animate) this.map.easeTo({ padding, duration: 400, freezeElevation: true })
    else this.map.setPadding(padding)
  }

  containerHeight(): number {
    return this.map.getContainer().clientHeight
  }

  hasTerrain(): boolean {
    return !!this.map.getTerrain()
  }

  setTerrainExaggeration(value: number): void {
    if (this.terrainSpec && this.map.getTerrain()) this.map.setTerrain({ source: this.terrainSpec.source, exaggeration: value })
    if (this.terrainSpec) this.terrainSpec.exaggeration = value
  }

  // ---- comparison -------------------------------------------------------------------------------------
  isComparing(): boolean {
    return this.cmp !== null
  }

  async compare(o: CompareOptions): Promise<void> {
    if (this.cmp) return
    const main = this.map
    for (const id of o.layers) this.setVisible(id, true)
    const style = main.getStyle()
    for (const id of o.layers) this.setVisible(id, false)
    const saved = { pitch: o.restorePitch, maxPitch: main.getMaxPitch() }
    main.setTerrain(null)
    main.setMaxPitch(0) // also levels the camera

    // right-hand map: what the main map shows now plus the compared layers; flat, no sky
    const keep = (l: LayerSpecification) =>
      o.layers.includes(l.id) || (l.layout as { visibility?: string } | undefined)?.visibility !== 'none'
    const layers = style.layers
      .filter(keep)
      .map((l) => (o.layers.includes(l.id) ? ({ ...l, layout: { ...(l.layout ?? {}), visibility: 'visible' } } as LayerSpecification) : l))
    const used = new Set(layers.map((l) => ('source' in l ? l.source : undefined)).filter(Boolean))
    const sources = Object.fromEntries(Object.entries(style.sources).filter(([k]) => used.has(k)))
    const rest: StyleSpecification = { ...style }
    delete rest.terrain
    delete rest.sky

    const box = document.createElement('div')
    box.className = 'compare-map'
    main.getContainer().after(box)
    const mapB = new maplibregl.Map({
      container: box,
      style: { version: 8, sources: {}, layers: [] },
      center: main.getCenter(),
      zoom: main.getZoom(),
      bearing: main.getBearing(),
      pitch: 0,
      maxPitch: 0,
      minZoom: main.getMinZoom(),
      maxZoom: main.getMaxZoom(),
      maxBounds: main.getMaxBounds() ?? undefined,
      attributionControl: false,
    })
    mapB.on('error', (e) => console.error('compare map:', e.error?.message ?? e))
    await new Promise<void>((res) => mapB.once('load', () => res()))
    const styled = new Promise<void>((res) => mapB.once('style.load', () => res()))
    mapB.setStyle({ ...rest, sources, layers }, { diff: false })
    await styled
    mapB.setPadding(o.padding)
    mapB.jumpTo({ center: main.getCenter(), zoom: main.getZoom(), bearing: main.getBearing(), pitch: 0 })

    const wrapper = main.getContainer().parentElement!
    const compare = new Compare(main, mapB, wrapper, {})
    const visibleW = () => main.getContainer().clientWidth - (o.padding.right || 0)
    compare.setSlider(Math.round(visibleW() / 2))
    const swiper = wrapper.querySelector<HTMLElement>('.compare-swiper-vertical')
    if (swiper) {
      const sync = () => swiper.setAttribute('aria-valuenow', String(Math.round((100 * compare.currentPosition) / visibleW())))
      swiper.tabIndex = 0
      swiper.setAttribute('role', 'slider')
      swiper.setAttribute('aria-label', `Comparison divider: ${o.leftLabel} on the left, ${o.rightLabel} on the right`)
      swiper.setAttribute('aria-valuemin', '0')
      swiper.setAttribute('aria-valuemax', '100')
      sync()
      swiper.addEventListener('keydown', (e) => {
        const W = visibleW()
        const step = (e.shiftKey ? 0.1 : 0.02) * W
        const to = ({ ArrowLeft: compare.currentPosition - step, ArrowRight: compare.currentPosition + step, Home: 0, End: W } as Record<string, number>)[e.key]
        if (to == null) return
        e.preventDefault()
        compare.setSlider(Math.max(0, Math.min(W, to)))
        sync()
      })
      compare.on('slideend', sync)
    }
    const labels = document.createElement('div')
    labels.className = 'compare-ui'
    for (const [cls, text] of [['left', o.leftLabel], ['right', o.rightLabel]]) {
      const s = document.createElement('span')
      s.className = `compare-label ${cls}`
      s.textContent = text
      labels.append(s)
    }
    const close = document.createElement('button')
    close.className = 'compare-close'
    close.type = 'button'
    close.textContent = 'Close comparison'
    close.addEventListener('click', () => this.closeCompare(true))
    wrapper.append(labels, close)
    this.cmp = { compare, mapB, ui: [box, labels, close], saved, onClose: o.onClose }
  }

  closeCompare(restoreView: boolean): void {
    if (!this.cmp) return
    const { compare, mapB, ui, saved, onClose } = this.cmp
    this.cmp = null
    try {
      compare.remove()
    } catch {
      /* already gone */
    }
    mapB.remove()
    ui.forEach((el) => el.remove())
    this.map.getContainer().style.clip = '' // the plugin clips the left map's container
    this.map.setMaxPitch(saved.maxPitch)
    if (this.terrainSpec && this.map.getSource(this.terrainSpec.source)) this.map.setTerrain(this.terrainSpec)
    if (restoreView) this.map.easeTo({ pitch: saved.pitch, duration: 500, freezeElevation: true })
    onClose()
  }

  destroy(): void {
    this.closeCompare(false)
    this.map.remove()
  }
}

export { NO_PADDING }
