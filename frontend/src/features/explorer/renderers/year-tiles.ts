/**
 * kind: year-tiles - one PMTiles raster per year, switched by the time bar; optionally point files
 * per year shown from a zoom level (active fires). Land cover, tree-cover loss, fire, burned area.
 */
import { fillTemplate, legendFrom, type LegendModel } from '../domain/legend'
import { BaseRenderer } from './base'
import type { ExplorerContext, OverlayView, TimeControl, TimeInput } from './types'

interface Time {
  year: string
}

export class YearTilesRenderer extends BaseRenderer<Time> {
  get timeKey(): string {
    return this.config.id
  }

  private years(): string[] {
    return Object.keys(this.o.strMap('years')).sort()
  }

  initialTime(): Time {
    return { year: this.years().at(-1) ?? '' }
  }

  private layerId(year: string): string {
    return `${this.config.id}-${year}`
  }

  private pointsSource(): string {
    return `${this.config.id}-points`
  }

  register(ctx: ExplorerContext): void {
    for (const [year, asset] of Object.entries(this.o.strMap('years'))) {
      const id = this.layerId(year)
      ctx.engine.addSource(id, { type: 'raster', url: ctx.assets.pmtiles(asset), tileSize: 256 })
      ctx.engine.addLayer(this.rasterLayer(id, id), this.config.before, true)
    }
  }

  private loadedPoints: string | null = null

  private async showPoints(ctx: ExplorerContext, year: string | null): Promise<void> {
    const pts = this.o.sub('points')
    if (!pts) return
    const id = this.pointsSource()
    if (year && this.loadedPoints !== year) {
      const asset = pts.strMap('assets')[year]
      if (asset) {
        try {
          const data = await ctx.data.json(asset)
          if (!ctx.engine.hasLayer(id)) {
            ctx.engine.addSource(id, { type: 'geojson', data })
            ctx.engine.addLayer(
              { id, type: 'circle', source: id, minzoom: pts.num('min_zoom', 10), paint: pts.raw('paint') ?? {} },
              pts.optStr('before'),
            )
          } else ctx.engine.setGeoJSON(id, data)
          this.loadedPoints = year
        } catch {
          /* the points file is optional: the density tiles still show */
        }
      }
    }
    if (ctx.engine.hasLayer(id)) ctx.engine.setVisible(id, year !== null && this.loadedPoints === year)
  }

  async show(ctx: ExplorerContext, view: OverlayView<Time>): Promise<void> {
    for (const y of this.years()) ctx.engine.setVisible(this.layerId(y), y === view.time.year)
    await this.showPoints(ctx, view.time.year)
  }

  hide(ctx: ExplorerContext): void {
    for (const y of this.years()) ctx.engine.setVisible(this.layerId(y), false)
    void this.showPoints(ctx, null)
  }

  legend(view: OverlayView<Time>): LegendModel | null {
    return this.config.legend ? legendFrom(this.config.legend, { year: view.time.year }) : null
  }

  timeControl(view: OverlayView<Time>): TimeControl {
    const years = this.years()
    return {
      segments: [],
      slider: { min: 0, max: years.length - 1, step: 1, value: Math.max(0, years.indexOf(view.time.year)) },
      caption: {
        strong: fillTemplate(this.o.optStr('time_label') ?? '{year}', { year: view.time.year }),
        rest: this.o.optStr('time_caption') ?? '',
      },
    }
  }

  applyTime(time: Time, input: TimeInput): Time {
    return input.type === 'slider' ? { year: this.years()[input.value] ?? time.year } : time
  }

  presetTime(time: Time, params: Record<string, string | number>): Time {
    const y = params.year != null ? String(params.year) : null
    return y && this.years().includes(y) ? { year: y } : time
  }

  timeParams(time: Time): Record<string, string> {
    return { year: time.year }
  }

  protected vars(view: OverlayView<Time>): { year: string; years: string[] } {
    return { year: view.time.year, years: this.years() }
  }

  layerIds(view: OverlayView<Time>): string[] {
    return [this.layerId(view.time.year)]
  }
}
