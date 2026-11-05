/** Fakes of the explorer's ports (map engine, data files) for the tests: no browser, no network. */
import type { DataSource, GridStack, RasterFile } from '../src/features/explorer/ports/data'
import type { CompareOptions, FeatureHit, MapClick, MapEngine } from '../src/features/explorer/ports/map-engine'

export class FakeEngine implements MapEngine {
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
  filters = new Map<string, unknown>()
  setFilter(id: string, f: unknown) {
    this.filters.set(id, f)
  }
  /** what queryAt returns (features under the click), set by a test */
  hits: FeatureHit[] = []
  queryAt(_point: unknown, layers: string[]) {
    return this.hits.filter((h) => layers.includes(h.layer))
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

export class FakeData implements DataSource {
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
