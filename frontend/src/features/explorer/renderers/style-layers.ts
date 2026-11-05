/**
 * kind: style-layers - an overlay drawn by its own MapLibre sources and layers, written in the
 * profile like the base map (`sources`, `layers`, with {asset}/{pmtiles} references). Covers vector
 * data (polygons coloured by a property, points from a zoom level) and mixes such as a raster grid
 * with vector points on top. All its layers are shown and hidden together.
 *
 *   kind: style-layers
 *   sources: {veg: {type: geojson, data: {asset: vectors/veg_classes.geojson}}}
 *   layers: [{id: veg-fill, type: fill, source: veg, paint: {...}}, ...]
 *   before: dim               # where the layers go in the base map (optional)
 *   legend: {...}             # as any overlay
 */
import type { StyleLayerSpec, StyleSourceSpec } from '../domain/config'
import { legendFrom, type LegendModel } from '../domain/legend'
import { BaseRenderer } from './base'
import type { ExplorerContext, OverlayView } from './types'

type Time = null

export class StyleLayersRenderer extends BaseRenderer<Time> {
  readonly timeKey = null

  initialTime(): Time {
    return null
  }

  private sources(): Record<string, StyleSourceSpec> {
    return (this.o.raw<Record<string, StyleSourceSpec>>('sources') ?? {}) as Record<string, StyleSourceSpec>
  }

  private layers(): StyleLayerSpec[] {
    const v = this.o.raw<StyleLayerSpec[]>('layers')
    if (!Array.isArray(v) || !v.length) throw new Error(`overlays.${this.config.id}.layers: needs at least one layer`)
    return v
  }

  /** the asset files the overlay reads (a withheld one makes it unavailable) */
  private assets(): string[] {
    return Object.values(this.sources()).flatMap((s) => {
      const ref = (s.data ?? s.url) as { asset?: string; pmtiles?: string } | undefined
      return ref?.asset ?? ref?.pmtiles ?? []
    })
  }

  register(ctx: ExplorerContext): void {
    for (const [id, spec] of Object.entries(this.sources())) ctx.engine.addSource(id, ctx.assets.source(spec))
    for (const l of this.layers()) {
      ctx.engine.addLayer({ ...l, layout: { ...((l.layout as object) ?? {}), visibility: 'none' } }, this.config.before, true)
    }
  }

  async available(ctx: ExplorerContext): Promise<boolean> {
    return !this.assets().some((a) => ctx.assets.isWithheld(a))
  }

  async show(ctx: ExplorerContext): Promise<void> {
    for (const l of this.layers()) ctx.engine.setVisible(l.id, true)
  }

  hide(ctx: ExplorerContext): void {
    for (const l of this.layers()) ctx.engine.setVisible(l.id, false)
  }

  legend(_view: OverlayView<Time>): LegendModel | null {
    return this.config.legend ? legendFrom(this.config.legend) : null
  }

  layerIds(_view: OverlayView<Time>): string[] {
    return this.layers().map((l) => l.id)
  }
}
