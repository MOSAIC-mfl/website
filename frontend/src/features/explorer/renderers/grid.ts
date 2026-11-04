/**
 * Gridded climate data prepared for the explorer (the author's prep/08 and 09 scripts): a folder with
 * app_meta.json, one small GeoTIFF stack per variable and season, normals, a land mask and per-cell
 * monthly series in binary files (one HTTP range request per clicked cell).
 *
 * GridData reads it; GridLayer draws one band on the map. MapLibre does not drape image sources over
 * 3D terrain, so the grid is one GeoJSON polygon per cell (fill layers drape correctly); the geometry
 * is built once and each redraw only recomputes the colours (as the explorer's climate.js).
 */
import { css, rampColor } from '../domain/color'
import type { LngLat } from '../domain/format'
import type { GridStack } from '../ports/data'
import type { ExplorerContext } from './types'

export const NODATA = -32768
export const WATER = 20 // land-mask value of open water

export interface GridMeta {
  width: number
  height: number
  transform: [number, number, number, number, number, number]
  scale: number
  normal: string
  months: { start: string } & Record<string, number | string>
  months_spi3?: { start: string; n: number }
  ranges: Record<string, [number, number]>
  years: Record<string, number[]>
}

const NORMAL_BANDS = ['precip_annual', 'precip_mam', 'precip_ond', 'tmean_annual', 'tmean_mam', 'tmean_ond']

export class GridData {
  private metaP: Promise<GridMeta> | null = null
  private stacks = new Map<string, Promise<GridStack>>()

  constructor(
    private readonly ctx: ExplorerContext,
    private readonly folder: string,
  ) {}

  meta(): Promise<GridMeta> {
    this.metaP ??= this.ctx.data.json<GridMeta>(`${this.folder}app_meta.json`)
    return this.metaP
  }

  stack(file: string): Promise<GridStack> {
    if (!this.stacks.has(file)) this.stacks.set(file, this.ctx.data.grid(this.folder + file))
    return this.stacks.get(file)!
  }

  /** normal band for 'precip_annual', 'tmean_mam', ... (null when there is none) */
  async normal(key: string): Promise<ArrayLike<number> | null> {
    const i = NORMAL_BANDS.indexOf(key)
    return i < 0 ? null : (await this.stack('normals.tif')).bands[i]
  }

  async landmask(): Promise<ArrayLike<number>> {
    return (await this.stack('landmask.tif')).bands[0]
  }

  cellAt(meta: GridMeta, { lng, lat }: LngLat): { row: number; col: number; index: number } | null {
    const [a, , c, , e, f] = meta.transform
    const col = Math.floor((lng - c) / a)
    const row = Math.floor((lat - f) / e)
    if (row < 0 || col < 0 || row >= meta.height || col >= meta.width) return null
    return { row, col, index: row * meta.width + col }
  }

  /** n int16 values of one cell from a cells file (cell-major) */
  async cellSeries(file: string, index: number, n: number): Promise<Int16Array> {
    return new Int16Array(await this.ctx.data.bytes(this.folder + file, index * n * 2, n * 2))
  }
}

export const gridData = (ctx: ExplorerContext, folder: string): GridData =>
  ctx.shared(`grid-data:${folder}`, () => new GridData(ctx, folder))

export class GridLayer {
  private geometry: { type: 'FeatureCollection'; features: { type: 'Feature'; id: number; properties: { c: string }; geometry: object }[] } | null = null
  private readonly id: string

  constructor(
    private readonly ctx: ExplorerContext,
    folder: string,
    private readonly before: string | undefined,
  ) {
    this.id = `grid-${folder.replace(/[^a-z0-9]+/gi, '-')}`
  }

  private build(meta: GridMeta) {
    const [a, , c, , e, f] = meta.transform
    const features = []
    for (let r = 0; r < meta.height; r++) {
      for (let q = 0; q < meta.width; q++) {
        const x0 = c + q * a
        const y0 = f + r * e
        features.push({
          type: 'Feature' as const,
          id: r * meta.width + q,
          properties: { c: 'rgba(0,0,0,0)' },
          geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x0 + a, y0], [x0 + a, y0 + e], [x0, y0 + e], [x0, y0]]] },
        })
      }
    }
    return { type: 'FeatureCollection' as const, features }
  }

  /**
   * Colours each cell from `value(i)` (null = transparent). Cells on open water are faded:
   * satellite estimates over the lake are less reliable.
   */
  draw(meta: GridMeta, value: (i: number) => number | null, lo: number, hi: number, ramp: readonly string[], water: ArrayLike<number> | null) {
    this.geometry ??= this.build(meta)
    for (let i = 0; i < this.geometry.features.length; i++) {
      const v = value(i)
      let col = 'rgba(0,0,0,0)'
      if (v != null && Number.isFinite(v)) {
        const rgb = rampColor(ramp, (v - lo) / (hi - lo))
        col = water && water[i] === WATER ? css(rgb, 0.35) : css(rgb)
      }
      this.geometry.features[i].properties.c = col
    }
    const { engine } = this.ctx
    if (!engine.hasLayer(this.id)) {
      engine.addSource(this.id, { type: 'geojson', data: this.geometry })
      engine.addLayer(
        { id: this.id, type: 'fill', source: this.id, paint: { 'fill-color': ['get', 'c'], 'fill-opacity': 0.78, 'fill-antialias': false } },
        this.before,
      )
    } else engine.setGeoJSON(this.id, this.geometry)
    engine.setVisible(this.id, true)
  }

  hide(): void {
    if (this.ctx.engine.hasLayer(this.id)) this.ctx.engine.setVisible(this.id, false)
  }

  layerId(): string {
    return this.id
  }
}

export const gridLayer = (ctx: ExplorerContext, folder: string, before?: string): GridLayer =>
  ctx.shared(`grid-layer:${folder}`, () => new GridLayer(ctx, folder, before))
