/**
 * Core inspectors for vector data, continuous rasters and tables of values (added for the Ucayali
 * profile; generic for any profile):
 *
 *   feature-attributes  the attributes of the feature clicked (a polygon, the nearest point)
 *   value-at-point      the values of a raster's bands at the click (scale, nodata, unit)
 *   series-values       a set of named values from a JSON file (areas by class, ...)
 *
 * Texts are templates with the feature's properties (domain/template.ts: `{field|filter}`).
 */
import type { Block, Inspection, Kpi } from '../domain/blocks'
import { fillTemplate } from '../domain/legend'
import type { Options } from '../domain/options'
import { pick } from '../domain/series'
import type { Inspector, InspectorFactory } from '../renderers/types'
import { fillFields } from '../domain/template'
import { pixelAt } from './raster-point'

const DASH = '—'

interface Shown {
  label: string
  value: string
  unit?: string
  size?: number
}

function kpisFrom(items: Shown[]): Block {
  return {
    type: 'kpis',
    items: items.map((x, i): Kpi => ({ label: x.label, value: x.value, unit: x.unit, lead: i === 0, size: x.size ?? (i === 0 ? undefined : 17) })),
  }
}

type Opts = Pick<Options, 'optStr' | 'list' | 'strList' | 'has' | 'str'>

/** `as: kpis` (a strip of values, the first one large) or rows; then `facts`, `notes`, `note`. */
function present(o: Opts, items: Shown[], as = o.optStr('as')): Block[] {
  const facts: Shown[] = o.list('facts').map((f) => ({ label: f.str('label'), value: f.str('value'), size: 15 }))
  const blocks: Block[] = []
  if (as === 'kpis') {
    if (items.length || facts.length) blocks.push(kpisFrom([...items, ...facts]))
  } else {
    const rows = [...items, ...facts].map((x): [string, string] => [x.label, x.unit && x.value !== DASH ? `${x.value} ${x.unit}` : x.value])
    if (rows.length) blocks.push({ type: 'rows', rows })
  }
  for (const n of o.strList('notes')) blocks.push({ type: 'note', text: n })
  if (o.has('note')) blocks.push({ type: 'note', text: o.str('note') })
  return blocks
}

const target = (o: Opts, fallback: 'popover' | 'panel'): 'popover' | 'panel' => (o.optStr('target') === 'panel' ? 'panel' : o.optStr('target') === 'popover' ? 'popover' : fallback)

/**
 * feature-attributes: `layers` to query, `radius` (px) and `nearest` for small points, `title` and
 * `fields` [{label, value, unit}] as templates. Without a feature: `empty` (a note) with
 * `empty_title`, or nothing when `optional` (to combine with another inspector).
 */
export const featureAttributes: InspectorFactory = (o: Options): Inspector => ({
  async inspect(ctx, lngLat) {
    const p = ctx.engine.project(lngLat)
    const hits = ctx.engine.queryAt(p, o.strList('layers'), o.num('radius', 0))
    let hit = hits[0]
    if (o.bool('nearest') && hits.length > 1) {
      const d = (h: (typeof hits)[number]) => (h.at ? (h.at.x - p.x) ** 2 + (h.at.y - p.y) ** 2 : Infinity)
      hit = hits.reduce((a, b) => (d(b) < d(a) ? b : a))
    }
    const place: [string, string][] = o.bool('place') ? [['Place', ctx.place(lngLat)]] : []
    if (!hit) {
      if (o.bool('optional')) return null
      return {
        target: target(o, 'popover'),
        title: fillTemplate(o.optStr('empty_title') ?? o.optStr('overlay_title') ?? 'Location', { place: ctx.place(lngLat) }),
        blocks: [...(place.length ? [{ type: 'rows' as const, rows: place }] : []), ...(o.has('empty') ? [{ type: 'note' as const, text: o.str('empty'), tone: 'empty' as const }] : [])],
      }
    }
    const props = hit.properties
    const items = o.list('fields').map((f) => ({ label: f.str('label'), value: fillFields(f.str('value'), props), unit: f.optStr('unit'), size: f.has('size') ? f.num('size') : undefined }))
    const blocks = present(o, items)
    if (place.length) blocks.unshift({ type: 'rows', rows: place })
    return { target: target(o, 'popover'), title: fillFields(o.str('title'), props), hint: o.optStr('hint'), blocks }
  },
})

/**
 * value-at-point: `asset` (a GeoTIFF / COG), `crs` when not EPSG:4326, `bands` [{band, label, unit,
 * scale, decimals, nodata: [..]}] - the first is the lead value - and `title` with {place}.
 */
export const valueAtPoint: InspectorFactory = (o: Options): Inspector => ({
  async inspect(ctx, lngLat) {
    const img = await ctx.data.raster(o.str('asset'))
    const px = pixelAt(img, lngLat, o.optStr('crs'))
    const bands = o.list('bands')
    const values = px ? await img.read([px.col, px.row, px.col + 1, px.row + 1], bands.map((b) => b.num('band', 0))) : null
    const nodataText = o.optStr('nodata_text') ?? 'no data'
    const items: Shown[] = bands.map((b, i) => {
      const raw = values ? values[i][0] : null
      const missing = raw == null || Number.isNaN(raw) || b.numList('nodata').includes(raw)
      const v = missing ? null : raw * b.num('scale', 1)
      return {
        label: b.str('label'),
        value: v == null ? (b.optStr('nodata_text') ?? nodataText) : b.has('decimals') ? v.toFixed(b.num('decimals')) : v.toLocaleString('en-US'),
        unit: v == null ? undefined : b.optStr('unit'),
      }
    })
    return {
      target: target(o, 'panel'),
      title: fillTemplate(o.str('title'), { place: ctx.place(lngLat) }),
      hint: o.optStr('hint'),
      blocks: present(o, items, 'kpis'),
    }
  },
})

/** series-values: `series` (JSON), `path` to {key: value}, `labels_path` to {key: label}, `unit`. */
export const seriesValues: InspectorFactory = (o: Options): Inspector => ({
  async inspect(ctx) {
    const doc = await ctx.data.json<Record<string, unknown>>(o.str('series'))
    const values = (pick(doc, o.strList('path')) ?? {}) as Record<string, number>
    const labels = (o.has('labels_path') ? pick(doc, o.strList('labels_path')) : {}) as Record<string, string>
    const unit = o.optStr('unit')
    const items: Shown[] = Object.entries(values).map(([k, v]) => ({ label: labels?.[k] ?? k, value: Math.round(v).toLocaleString('en-US'), unit, size: 17 }))
    return {
      target: target(o, 'panel'),
      title: o.str('title'),
      hint: o.optStr('hint'),
      blocks: [{ type: 'kpis', items: items.map((x) => ({ ...x, lead: false })) }, ...present(o, [], 'rows')],
    }
  },
})

/**
 * combined: several inspectors on one click (`parts`, each with its own `kind`); the blocks follow
 * one another, the title is the first part's (a part may be `optional`).
 */
export function combined(build: (part: Options) => Inspector | null): InspectorFactory {
  return (o: Options): Inspector => {
    const parts = o.list('parts').map(build).filter((x): x is Inspector => !!x)
    return {
      async inspect(ctx, lngLat, vars) {
        const results = (await Promise.all(parts.map((p) => p.inspect(ctx, lngLat, vars)))).filter((x): x is Inspection => !!x)
        if (!results.length) return null
        return {
          target: target(o, results[0].target),
          title: results[0].title,
          hint: o.optStr('hint') ?? results[0].hint,
          blocks: [...results.flatMap((r) => r.blocks), ...(o.has('note') ? [{ type: 'note' as const, text: o.str('note') }] : [])],
        }
      },
    }
  }
}

export const ATTRIBUTE_INSPECTORS: Record<string, InspectorFactory> = {
  'feature-attributes': featureAttributes,
  'value-at-point': valueAtPoint,
  'series-values': seriesValues,
}
