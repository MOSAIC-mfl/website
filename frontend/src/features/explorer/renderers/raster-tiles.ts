/**
 * kind: raster-tiles - one PMTiles raster (or a few variants of it, switched in the legend).
 * Flood hazard, population, WorldCover in the Lake Victoria profile.
 */
import { legendFrom, type LegendModel } from '../domain/legend'
import { BaseRenderer } from './base'
import type { ExplorerContext, OverlayView } from './types'

type Time = null

export class RasterTilesRenderer extends BaseRenderer<Time> {
  readonly timeKey = null

  initialTime(): Time {
    return null
  }

  private assets(): { id: string; label: string; asset: string }[] {
    return this.config.variants?.length
      ? this.config.variants.map((v) => ({ id: v.id, label: v.label, asset: v.asset }))
      : [{ id: '', label: '', asset: this.o.str('asset') }]
  }

  private layerId(variant: string): string {
    return variant ? `ov-${this.config.id}-${variant}` : `ov-${this.config.id}`
  }

  private current(view: OverlayView<Time>): string {
    const ids = this.assets().map((a) => a.id)
    return view.variant && ids.includes(view.variant) ? view.variant : ids[0]
  }

  register(ctx: ExplorerContext): void {
    for (const a of this.assets()) {
      const id = this.layerId(a.id)
      ctx.engine.addSource(id, { type: 'raster', url: ctx.assets.pmtiles(a.asset), tileSize: 256 })
      ctx.engine.addLayer(this.rasterLayer(id, id), this.config.before, true)
    }
  }

  async available(ctx: ExplorerContext): Promise<boolean> {
    return !ctx.assets.isWithheld(this.assets()[0].asset)
  }

  async show(ctx: ExplorerContext, view: OverlayView<Time>): Promise<void> {
    const cur = this.current(view)
    for (const a of this.assets()) ctx.engine.setVisible(this.layerId(a.id), a.id === cur)
  }

  hide(ctx: ExplorerContext): void {
    for (const a of this.assets()) ctx.engine.setVisible(this.layerId(a.id), false)
  }

  variants(): { id: string; label: string }[] {
    return this.config.variants?.map((v) => ({ id: v.id, label: v.label })) ?? []
  }

  legend(view: OverlayView<Time>): LegendModel | null {
    const cur = this.current(view)
    const cfg = this.config.variants?.find((v) => v.id === cur)?.legend ?? this.config.legend
    if (!cfg) return null
    const model = legendFrom(cfg)
    const variants = this.variants()
    return variants.length ? { ...model, switch: { label: 'Season', options: variants, value: cur } } : model
  }

  layerIds(view: OverlayView<Time>): string[] {
    return [this.layerId(this.current(view))]
  }
}
